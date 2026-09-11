import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from './evaluations.entity';
import { requireFields } from '../common/require-fields';

@Injectable()
export class EvaluationService {
  constructor(@InjectRepository(Evaluation) private readonly repo: Repository<Evaluation>) {}
  findAll() { return this.repo.find(); }
  async findOne(id: string) { const r = await this.repo.findOne({ where: { id: id as never } }); if (!r) throw new NotFoundException('Evaluation introuvable'); return r; }
  create(data: Partial<Evaluation>) {
    requireFields(data as Record<string, unknown>, [
      { key: 'subjectType', label: 'type (véhicule / chauffeur)' },
      { key: 'subjectCode', label: 'sujet évalué' },
      { key: 'date', label: 'date' },
    ]);
    return this.repo.save(this.repo.create(data));
  }
  async update(id: string, data: Partial<Evaluation>) { const r = await this.findOne(id); Object.assign(r, data); return this.repo.save(r); }
  async remove(id: string) { await this.findOne(id); await this.repo.delete(id); return { deleted: true }; }
}
