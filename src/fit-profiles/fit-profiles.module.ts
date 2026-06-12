import { Module } from '@nestjs/common';
import { FitProfilesService } from './fit-profiles.service';
import { FitProfilesController } from './fit-profiles.controller';

@Module({
  controllers: [FitProfilesController],
  providers: [FitProfilesService],
  exports: [FitProfilesService],
})
export class FitProfilesModule {}
