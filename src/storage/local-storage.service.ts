import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageService, StoredObject } from './storage.interface';

/**
 * Disk-backed storage for local/dev. Files live under STORAGE_DIR (default
 * ./storage). Production swaps in an S3 implementation of StorageService with
 * no other code changes.
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly root = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');

  private full(key: string): string {
    // prevent path traversal
    const safe = key.replace(/\.\.(\/|\\)/g, '');
    return path.join(this.root, safe);
  }

  async put(key: string, data: Buffer, mime: string): Promise<StoredObject> {
    const file = this.full(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    await fs.writeFile(file + '.mime', mime);
    return { key, mime, size: data.length };
  }

  async get(key: string): Promise<{ data: Buffer; mime: string }> {
    const file = this.full(key);
    try {
      const data = await fs.readFile(file);
      const mime = await fs.readFile(file + '.mime', 'utf8').catch(() => 'application/octet-stream');
      return { data, mime };
    } catch {
      throw new NotFoundException('Object not found');
    }
  }

  async remove(key: string): Promise<void> {
    const file = this.full(key);
    await fs.rm(file, { force: true });
    await fs.rm(file + '.mime', { force: true });
  }

  async removePrefix(prefix: string): Promise<void> {
    const dir = this.full(prefix);
    await fs.rm(dir, { recursive: true, force: true });
  }
}
