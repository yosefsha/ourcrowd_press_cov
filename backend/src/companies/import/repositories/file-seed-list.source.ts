import { readFile } from 'node:fs/promises';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/configuration';
import { parseSeedList, type SeedCompany } from '../../../domain/seed-line';
import { SeedListUnavailable, type SeedListSource } from '../seed-list-source';

/** The Seed List file at `SEED_LIST_PATH` (mounted read-only into the collector container). */
@Injectable()
export class FileSeedListSource implements SeedListSource {
  private readonly path: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.path = config.get('seedList.path', { infer: true });
  }

  async read(): Promise<readonly SeedCompany[]> {
    let text: string;
    try {
      text = await readFile(this.path, 'utf8');
    } catch (error) {
      throw new SeedListUnavailable(`Cannot read the Seed List at ${this.path}`, { cause: error });
    }
    return parseSeedList(text);
  }
}
