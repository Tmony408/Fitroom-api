import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailService } from './email.interface';

/**
 * Brevo (Sendinblue) transactional email — fetch-based, no SDK dependency.
 * Enabled by EMAIL_DRIVER=brevo + BREVO_API_KEY (+ EMAIL_FROM / EMAIL_FROM_NAME).
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */
@Injectable()
export class BrevoEmailService implements EmailService {
  private readonly logger = new Logger('Email/Brevo');

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.fromEmail, name: this.fromName },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html ?? `<pre style="font-family:inherit">${message.text}</pre>`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      this.logger.error(`Brevo send failed (${res.status}): ${detail}`);
      throw new BadGatewayException('Email delivery failed');
    }
  }
}
