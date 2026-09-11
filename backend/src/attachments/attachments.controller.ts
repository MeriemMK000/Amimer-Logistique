import {
  Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AttachmentsService, UPLOAD_DIR } from './attachments.service';

@ApiTags('Attachments')
@Controller()
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get('attachments')
  list(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string) {
    return this.service.list(entityType, entityId);
  }

  @Post('attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname) || ''}`),
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { entityType: string; entityId: string; kind?: string; note?: string },
  ) {
    if (!file) throw new NotFoundException('Aucun fichier');
    return this.service.record({
      entityType: body.entityType,
      entityId: body.entityId,
      kind: body.kind,
      note: body.note,
      filename: file.originalname,
      storedName: file.filename,
      mime: file.mimetype,
      size: file.size,
    });
  }

  @Delete('attachments/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  /** Telechargement / affichage du fichier. */
  @Get('files/:id')
  async serve(@Param('id') id: string, @Res() res: Response) {
    const a = await this.service.findOne(id);
    const p = join(UPLOAD_DIR, a.storedName);
    if (!existsSync(p)) throw new NotFoundException('Fichier absent du disque');
    if (a.mime) res.type(a.mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(a.filename)}"`);
    res.sendFile(p);
  }
}
