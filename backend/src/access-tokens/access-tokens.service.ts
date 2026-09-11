import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { AccessToken } from './access-tokens.entity';

@Injectable()
export class AccessTokenService {
  constructor(
    @InjectRepository(AccessToken) private readonly repo: Repository<AccessToken>,
  ) {}

  findAll(): Promise<AccessToken[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  /** Émet un lien magique. Réutilise un token actif existant pour le même sujet. */
  async issue(kind: 'driver' | 'pec', subjectCode?: string, label?: string, days = 30): Promise<AccessToken> {
    if (subjectCode) {
      const existing = await this.repo.findOne({ where: { kind, subjectCode, active: true } });
      if (existing) return existing;
    }
    const token = randomBytes(18).toString('hex');
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    return this.repo.save(this.repo.create({ token, kind, subjectCode: subjectCode ?? null, label: label ?? null, expiresAt, active: true }));
  }

  /** Valide un token et renvoie la ligne, ou 403. */
  async resolve(token: string, kind?: string): Promise<AccessToken> {
    const row = await this.repo.findOne({ where: { token } });
    if (!row || !row.active) throw new ForbiddenException('Lien invalide ou révoqué');
    if (kind && row.kind !== kind) throw new ForbiddenException('Lien invalide');
    if (row.expiresAt && row.expiresAt < new Date().toISOString().slice(0, 10)) throw new ForbiddenException('Lien expiré');
    return row;
  }

  async touch(token: string): Promise<void> {
    await this.repo.update({ token }, { usedAt: new Date().toISOString() });
  }

  async revoke(id: string): Promise<{ revoked: true }> {
    await this.repo.update({ id }, { active: false });
    return { revoked: true };
  }
}
