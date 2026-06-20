/**
 * 2D AI virtual try-on seam. Swap providers via env without touching the
 * service/controller:
 *   - `mock`        — no AI, echoes an image so the flow is testable with no key.
 *   - `huggingface` — FREE: calls a Hugging Face Space (e.g. Kolors / IDM-VTON).
 *   - (later) a paid API (FASHN/fal) implements the same interface.
 */
export interface TryOnInput {
  /** Photo of the person — data URL, raw base64, or an http(s) URL. */
  personImage: string;
  /** Garment image (the product being customised) — same accepted formats. */
  garmentImage: string;
  /** Optional hint, e.g. "Agbada", for providers that use it. */
  category?: string;
}

export interface TryOnResult {
  /** Result as a data URL (mock / inlined) … */
  imageDataUrl?: string;
  /** … or a hosted URL (provider output). One of the two is always set. */
  imageUrl?: string;
  provider: string;
  /** Optional human-readable note (e.g. mock explanation). */
  note?: string;
}

export interface TryOnProvider {
  readonly name: string;
  generate(input: TryOnInput): Promise<TryOnResult>;
}

export const TRYON_PROVIDER = Symbol('TRYON_PROVIDER');
