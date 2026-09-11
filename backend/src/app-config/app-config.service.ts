import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigEntry } from './app-config.entity';

@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(AppConfigEntry)
    private readonly repo: Repository<AppConfigEntry>,
  ) {}

  async findAll(): Promise<Record<string, unknown>> {
    const rows = await this.repo.find();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async get(key: string): Promise<unknown> {
    const row = await this.repo.findOne({ where: { key } });
    return row ? row.value : null;
  }

  async set(key: string, value: unknown): Promise<AppConfigEntry> {
    return this.repo.save(this.repo.create({ key, value }));
  }
}
