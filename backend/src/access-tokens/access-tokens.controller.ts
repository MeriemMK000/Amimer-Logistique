import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccessTokenService } from './access-tokens.service';

@ApiTags('AccessToken')
@Controller('access-tokens')
export class AccessTokenController {
  constructor(private readonly service: AccessTokenService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  issue(@Body() body: { kind: 'driver' | 'pec'; subjectCode?: string; label?: string; days?: number }) {
    return this.service.issue(body.kind, body.subjectCode, body.label, body.days);
  }

  @Delete(':id')
  revoke(@Param('id') id: string) {
    return this.service.revoke(id);
  }
}
