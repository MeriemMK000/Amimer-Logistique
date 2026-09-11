import { Global, Module } from '@nestjs/common';
import { DependencyService } from './dependency.service';

@Global()
@Module({
  providers: [DependencyService],
  exports: [DependencyService],
})
export class CommonModule {}
