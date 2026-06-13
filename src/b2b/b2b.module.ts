import { Module } from '@nestjs/common';
import { FitModule } from '../fit/fit.module';
import { B2bService } from './b2b.service';
import { B2bController } from './b2b.controller';
import { WidgetController } from './widget.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [FitModule],
  controllers: [B2bController, WidgetController],
  providers: [B2bService, ApiKeysService, ApiKeyGuard],
})
export class B2bModule {}
