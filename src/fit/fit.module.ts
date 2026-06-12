import { Module } from '@nestjs/common';
import { FitService } from './fit.service';
import { FitController } from './fit.controller';

@Module({
  controllers: [FitController],
  providers: [FitService],
  exports: [FitService],
})
export class FitModule {}
