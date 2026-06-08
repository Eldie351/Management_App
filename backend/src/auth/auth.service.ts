import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common'; // <-- Correction 1 : Import de NotFoundException
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
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


}
