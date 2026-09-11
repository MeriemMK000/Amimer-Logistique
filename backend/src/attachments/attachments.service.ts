import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Attachment } from './attachment.entity';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment) private readonly repo: Repository<Attachment>,
  ) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  list(entityType?: string, entityId?: string): Promise<Attachment[]> {
    const where: Record<string, string> = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    return this.repo.find({ where, order: { uploadedAt: 'DESC' } });
  }

  async record(data: {
    entityType: string; entityId: string; kind?: string;
    filename: string; storedName: string; mime?: string; size?: number; note?: string;
  }): Promise<Attachment> {
    return this.repo.save(this.repo.create({ kind: 'doc', ...data }));
  }

  async findOne(id: string): Promise<Attachment> {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Piece jointe introuvable');
    return a;
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const a = await this.findOne(id);
    try { fs.unlinkSync(path.join(UPLOAD_DIR, a.storedName)); } catch { /* fichier deja absent */ }
    await this.repo.delete(id);
    return { deleted: true };
  }
}
