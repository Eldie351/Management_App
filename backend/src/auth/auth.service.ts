import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(
  private readonly usersService: UsersService,
  private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(
      dto.email,
      dto.name,
      dto.password,
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      access_token: this.jwtService.sign(payload),
    };
  }

  async getProfil(userId: number) {
    const user = await this.usersService.findByStore(userId); 
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.usersService.findProfileWithStores(userId);
  }

  async deleteAccount(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    await this.usersService.delete(userId);    
    return { 
      message: `Le compte de ${user.name} et toutes les données associées (magasins, produits) ont été supprimés avec succès.` 
    };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return { message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const resetUrl = this.buildResetUrl(token);

    await this.usersService.setResetToken(user.id, token, expiresAt);
    await this.sendPasswordResetEmail(user.email, resetUrl);

    const response: { message: string; resetUrl?: string } = {
      message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.',
    };

    if (process.env.NODE_ENV !== 'production' || process.env.SHOW_RESET_LINK === 'true') {
      response.resetUrl = resetUrl;
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByResetToken(dto.token);
    if (!user || !user.resetTokenExp || new Date(user.resetTokenExp) < new Date()) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
    await this.usersService.clearResetToken(user.id);

    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  private buildResetUrl(token: string) {
    return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  }

  private createTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = Number(process.env.EMAIL_PORT || 465);
    const secure = process.env.EMAIL_SECURE === 'true' || port === 465;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      console.warn('SMTP credentials are missing. Password reset email will only be logged.');
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  private async sendPasswordResetEmail(email: string, resetUrl: string) {
    const transporter = this.createTransporter();

    if (!transporter) {
      console.log(`Password reset email for ${email}: ${resetUrl}`);
      return;
    }

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@localhost',
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        html: `
          <p>Bonjour,</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
          <p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
          <p>Ce lien expirera dans 30 minutes.</p>
        `,
        text: `Réinitialisation de votre mot de passe: ${resetUrl}`,
      });
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      console.log(`Password reset email fallback for ${email}: ${resetUrl}`);
    }
  }
}
