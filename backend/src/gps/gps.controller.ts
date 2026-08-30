import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GpsService, RoutePoint } from './gps.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('GPS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gps')
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Post('distance')
  @ApiOperation({ summary: 'Calculer la distance entre deux points' })
  calculateDistance(
    @Body() body: {
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
    },
  ) {
    return this.gpsService.calculateDistance(
      body.originLat,
      body.originLng,
      body.destLat,
      body.destLng,
    );
  }

  @Post('route')
  @ApiOperation({ summary: 'Planifier un itineraire avec points de passage' })
  planRoute(@Body() body: { waypoints: RoutePoint[] }) {
    return this.gpsService.planRoute(body.waypoints);
  }
}
