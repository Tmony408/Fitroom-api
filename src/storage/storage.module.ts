import { Global, Module } from '@nestjs/common';
import { STORAGE } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { SignedUrlService } from './signed-url.service';

/**
 * Picks the storage driver from STORAGE_DRIVER (default "local").
 * Add an S3StorageService and branch here for production.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      useFactory: () => {
        const driver = process.env.STORAGE_DRIVER ?? 'local';
        switch (driver) {
          case 'local':
            return new LocalStorageService();
          // case 's3': return new S3StorageService(...);
          default:
            throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
        }
      },
    },
    SignedUrlService,
  ],
  exports: [STORAGE, SignedUrlService],
})
export class StorageModule {}
