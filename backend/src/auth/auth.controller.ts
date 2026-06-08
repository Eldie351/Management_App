import { Body, Controller, Post, Get, Delete, Request, UseGuards} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get('profil')
  @UseGuards(AuthGuard('jwt'))
  async getProfil(@Request() req) {
    const userId = req.user.id;
    return this.authService.getProfil(userId);
  }

  @Delete('compte')
  @UseGuards(AuthGuard('jwt'))
  async deleteAccount(@Request() req) {
    const userId = req.user.id;
    return this.authService.deleteAccount(userId);
 }
}