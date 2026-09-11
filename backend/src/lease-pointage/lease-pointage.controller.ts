import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeasePointageService } from './lease-pointage.service';
import { LeasePointage } from './lease-pointage.entity';

@ApiTags('LeasePointage')
@Controller('lease-pointage')
export class LeasePointageController {
  constructor(private readonly service: LeasePointageService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put('bulk')
  replaceAll(@Body() body: Partial<LeasePointage>[]) {
    return this.service.replaceAll(body);
  }

  /** Saisie rapide : cree/maj/supprime plusieurs pointages en une requete. */
  @Post('upsert-many')
  upsertMany(@Body() body: { vehicleCode: string; date: string; fraction: number; notes?: string }[]) {
    return this.service.upsertMany(body ?? []);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<LeasePointage>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<LeasePointage>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
