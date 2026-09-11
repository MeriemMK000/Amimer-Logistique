import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessTokenService } from '../access-tokens/access-tokens.service';
import { MissionService } from '../missions/missions.service';
import { MaintenanceOrderService } from '../maintenance-orders/maintenance-orders.service';
import { Mission } from '../missions/missions.entity';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { Attachment } from '../attachments/attachment.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';
import { TireMovement } from '../tires/tire-movement.entity';
import { TiresService } from '../tires/tires.service';
import { FuelControlService } from '../fuel-control/fuel-control.service';

/**
 * API de l'app chauffeur (PWA, lien magique `/chauffeur/<token>`).
 * Aucun compte : le token `access_tokens` (kind=driver) identifie le chauffeur.
 */
@ApiTags('DriverApp')
@Controller('driver')
export class DriverAppController {
  constructor(
    private readonly tokens: AccessTokenService,
    private readonly missionService: MissionService,
    private readonly otService: MaintenanceOrderService,
    private readonly tiresService: TiresService,
    private readonly fuelControl: FuelControlService,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Attachment) private readonly attachments: Repository<Attachment>,
    @InjectRepository(MaintenanceOrder) private readonly ots: Repository<MaintenanceOrder>,
    @InjectRepository(TireMovement) private readonly tireMoves: Repository<TireMovement>,
  ) {}

  private async driverOf(token: string): Promise<Driver | null> {
    const t = await this.tokens.resolve(token, 'driver');
    await this.tokens.touch(token);
    if (!t.subjectCode) return null;
    return this.drivers.findOne({ where: { code: t.subjectCode as never } });
  }

  @Get(':token')
  async me(@Param('token') token: string) {
    const driver = await this.driverOf(token);
    const all = await this.missions.find();
    const mine = all
      .filter((m) => m.driverCode === driver?.code && m.status !== 'ANNULEE' && m.status !== 'CLOTUREE')
      .sort((a, b) => (a.dateStart ?? '').localeCompare(b.dateStart ?? ''));

    // Vehicules dont ce chauffeur est le detenteur (+ vehicule de ses missions en cours).
    const heldCodes = new Set<string>();
    (await this.vehicles.find())
      .filter((v) => v.driverCode === driver?.code)
      .forEach((v) => heldCodes.add(v.code));
    mine.filter((m) => m.status === 'EN_COURS' && m.vehicleCode).forEach((m) => heldCodes.add(m.vehicleCode!));

    // Interventions sur ces vehicules a valider par le detenteur.
    const otAll = await this.ots.find();
    const otToValidate = otAll
      .filter((o) => o.vehicleCode && heldCodes.has(o.vehicleCode) && !o.holderValidated && o.status !== 'annule')
      .map((o) => ({ num: o.num, vehicleCode: o.vehicleCode, title: o.title, type: o.type, status: o.status, date: o.date, totalCost: o.totalCost }));

    const tireMovesAll = await this.tireMoves.find({ order: { date: 'DESC' } });
    const tireToValidate = tireMovesAll
      .filter((mv) => mv.holderValidated === false && mv.toVehicle && heldCodes.has(mv.toVehicle))
      .map((mv) => ({ id: mv.id, type: mv.type, toVehicle: mv.toVehicle, fromVehicle: mv.fromVehicle, position: mv.position, date: mv.date, km: mv.km }));

    // Demandes de relevé km à saisir par le chauffeur (véhicules détenus).
    const kmPending = await this.fuelControl.pendingRequestsForVehicles([...heldCodes]);
    const allVeh = await this.vehicles.find();
    const kmRequests = kmPending.map((r) => {
      const veh = allVeh.find((v) => v.code === r.vehicleCode);
      const isEngin = veh?.type === 'ENGIN';
      const openingDone = (r.kmStart != null || r.hoursStart != null) && r.tankStart != null;
      const closingDone = (r.kmEnd != null || r.hoursEnd != null) && r.tankEnd != null;
      return {
        vehicleCode: r.vehicleCode, month: r.month, isEngin, requestedAt: r.requestedAt,
        // 2 étapes distinctes (retour DG)
        debut: { valeur: isEngin ? r.hoursStart : r.kmStart, reservoir: r.tankStart, fait: openingDone },
        fin: { valeur: isEngin ? r.hoursEnd : r.kmEnd, reservoir: r.tankEnd, fait: closingDone },
        // rétro-compat
        kmStart: r.kmStart, hoursStart: r.hoursStart,
      };
    });

    return {
      driver: driver
        ? {
            code: driver.code,
            name: driver.name,
            status: driver.status,
            plan: driver.plan ?? [],       // planning hebdo : [{t, h1, h2}] par jour (Dim..Sam)
            hoursWeek: driver.hoursWeek,
            maxWeeklyHours: driver.maxWeeklyHours,
            workLocation: driver.workLocation,
            vehicles: [...heldCodes],
          }
        : null,
      missions: mine,
      interventions: { maintenance: otToValidate, tires: tireToValidate },
      kmRequests,
    };
  }

  /**
   * Le chauffeur déclare un relevé (retour DG : 2 étapes distinctes) —
   *   phase 'debut' → km/heures + réservoir de DÉBUT de mois
   *   phase 'fin'   → km/heures + réservoir de FIN de mois
   * (rétro-compat : sans `phase`, un `kmEnd`/`hoursEnd` seul = relevé de fin.)
   */
  @Patch(':token/km-declaration')
  async kmDeclaration(
    @Param('token') token: string,
    @Body() body: {
      vehicleCode: string; month: string; phase?: 'debut' | 'fin';
      km?: number; hours?: number; tank?: number;
      kmEnd?: number; hoursEnd?: number; photoId?: string;
    },
  ) {
    const d = await this.driverOf(token);
    const by = d?.name ?? d?.code ?? 'chauffeur';
    const num = (x: unknown) => (x == null || x === '' ? null : Number(x) || null);
    if (body.phase === 'debut') {
      return this.fuelControl.upsertReading({
        vehicleCode: body.vehicleCode, month: body.month,
        kmStart: num(body.km), hoursStart: num(body.hours), tankStart: num(body.tank),
        photoId: body.photoId ?? null, declaredBy: by,
      });
    }
    if (body.phase === 'fin') {
      return this.fuelControl.upsertReading({
        vehicleCode: body.vehicleCode, month: body.month,
        kmEnd: num(body.km), hoursEnd: num(body.hours), tankEnd: num(body.tank),
        photoId: body.photoId ?? null, declaredBy: by, status: 'done',
      });
    }
    return this.fuelControl.declareKm(body.vehicleCode, body.month, Number(body.kmEnd) || 0, {
      hoursEnd: body.hoursEnd != null ? Number(body.hoursEnd) : undefined,
      photoId: body.photoId, by,
    });
  }

  /** Le detenteur valide une intervention (maintenance) sur son vehicule. */
  @Patch(':token/ot/:num/validate')
  async validateOt(@Param('token') token: string, @Param('num') num: string) {
    const d = await this.driverOf(token);
    return this.otService.holderValidate(num, d?.name ?? d?.code ?? 'detenteur');
  }

  /** Le detenteur valide un montage / transfert de pneu sur son vehicule. */
  @Patch(':token/tire-movement/:id/validate')
  async validateTireMove(@Param('token') token: string, @Param('id') id: string) {
    const d = await this.driverOf(token);
    return this.tiresService.holderValidateMovement(id, d?.name ?? d?.code ?? 'detenteur');
  }

  /** Le chauffeur valide (accepte) une mission planifiee depuis son telephone. */
  @Patch(':token/missions/:num/accept')
  async accept(@Param('token') token: string, @Param('num') num: string) {
    await this.driverOf(token);
    const m = await this.missions.findOne({ where: { num: num as never } });
    if (!m) return { ok: false };
    m.driverAccepted = true;
    m.driverAcceptedAt = new Date().toISOString();
    await this.missions.save(m);
    return { ok: true, mission: m };
  }

  /** Ordre de mission (retour DG : le chauffeur le reçoit systématiquement au démarrage). */
  @Get(':token/missions/:num/ordre')
  async ordre(@Param('token') token: string, @Param('num') num: string) {
    const d = await this.driverOf(token);
    const m = await this.missions.findOne({ where: { num: num as never } });
    if (!m || m.driverCode !== d?.code) return { ok: false };
    return this.missionService.ordreDeMission(num);
  }

  @Patch(':token/missions/:num/start')
  async start(@Param('token') token: string, @Param('num') num: string) {
    await this.driverOf(token);
    return this.missionService.setPhase(num, 'start');
  }

  @Patch(':token/missions/:num/finish')
  async finish(@Param('token') token: string, @Param('num') num: string) {
    await this.driverOf(token);
    return this.missionService.setPhase(num, 'finish');
  }

  /**
   * Déclaration de panne / anomalie (mémo vocal + photos + texte optionnel — certains
   * chauffeurs ne savent pas écrire). Crée un OT `ouvert` + relie les pièces jointes.
   */
  @Post(':token/declaration')
  async declaration(
    @Param('token') token: string,
    @Body() body: { vehicleCode?: string; missionNum?: string; text?: string; attachmentIds?: string[]; kind?: string },
  ) {
    const driver = await this.driverOf(token);
    let vehicleCode = body.vehicleCode
      ?? (body.missionNum ? (await this.missions.findOne({ where: { num: body.missionNum as never } }))?.vehicleCode : null)
      ?? null;
    // Repli : véhicule détenu par le chauffeur (une déclaration de panne exige un véhicule).
    if (!vehicleCode && driver) {
      vehicleCode = (await this.vehicles.findOne({ where: { driverCode: driver.code as never } }))?.code ?? null;
    }
    if (!vehicleCode) return { ok: false, message: 'Aucun véhicule associé à cette déclaration.' };

    const num = `OT-${new Date().getFullYear()}-${String((await this.ots.count()) + 1).padStart(4, '0')}`;
    const ot = await this.otService.create({
      num,
      date: new Date().toISOString().slice(0, 10),
      vehicleCode,
      title: body.kind === 'anomalie' ? 'Anomalie signalée (chauffeur)' : 'Panne déclarée (chauffeur)',
      type: 'curatif',
      status: 'ouvert',
      description: body.text || 'Déclaration vocale / photo — voir pièces jointes.',
      sourceDeclarationId: token.slice(0, 8),
      declaredBy: driver?.name ?? driver?.code ?? 'chauffeur',
    } as never);

    for (const aid of body.attachmentIds ?? []) {
      await this.attachments.update({ id: aid as never }, { entityType: 'maintenance-order', entityId: ot.num });
    }
    return { ot };
  }
}
