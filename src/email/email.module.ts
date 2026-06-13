import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL } from './email.interface';
import { ConsoleEmailService } from './console-email.service';
import { BrevoEmailService } from './brevo-email.service';

/** EMAIL_DRIVER selects the transport: console (dev) | brevo (transactional). */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('EMAIL_DRIVER') ?? 'console';
        switch (driver) {
          case 'console':
            return new ConsoleEmailService();
          case 'brevo':
            return new BrevoEmailService(
              config.getOrThrow<string>('BREVO_API_KEY'),
              config.get<string>('EMAIL_FROM') ?? 'no-reply@fitroom.io',
              config.get<string>('EMAIL_FROM_NAME') ?? 'FitRoom',
            );
          default:
            throw new Error(`Unsupported EMAIL_DRIVER: ${driver}`);
        }
      },
    },
  ],
  exports: [EMAIL],
})
export class EmailModule {}
