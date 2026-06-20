import { TryOnInput, TryOnProvider, TryOnResult } from './tryon-provider.interface';

/**
 * Dev/test provider — runs no AI, so the whole try-on flow works with no key
 * and no credits. It simply echoes the person photo back, with a note. Set
 * HF_TOKEN (and TRYON_PROVIDER=huggingface) to get a real, free try-on.
 */
export class MockTryOnProvider implements TryOnProvider {
  readonly name = 'mock';

  async generate(input: TryOnInput): Promise<TryOnResult> {
    const img = input.personImage || input.garmentImage;
    const isData = img.startsWith('data:');
    return {
      [isData ? 'imageDataUrl' : 'imageUrl']: img,
      provider: this.name,
      note:
        'Mock try-on (no AI). Add a free Hugging Face token (HF_TOKEN) and set ' +
        'TRYON_PROVIDER=huggingface to generate a real try-on image for free.',
    } as TryOnResult;
  }
}
