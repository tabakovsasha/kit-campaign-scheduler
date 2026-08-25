import { IsNotEmpty, IsString } from 'class-validator';

export class SaveSettingsDto {
  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsString()
  @IsNotEmpty()
  host!: string;

  @IsString()
  @IsNotEmpty()
  access_token!: string;
}
