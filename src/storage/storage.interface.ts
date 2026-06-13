export interface StoredObject {
  key: string;
  mime: string;
  size: number;
}

/**
 * Storage seam. LocalStorageService (disk) is the dev default; an
 * S3StorageService can implement the same interface for production — the rest
 * of the app never changes. Selected via STORAGE_DRIVER env.
 */
export interface StorageService {
  put(key: string, data: Buffer, mime: string): Promise<StoredObject>;
  get(key: string): Promise<{ data: Buffer; mime: string }>;
  remove(key: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
}

export const STORAGE = Symbol('STORAGE');
