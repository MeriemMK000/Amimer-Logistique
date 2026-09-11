import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { MailService } from '../mail/mail.service';

export interface NotifyInput {
  audience: 'requester' | 'driver' | 'office';
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  kind: string;
  subject: string;
  body: string;
  missionRef?: string | null;
  link?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    private readonly mail: MailService,
  ) {}

  findAll(filter?: { audience?: string; missionRef?: string }): Promise<Notification[]> {
    const where: Record<string, unknown> = {};
    if (filter?.audience) where.audience = filter.audience;
    if (filter?.missionRef) where.missionRef = filter.missionRef;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async markRead(id: string): Promise<Notification> {
    await this.repo.update({ id: id as never }, { read: true });
    return this.repo.findOne({ where: { id: id as never } }) as Promise<Notification>;
  }

  /** Enregistre la notification + tente l'envoi email si une adresse est fournie. */
  async notify(input: NotifyInput): Promise<Notification> {
    const row = this.repo.create({
      audience: input.audience,
      recipientName: input.recipientName ?? null,
      recipientEmail: input.recipientEmail ?? null,
      recipientPhone: input.recipientPhone ?? null,
      kind: input.kind,
      subject: input.subject,
      body: input.body,
      missionRef: input.missionRef ?? null,
      link: input.link ?? null,
      read: false,
      emailStatus: 'pending',
    });
    if (input.recipientEmail) {
      try {
        const r = await this.mail.send({
          to: input.recipientEmail,
          subject: input.subject,
          text: input.body + (input.link ? `\n\nSuivi : ${input.link}` : ''),
        });
        row.emailStatus = r.sent ? 'sent' : 'skipped';
      } catch (e) {
        this.logger.warn(`notify: échec email — ${String(e)}`);
        row.emailStatus = 'failed';
      }
    } else {
      row.emailStatus = 'skipped';
    }
    return this.repo.save(row);
  }
}
