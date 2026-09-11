import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessToken } from './access-tokens.entity';
import { AccessTokenService } from './access-tokens.service';
import { AccessTokenController } from './access-tokens.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AccessToken])],
  controllers: [AccessTokenController],
  providers: [AccessTokenService],
  exports: [AccessTokenService],
})
export class AccessTokenModule {}
