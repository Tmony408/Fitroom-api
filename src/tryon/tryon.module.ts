import { Module } from '@nestjs/common';
import { TryOnController } from './tryon.controller';
import { TryOnService } from './tryon.service';
import { TRYON_PROVIDER, TryOnProvider } from './tryon-provider.interface';
import { MockTryOnProvider } from './mock-tryon.provider';
import { HuggingFaceTryOnProvider } from './huggingface-tryon.provider';

/**
 * Provider is chosen from env at boot:
 *   - TRYON_PROVIDER=huggingface (or just having HF_TOKEN set) → free HF Space.
 *   - otherwise → mock (flow works with no key).
 */
const tryOnProvider = {
  provide: TRYON_PROVIDER,
  useFactory: (): TryOnProvider => {
    const explicit = process.env.TRYON_PROVIDER;
    const token = process.env.HF_TOKEN;
    if (explicit === 'huggingface' || (!explicit && token)) {
      const space = process.env.TRYON_HF_SPACE || 'Kwai-Kolors/Kolors-Virtual-Try-On';
      const endpoint = process.env.TRYON_HF_ENDPOINT || '/tryon';
      return new HuggingFaceTryOnProvider(space, token, endpoint);
    }
    return new MockTryOnProvider();
  },
};

@Module({
  controllers: [TryOnController],
  providers: [TryOnService, tryOnProvider],
})
export class TryOnModule {}
