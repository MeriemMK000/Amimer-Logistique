import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Envoi d'emails (notifications assurance, PEC, etc.).
 * Config via .env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Si aucun SMTP n'est configuré (dev / on-premise sans relais), les messages sont journalisés.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
  }

  get enabled(): boolean {
    return this.transporter != null;
  }

  async send(opts: { to: string; subject: string; text?: string; html?: string }): Promise<{ sent: boolean }> {
    const from = process.env.SMTP_FROM ?? 'fleetpro@amimer-logistique.local';
    if (!this.transporter) {
      this.logger.log(`[MAIL DÉSACTIVÉ] à ${opts.to} — ${opts.subject}\n${opts.text ?? opts.html ?? ''}`);
      return { sent: false };
    }
    try {
      await this.transporter.sendMail({ from, ...opts });
      return { sent: true };
    } catch (e) {
      this.logger.warn(`Échec envoi email : ${String(e)}`);
      return { sent: false };
    }
  }
}
