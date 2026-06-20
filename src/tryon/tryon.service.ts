import { Inject, Injectable } from '@nestjs/common';
import { TRYON_PROVIDER, TryOnInput, TryOnProvider } from './tryon-provider.interface';

@Injectable()
export class TryOnService {
  constructor(@Inject(TRYON_PROVIDER) private readonly provider: TryOnProvider) {}

  generate(input: TryOnInput) {
    return this.provider.generate(input);
  }

  get providerName(): string {
    return this.provider.name;
  }
}
