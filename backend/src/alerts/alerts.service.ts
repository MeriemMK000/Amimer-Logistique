import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Alert } from './alert.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';
import { AlertType, AlertPriority } from '../common/enums';
import { VehicleDocument } from '../vehicle-documents/vehicle-document.entity';
import { VehicleLease } from '../vehicle-leases/vehicle-lease.entity';
import { MaintenancePlan } from '../maintenance/entities/maintenance-plan.entity';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(VehicleDocument)
    private readonly documentRepository: Repository<VehicleDocument>,
    @InjectRepository(VehicleLease)
    private readonly leaseRepository: Repository<VehicleLease>,
    @InjectRepository(MaintenancePlan)
    private readonly planRepository: Repository<MaintenancePlan>,
  ) {}

  async create(createDto: CreateAlertDto): Promise<Alert> {
    const alert = this.alertRepository.create(createDto);
    return this.alertRepository.save(alert);
  }

  async findAll(
    paginationDto: PaginationDto,
    type?: AlertType,
    unreadOnly?: boolean,
  ): Promise<PaginatedResultDto<Alert>> {
    const qb = this.alertRepository.createQueryBuilder('alert');

    if (type) {
      qb.andWhere('alert.type = :type', { type });
    }
    if (unreadOnly) {
      qb.andWhere('alert.isRead = false');
      qb.andWhere('alert.isDismissed = false');
    }

    qb.orderBy('alert.createdAt', 'DESC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOne(id: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`Alerte #${id} non trouvee`);
    }
    return alert;
  }

  async update(id: string, updateDto: UpdateAlertDto): Promise<Alert> {
    const alert = await this.findOne(id);
    Object.assign(alert, updateDto);
    return this.alertRepository.save(alert);
  }

  async markRead(id: string): Promise<Alert> {
    return this.update(id, { isRead: true });
  }

  async dismiss(id: string): Promise<Alert> {
    return this.update(id, { isDismissed: true });
  }

  async remove(id: string): Promise<void> {
    const alert = await this.findOne(id);
    await this.alertRepository.remove(alert);
  }

  async getUnreadCount(): Promise<number> {
    return this.alertRepository.count({
      where: { isRead: false, isDismissed: false },
    });
  }

  // === Alert Generation (can be called by cron) ===

  async generateDocumentExpiryAlerts(): Promise<number> {
    let count = 0;
    const documents = await this.documentRepository.find({
      relations: { vehicle: true },
    });

    for (const doc of documents) {
      const alertDate = new Date(doc.expiryDate);
      alertDate.setDate(alertDate.getDate() - doc.alertDaysBefore);

      if (alertDate <= new Date()) {
        const existing = await this.alertRepository.findOne({
          where: {
            type: AlertType.DOCUMENT_EXPIRY,
            relatedEntityType: 'vehicle_document',
            relatedEntityId: doc.id,
            isDismissed: false,
          },
        });

        if (!existing) {
          const daysUntilExpiry = Math.ceil(
            (new Date(doc.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
          );
          const priority = daysUntilExpiry <= 0 ? AlertPriority.CRITIQUE
            : daysUntilExpiry <= 7 ? AlertPriority.HAUTE
            : daysUntilExpiry <= 15 ? AlertPriority.MOYENNE
            : AlertPriority.BASSE;

          await this.create({
            type: AlertType.DOCUMENT_EXPIRY,
            priority,
            title: `Document ${doc.type} - ${doc.vehicle?.code || 'N/A'}`,
            message: `Le document ${doc.type} du vehicule ${doc.vehicle?.code || 'N/A'} expire ${daysUntilExpiry <= 0 ? 'est expire' : `dans ${daysUntilExpiry} jours`}`,
            relatedEntityType: 'vehicle_document',
            relatedEntityId: doc.id,
            dueDate: new Date(doc.expiryDate).toISOString().split('T')[0],
          });
          count++;
        }
      }
    }

    this.logger.log(`Generated ${count} document expiry alerts`);
    return count;
  }

  async generateLeaseExpiryAlerts(): Promise<number> {
    let count = 0;
    const leases = await this.leaseRepository.find({
      relations: { vehicle: true },
    });

    for (const lease of leases) {
      const alertDate = new Date(lease.endDate);
      alertDate.setDate(alertDate.getDate() - lease.alertDaysBefore);

      if (alertDate <= new Date()) {
        const existing = await this.alertRepository.findOne({
          where: {
            type: AlertType.LEASE_EXPIRY,
            relatedEntityType: 'vehicle_lease',
            relatedEntityId: lease.id,
            isDismissed: false,
          },
        });

        if (!existing) {
          const daysUntilExpiry = Math.ceil(
            (new Date(lease.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
          );

          await this.create({
            type: AlertType.LEASE_EXPIRY,
            priority: daysUntilExpiry <= 30 ? AlertPriority.HAUTE : AlertPriority.MOYENNE,
            title: `Contrat location - ${lease.vehicle?.code || 'N/A'}`,
            message: `Le contrat de location ${lease.contractNumber || ''} du vehicule ${lease.vehicle?.code || 'N/A'} expire dans ${daysUntilExpiry} jours`,
            relatedEntityType: 'vehicle_lease',
            relatedEntityId: lease.id,
            dueDate: new Date(lease.endDate).toISOString().split('T')[0],
          });
          count++;
        }
      }
    }

    this.logger.log(`Generated ${count} lease expiry alerts`);
    return count;
  }

  async generateMaintenanceAlerts(): Promise<number> {
    let count = 0;
    const plans = await this.planRepository.find({
      where: { isActive: true },
      relations: { vehicle: true },
    });

    for (const plan of plans) {
      if (plan.nextDueDate && new Date(plan.nextDueDate) <= new Date()) {
        const existing = await this.alertRepository.findOne({
          where: {
            type: AlertType.MAINTENANCE_DUE,
            relatedEntityType: 'maintenance_plan',
            relatedEntityId: plan.id,
            isDismissed: false,
          },
        });

        if (!existing) {
          await this.create({
            type: AlertType.MAINTENANCE_DUE,
            priority: AlertPriority.HAUTE,
            title: `Maintenance due - ${plan.vehicle?.code || 'N/A'}`,
            message: `La maintenance "${plan.title}" du vehicule ${plan.vehicle?.code || 'N/A'} est due`,
            relatedEntityType: 'maintenance_plan',
            relatedEntityId: plan.id,
            dueDate: new Date(plan.nextDueDate).toISOString().split('T')[0],
          });
          count++;
        }
      }
    }

    this.logger.log(`Generated ${count} maintenance alerts`);
    return count;
  }

  async runAllAlertChecks(): Promise<{ documents: number; leases: number; maintenance: number }> {
    const documents = await this.generateDocumentExpiryAlerts();
    const leases = await this.generateLeaseExpiryAlerts();
    const maintenance = await this.generateMaintenanceAlerts();
    return { documents, leases, maintenance };
  }
}
