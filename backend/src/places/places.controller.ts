import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlacesService } from './places.service';

@ApiTags('Place')
@Controller('places')
export class PlacesController {
  constructor(private readonly service: PlacesService) {}

  @Get()
  list(@Query('q') q?: string) {
    return q ? this.service.search(q) : this.service.findAll();
  }

  @Post()
  create(@Body() body: { name: string; lat: number; lon: number; wilaya?: string; kind?: string; source?: string }) {
    return this.service.create({
      name: body.name,
      lat: Number(body.lat),
      lon: Number(body.lon),
      wilaya: body.wilaya ?? null,
      kind: body.kind,
      source: body.source ?? 'manual',
    });
  }
}
