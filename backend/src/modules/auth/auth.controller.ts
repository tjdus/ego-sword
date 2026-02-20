import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('guest')
  async guestLogin(@Body() body: { deviceId?: string }) {
    return this.authService.guestLogin(body.deviceId);
  }

  @Get('progress')
  @UseGuards(JwtAuthGuard)
  async getProgress(@Req() req: { user: { userId: string } }) {
    return this.authService.getProgress(req.user.userId);
  }
}
