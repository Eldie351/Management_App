import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as nodemailer from 'nodemailer';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    setResetToken: jest.fn(),
    findByResetToken: jest.fn(),
    updatePassword: jest.fn(),
    clearResetToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: { sign: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should request a password reset token for an existing user', async () => {
    mockUsersService.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
    jest.spyOn(service as any, 'sendPasswordResetEmail').mockResolvedValue(undefined);

    const result = await service.requestPasswordReset({ email: 'user@example.com' });

    expect(mockUsersService.setResetToken).toHaveBeenCalled();
    expect(result.message).toContain('réinitialisation');
  });

  it('should send a reset email when SMTP credentials are configured', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_SECURE = 'true';
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASS = 'secret';

    mockUsersService.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });

    await service.requestPasswordReset({ email: 'user@example.com' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com',
      subject: 'Réinitialisation de votre mot de passe',
    }));
  });

  it('should reject an invalid or expired password reset token', async () => {
    mockUsersService.findByResetToken.mockResolvedValue(null);

    await expect(service.resetPassword({ token: 'invalid-token', password: 'new-password-123' })).rejects.toThrow(BadRequestException);
  });
});
