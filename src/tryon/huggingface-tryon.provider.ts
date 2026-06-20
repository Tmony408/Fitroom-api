import { BadGatewayException, Logger } from '@nestjs/common';
import { TryOnInput, TryOnProvider, TryOnResult } from './tryon-provider.interface';

/**
 * FREE virtual try-on via a Hugging Face Gradio Space (no per-image cost,
 * but rate-limited / queued — good for MVP + testing, not heavy scale).
 *
 * Defaults to the Kolors space. Configure via env:
 *   TRYON_HF_SPACE     (default 'Kwai-Kolors/Kolors-Virtual-Try-On')
 *   TRYON_HF_ENDPOINT  (default '/tryon')
 *   HF_TOKEN           free token from huggingface.co/settings/tokens (read)
 *
 * Spaces differ in their predict() signature. If you switch spaces, open the
 * Space → "Use via API" to see the endpoint name + argument order, and adjust
 * TRYON_HF_ENDPOINT / the `args` below. This provider is intentionally
 * defensive: any failure surfaces a clear 502 rather than crashing.
 */
export class HuggingFaceTryOnProvider implements TryOnProvider {
  readonly name = 'huggingface';
  private readonly log = new Logger('HuggingFaceTryOn');

  constructor(
    private readonly space: string,
    private readonly token?: string,
    private readonly endpoint = '/tryon',
  ) {}

  private async toBlob(img: string): Promise<Blob> {
    if (/^https?:\/\//i.test(img)) {
      const r = await fetch(img);
      if (!r.ok) throw new Error(`could not fetch image (${r.status})`);
      return await r.blob();
    }
    const m = img.match(/^data:(.+?);base64,(.*)$/s);
    const b64 = m ? m[2] : img;
    const mime = m ? m[1] : 'image/jpeg';
    const buf = Buffer.from(b64, 'base64');
    return new Blob([buf], { type: mime });
  }

  async generate(input: TryOnInput): Promise<TryOnResult> {
    try {
      // dynamic import: @gradio/client is ESM-only (resolved after `npm install`)
      // @ts-ignore - module types available once the dependency is installed
      const { Client } = await import('@gradio/client');
      const app = await Client.connect(
        this.space,
        this.token ? { hf_token: this.token as `hf_${string}` } : {},
      );

      const person = await this.toBlob(input.personImage);
      const garment = await this.toBlob(input.garmentImage);

      // Kolors signature: [person_img, garment_img, seed, randomize_seed]
      const result = await app.predict(this.endpoint, [person, garment, 0, true]);

      const data = (result as { data?: unknown }).data;
      const first = Array.isArray(data) ? data[0] : data;
      const url =
        (first as { url?: string })?.url ??
        (first as { path?: string })?.path ??
        (typeof first === 'string' ? first : undefined);

      if (!url) throw new Error('space returned no image');
      return { imageUrl: url, provider: this.name };
    } catch (e) {
      this.log.error(`try-on via ${this.space} failed: ${(e as Error).message}`);
      throw new BadGatewayException(
        `Try-on service is busy or unavailable (${(e as Error).message}). ` +
          'Free Hugging Face Spaces are rate-limited — try again shortly.',
      );
    }
  }
}
