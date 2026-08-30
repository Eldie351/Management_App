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
import { Resend } from 'resend';

@Injectable()
export class AuthService {
  private resend: Resend | null = null;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {
    this.initResend();
  }

  private initResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      console.warn(
        '[Resend] RESEND_API_KEY est absente du fichier .env. Les emails seront uniquement affichés dans la console.',
      );
    }
  }

  async register(dto: RegisterDto) {
    const cleanEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.usersService.findByEmail(cleanEmail);
    if (existingUser) {
      throw new ConflictException('Un compte avec cet email existe déjà.');
    }

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
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // Expiration 30 min
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

    // Le hashage unique reste inchangé
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
    await this.usersService.clearResetToken(user.id);

    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  private buildResetUrl(token: string) {
    return `${process.env.FRONTEND_URL || 'https://octostock-app.vercel.app'}/reset-password?token=${token}`;
  }

  async sendPasswordResetEmail(email: string, resetLink: string) {
    console.log('\n==================================================');
    console.log(`Destinataire : ${email}`);
    console.log(`Lien de réinitialisation : ${resetLink}`);
    console.log('==================================================\n');

    if (!this.resend) {
      console.warn('[Resend] Email non envoyé : RESEND_API_KEY non configurée.');
      return;
    }

    try {
      const fromAddress = process.env.EMAIL_FROM || 'Octostock <onboarding@resend.dev>';
      
      const { data, error } = await this.resend.emails.send({
        from: fromAddress,
        to: email,
        subject: 'Réinitialisation de votre mot de passe - Octostock',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #333;">Réinitialisation de votre mot de passe</h2>
            <p>Bonjour,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe pour accéder à Octostock.</p>
            <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe (ce lien expire dans 30 minutes) :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color: #666; font-size: 13px;">Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :</p>
            <p style="color: #0070f3; font-size: 13px; word-break: break-all;">${resetLink}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
          </div>
        `,
      });

      if (error) {
        console.error('[Resend] Erreur renvoyée par l\'API :', error);
      } else {
        console.log(`[Resend] E-mail envoyé avec succès (ID: ${data?.id})`);
      }
    } catch (error: any) {
      console.error("[Resend] Erreur lors de l'envoi de l'e-mail :", error.message);
    }
  }
}