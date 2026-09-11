import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GeoService, GeoPoint } from './geo.service';

@ApiTags('Geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly service: GeoService) {}

  /** Distance routière d'un itinéraire — points = coordonnées { lat, lon } et/ou libellés (villes / adresses). */
  @Post('route')
  route(@Body() body: { points: Array<GeoPoint | string> }) {
    return this.service.routeNamed(body?.points ?? []);
  }

  /** Résout une adresse / un lieu → coordonnées (référentiel local, puis géocodage si activé). */
  @Get('geocode')
  geocode(@Query('q') q: string) {
    return this.service.geocode(q ?? '');
  }

  /** Autocomplete de lieu « type carte » : communes + rues / quartiers / zones via OSM. */
  @Get('suggest')
  suggest(@Query('q') q: string, @Query('lat') lat?: string, @Query('lon') lon?: string) {
    return this.service.suggest(q ?? '', { lat: lat ? Number(lat) : undefined, lon: lon ? Number(lon) : undefined });
  }
}
