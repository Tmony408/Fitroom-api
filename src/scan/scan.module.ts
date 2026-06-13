import { Module } from '@nestjs/common';
import { ScanService } from './scan.service';
import { ScanController } from './scan.controller';
import { MeasurementEstimatorService } from './measurement-estimator.service';

@Module({
  controllers: [ScanController],
  providers: [ScanService, MeasurementEstimatorService],
  exports: [ScanService],
})
export class ScanModule {}
