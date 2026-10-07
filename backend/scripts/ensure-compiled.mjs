// Runs before `migration:run` / `migration:generate`. The TypeORM CLI always
// loads the compiled datasource from dist/, so:
//   - where the Nest build toolchain is installed (CI, a laptop), rebuild first
//     so the CLI never runs stale migrations;
//   - in the runtime image (`npm ci --omit=dev`, no toolchain), use the dist/
//     the image shipped, and fail loudly if it is missing.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const nestCli = 'node_modules/.bin/nest';
const compiledDataSource = 'dist/database/data-source.js';

if (existsSync(nestCli)) {
  const { status } = spawnSync(nestCli, ['build'], { stdio: 'inherit' });
  process.exit(status ?? 1);
}

if (!existsSync(compiledDataSource)) {
  console.error(`${compiledDataSource} is missing and the Nest CLI is not installed to build it.`);
  process.exit(1);
}
