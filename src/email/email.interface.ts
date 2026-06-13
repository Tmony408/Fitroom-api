export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Email seam. ConsoleEmailService (logs to stdout) is the dev default so the
 * verify/reset flows work with no SMTP. A real SMTP/provider implementation
 * (Resend, SES, Postmark…) plugs in behind the same interface.
 */
export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL = Symbol('EMAIL');
