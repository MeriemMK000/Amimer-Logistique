import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GpsService } from './gps.service';

@ApiTags('GPS')
@Controller('gps')
export class GpsController {
  constructor(private readonly service: GpsService) {}

  @Get('positions')
  positions(@Query('includePlanned') includePlanned?: string) {
    return this.service.positions(includePlanned === 'true');
  }

  @Post('nearest')
  nearest(@Body() body: { location: string; limit?: number }) {
    return this.service.nearest(body?.location ?? '', body?.limit ?? 5);
  }
}
