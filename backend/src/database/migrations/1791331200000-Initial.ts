import type { MigrationInterface } from 'typeorm';

/**
 * Baseline migration. It creates nothing: it exists so `migration:run` has a
 * migration to apply on an empty database and the pipeline (CLI datasource,
 * compiled migrations in the image, the compose `migrate` service) is proven
 * end to end. The schema arrives in a later migration.
 */
export class Initial1791331200000 implements MigrationInterface {
  readonly name = 'Initial1791331200000';

  up(): Promise<void> {
    return Promise.resolve();
  }

  down(): Promise<void> {
    return Promise.resolve();
  }
}
