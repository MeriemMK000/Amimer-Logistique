import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tire } from './tire.entity';
import { TireMovement } from './tire-movement.entity';
import { TiresService } from './tires.service';
import { TiresController } from './tires.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tire, TireMovement])],
  controllers: [TiresController],
  providers: [TiresService],
  exports: [TiresService],
})
export class TiresModule {}
