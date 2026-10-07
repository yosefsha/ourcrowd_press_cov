import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { AppConfig } from '../config/configuration';
import { buildTypeOrmOptions } from './typeorm-options';

/** Postgres connection shared by the API and the collector. */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        buildTypeOrmOptions(config.get('database.url', { infer: true })),
    }),
  ],
})
export class DatabaseModule {}
