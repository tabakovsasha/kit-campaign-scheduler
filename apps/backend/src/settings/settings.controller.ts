import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUserPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaveSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getMySettings(@CurrentUser() user: JwtUserPayload) {
    return this.settingsService.getByUserId(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async saveAndVerify(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: SaveSettingsDto,
  ) {
    let accessToken = body.access_token;
    const domain = body.domain.trim();
    const host = body.host.trim();

    if (accessToken === '___KEEP___') {
      const existing = await this.settingsService.getDecryptedByUserId(user.sub);
      if (!existing) {
        return {
          verified: false,
          message: 'Токен не найден. Введите access_token повторно.',
        };
      }

      accessToken = existing.accessToken;
    }

    await this.settingsService.upsertEncrypted(user.sub, {
      domain,
      host,
      accessToken,
    });

    const verification = await this.settingsService.verifyAndPersist(user.sub);

    return {
      ...verification,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify/current')
  async verifyCurrent(@CurrentUser() user: JwtUserPayload) {
    return this.settingsService.verifyAndPersist(user.sub);
  }
}
