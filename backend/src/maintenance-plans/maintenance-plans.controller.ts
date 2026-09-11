import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MaintenancePlansService } from './maintenance-plans.service';
import { MaintenancePlan } from './maintenance-plan.entity';
import { VehicleMaintenancePlan } from './vehicle-maintenance-plan.entity';

@ApiTags('MaintenancePlans')
@Controller('maintenance-plans')
export class MaintenancePlansController {
  constructor(private readonly service: MaintenancePlansService) {}

  @Get()
  findAll() {
    return this.service.findAllPlans();
  }

  @Get('due')
  due() {
    return this.service.computeDue();
  }

  @Get('links')
  links() {
    return this.service.findAllLinks();
  }

  @Post()
  create(@Body() body: Partial<MaintenancePlan>) {
    return this.service.createPlan(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<MaintenancePlan>) {
    return this.service.updatePlan(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.removePlan(id);
  }

  @Post('links')
  createLink(@Body() body: Partial<VehicleMaintenancePlan>) {
    return this.service.createLink(body);
  }

  @Patch('links/:id')
  updateLink(@Param('id') id: string, @Body() body: Partial<VehicleMaintenancePlan>) {
    return this.service.updateLink(id, body);
  }

  @Delete('links/:id')
  removeLink(@Param('id') id: string) {
    return this.service.removeLink(id);
  }
}
