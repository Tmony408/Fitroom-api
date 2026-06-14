import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokensService } from './auth-tokens.service';
import { EMAIL, EmailService } from '../email/email.interface';
import { RegisterDto, LoginDto } from './dto/auth.dto';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;        // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000;              // 1 hour

export interface SafeUser {
  id: string; name: string; email: string; role: string;
  consentBodyData: boolean; emailVerified: boolean;
}

@Injectable()
export class AuthService {
  private readonly appUrl = process.env.APP_URL ?? 'http://localhost:3001';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tokens: AuthTokensService,
    private readonly config: ConfigService,
    @Inject(EMAIL) private readonly email: EmailService,
  ) {}

  // ---- token helpers ---------------------------------------------------

  private signAccess(userId: string, role: string): string {
    // Short-lived access token.
    return this.jwt.sign(
      { sub: userId, role },
      { expiresIn: (this.config.get<string>('ACCESS_TOKEN_TTL') ?? '15m') as JwtSignOptions['expiresIn'] },
    );
  }

  private async issueRefresh(userId: string): Promise<string> {
    const raw = this.tokens.generate();
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.tokens.hash(raw), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return raw;
  }

  private async session(user: SafeUser) {
    return {
      accessToken: this.signAccess(user.id, user.role),
      refreshToken: await this.issueRefresh(user.id),
      user,
    };
  }

  private safe(u: { id: string; name: string; email: string; role: string; consentBodyData: boolean; emailVerified: boolean }): SafeUser {
    return { id: u.id, name: u.name, email: u.email, role: u.role, consentBodyData: u.consentBodyData, emailVerified: u.emailVerified };
  }

  // ---- core auth -------------------------------------------------------

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name, email: dto.email, phone: dto.phone, passwordHash,
        // never allow self-signup as ADMIN
        role: dto.role === 'DESIGNER' ? 'DESIGNER' : 'CUSTOMER',
        consentBodyData: dto.consentBodyData ?? false,
      },
    });
    await this.sendVerificationEmail(user.id, user.email);
    return this.session(this.safe(user));
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.session(this.safe(user));
  }

  /** Rotate: validate the refresh token, revoke it, issue a fresh pair. */
  async refresh(rawToken: string) {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hash(rawToken) },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    // rotation: single-use refresh tokens
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    return this.session(this.safe(record.user));
  }

  async logout(rawToken: string) {
    if (!rawToken) return { ok: true };
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.tokens.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  // ---- email verification ---------------------------------------------

  private async sendVerificationEmail(userId: string, email: string) {
    const raw = this.tokens.generate();
    await this.prisma.verificationToken.create({
      data: { userId, type: 'EMAIL_VERIFY', tokenHash: this.tokens.hash(raw), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
    });
    const link = `${this.appUrl}/verify-email?token=${raw}`;
    await this.email.send({
      to: email,
      subject: 'Verify your FitRoom email',
      text: `Welcome to FitRoom! Verify your email:\n${link}\nThis link expires in 24 hours.`,
    });
  }

  async resendVerification(userId: string, email: string) {
    await this.sendVerificationEmail(userId, email);
    return { ok: true };
  }

  async verifyEmail(rawToken: string) {
    const record = await this.consumeToken(rawToken, 'EMAIL_VERIFY');
    await this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } });
    return { verified: true };
  }

  // ---- password reset --------------------------------------------------

  /** Always returns ok (no account enumeration). Emails a link only if found. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = this.tokens.generate();
      await this.prisma.verificationToken.create({
        data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: this.tokens.hash(raw), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      });
      const link = `${this.appUrl}/reset-password?token=${raw}`;
      await this.email.send({
        to: email, subject: 'Reset your FitRoom password',
        text: `Reset your password:\n${link}\nThis link expires in 1 hour. If you didn't request this, ignore it.`,
      });
    }
    return { ok: true };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const record = await this.consumeToken(rawToken, 'PASSWORD_RESET');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      // revoke all sessions on password change
      this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  private async consumeToken(rawToken: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.tokens.hash(rawToken) },
    });
    if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    await this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record;
  }
}
