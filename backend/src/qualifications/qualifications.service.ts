import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Qualification } from './qualifications.entity';
import { requireFields } from '../common/require-fields';

@Injectable()
export class QualificationService {
  constructor(@InjectRepository(Qualification) private readonly repo: Repository<Qualification>) {}
  findAll() { return this.repo.find(); }
  async findOne(id: string) { const r = await this.repo.findOne({ where: { code: id as never } }); if (!r) throw new NotFoundException('Qualification introuvable'); return r; }
  create(data: Partial<Qualification>) {
    requireFields(data as Record<string, unknown>, [{ key: 'code', label: 'code' }, { key: 'label', label: 'libellé' }]);
    return this.repo.save(this.repo.create(data));
  }
  async update(id: string, data: Partial<Qualification>) { const r = await this.findOne(id); Object.assign(r, data); return this.repo.save(r); }
  async remove(id: string) { await this.findOne(id); await this.repo.delete(id); return { deleted: true }; }
}
