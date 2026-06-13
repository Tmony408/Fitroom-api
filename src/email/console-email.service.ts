import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailService } from './email.interface';

/** Dev transport: logs emails so verify/reset links are visible in the console. */
@Injectable()
export class ConsoleEmailService implements EmailService {
  private readonly logger = new Logger('Email');

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`✉  To: ${message.to} · ${message.subject}\n${message.text}`);
  }
}
