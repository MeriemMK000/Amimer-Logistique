import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TiresService } from './tires.service';
import { Tire } from './tire.entity';

@ApiTags('Tires')
@Controller('tires')
export class TiresController {
  constructor(private readonly service: TiresService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('inventory')
  inventory() {
    return this.service.inventory();
  }

  @Get('movements')
  movements(@Query('tireId') tireId?: string) {
    return this.service.movements(tireId);
  }

  @Post()
  create(@Body() body: Partial<Tire>) {
    return this.service.create(body);
  }

  @Post(':id/move')
  move(@Param('id') id: string, @Body() body: Record<string, string | number>) {
    return this.service.move(id, body as never);
  }

  /** Montage groupé à la mise en service d'un véhicule. */
  @Post('mount-set')
  mountSet(@Body() body: { vehicleCode: string; tires: { position: string; reference: string; serialNumber?: string; brand?: string; dimensions?: string; km?: number }[] }) {
    return this.service.mountSet(body.vehicleCode, body.tires ?? []);
  }

  @Patch('movements/:mvId/holder-validate')
  holderValidateMovement(@Param('mvId') mvId: string, @Body() body: { by?: string }) {
    return this.service.holderValidateMovement(mvId, body?.by);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<Tire>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
