import { Global, Module } from '@nestjs/common';
import { VoximplantApiService } from './voximplant-api.service';

@Global()
@Module({
  providers: [VoximplantApiService],
  exports: [VoximplantApiService],
})
export class VoximplantModule {}
