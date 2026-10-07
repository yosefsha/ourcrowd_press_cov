import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from './configuration';

/**
 * Global, validated configuration shared by the API and the collector. The
 * factory validates the environment itself, so an invalid env fails the boot.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [configuration],
    }),
  ],
})
export class AppConfigModule {}
