import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AllowPasswordChangeRequired } from './allow-password-change-required.decorator';
import { CurrentUser } from './current-user.decorator';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { JwtUserPayload } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.authService.login(
      body.login,
      body.password,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.login, body.password);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(body.refreshToken, req.ip);
  }

  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangeRequired()
  @Get('me')
  me(@CurrentUser() user: JwtUserPayload) {
    return this.authService.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangeRequired()
  @Post('logout')
  async logout(@CurrentUser() user: JwtUserPayload) {
    await this.authService.logout(user.sessionId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangeRequired()
  @Post('change-password')
  changePassword(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, body.currentPassword, body.newPassword);
  }
}
