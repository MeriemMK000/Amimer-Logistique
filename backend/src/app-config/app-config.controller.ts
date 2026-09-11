import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';

@ApiTags('AppConfig')
@Controller('config')
export class AppConfigController {
  constructor(private readonly service: AppConfigService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':key')
  get(@Param('key') key: string) {
    return this.service.get(key);
  }

  @Put(':key')
  set(@Param('key') key: string, @Body() body: unknown) {
    // Accepte n'importe quelle valeur JSON (objet, tableau, nombre) sous { value: ... } ou brut
    const value =
      body && typeof body === 'object' && 'value' in (body as Record<string, unknown>)
        ? (body as Record<string, unknown>).value
        : body;
    return this.service.set(key, value);
  }
}
