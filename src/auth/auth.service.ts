import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
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
  ) {
    this.createTransporter();
  }

  async register(dto: RegisterDto) {
    const cleanEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.usersService.findByEmail(cleanEmail);
    if (existingUser) {
      throw new ConflictException('Un compte avec cet email existe déjà.');
    }

    // usersService.create() hashe déjà le mot de passe en interne : on lui
    // passe le mot de passe en clair pour éviter un double hachage, qui
    // rendait la connexion impossible juste après l'inscription.
    const user = await this.usersService.create(
      cleanEmail,
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
    const cleanEmail = dto.email.toLowerCase().trim();
    const rawUser = await this.usersService.findByEmail(cleanEmail);
    if (!rawUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = rawUser as any;

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Récupération des listes d'objets et des tableaux d'IDs simples
    const ownedStores = user.ownedStores ?? [];
    const storeAssignments = user.storeAssignments ?? [];

    const ownedStoreIds = ownedStores.map((s: any) => s.id);
    const assignedStoreIds = storeAssignments.map((sa: any) => sa.storeId);

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      assignedStoreId: user.assignedStoreId ?? null,
      ownedStores: ownedStoreIds,
      storeAssignments: assignedStoreIds,
    };

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      assignedStoreId: user.assignedStoreId ?? null,
      ownedStores,
      ownedStoreIds,
      storeAssignments,
      assignedStoreIds,
      createdAt: user.createdAt,
      access_token: this.jwtService.sign(payload),
    };
  }

  async getProfil(userId: number) {
    const user = await this.usersService.findById(userId);
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

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Action non autorisée. Seuls les administrateurs peuvent supprimer leur compte.',
      );
    }

    await this.usersService.delete(userId);
    return {
      message: `Le compte de ${user.name} et toutes les données associées ont été supprimés avec succès.`,
    };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const cleanEmail = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(cleanEmail);

    const response: { message: string; resetUrl?: string } = {
      message:
        'Si un compte existe, vous recevrez un email de réinitialisation.',
    };

    if (!user) {
      return response;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const resetUrl = this.buildResetUrl(token);

    await this.usersService.setResetToken(user.id, token, expiresAt);
    await this.sendPasswordResetEmail(user.email, resetUrl);

    const isDev =
      !process.env.NODE_ENV ||
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'dev';

    if (isDev || process.env.SHOW_RESET_LINK === 'true') {
      response.resetUrl = resetUrl;
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByResetToken(dto.token);
    if (
      !user ||
      !user.resetTokenExp ||
      new Date(user.resetTokenExp) < new Date()
    ) {
      throw new BadRequestException(
        'Lien de réinitialisation invalide ou expiré.',
      );
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
      console.warn(
        '[SMTP] Identifiants absents dans .env. Le lien sera uniquement affiché en console.',
      );
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    return this.transporter;
  }

  async sendPasswordResetEmail(email: string, resetLink: string) {
    console.log('\n==================================================');
    console.log('--- [DEV EMAIL FALLBACK] ---');
    console.log(`Destinataire : ${email}`);
    console.log(`Lien de réinitialisation : ${resetLink}`);
    console.log('==================================================\n');

    try {
      if (this.transporter && process.env.EMAIL_USER) {
        await this.transporter.sendMail({
          from: process.env.EMAIL_FROM || '"Mon App" <noreply@example.com>',
          to: email,
          subject: 'Réinitialisation de votre mot de passe',
          html: `<p>Cliquez ici pour réinitialiser votre mot de passe : <a href="${resetLink}">${resetLink}</a></p>`,
        });
        console.log(`[SMTP] E-mail envoyé avec succès à ${email}`);
      }
    } catch (error: any) {
      console.error(
        "[SMTP] Erreur lors de l'envoi de l'e-mail :",
        error.message,
      );
    }
  }
}