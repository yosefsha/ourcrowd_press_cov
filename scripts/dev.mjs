// `npm run dev` — Postgres in Docker Compose; the API, the collector and the
// Vite dev server run natively with reload, against Ollama on the host.
//
// The backend is compiled by one `tsc --watch` and each entry point runs under
// `node --watch`. Two `nest start --watch` processes would share dist/ and
// wipe each other's output (nest-cli.json sets deleteOutDir).
import { existsSync } from 'node:fs';
import path from 'node:path';

import { ok, runCli, step } from './lib/cli.mjs';
import { compose, ensurePortsAvailable, overrideFix, runningServices } from './lib/compose.mjs';
import {
  DEV_API_PORT,
  DEV_VITE_PORT,
  OLLAMA_URL,
  REPO_ROOT,
  resolveConfig,
} from './lib/config.mjs';
import { ensureDataDir } from './lib/data-dir.mjs';
import { PrerequisiteError } from './lib/errors.mjs';
import { ensureOllamaServing, requireModel } from './lib/ollama.mjs';
import { checkHostPrerequisites } from './lib/prerequisites.mjs';
import { npm, run } from './lib/process.mjs';
import { supervise } from './lib/supervisor.mjs';

const BACKEND = path.join(REPO_ROOT, 'backend');
const FRONTEND = path.join(REPO_ROOT, 'frontend');
const TSC = path.join(BACKEND, 'node_modules', 'typescript', 'bin', 'tsc');
const VITE = path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js');
const ENTRY_FILES = [path.join('dist', 'main.js'), path.join('dist', 'worker.js')];

await runCli(async () => {
  const config = resolveConfig(process.env);
  const databaseUrl = `postgresql://app:app@localhost:${config.postgresPort}/app`;

  step('Checking prerequisites (Node, Docker, Ollama, dependencies)');
  checkHostPrerequisites();
  for (const [service, file] of [
    ['backend', TSC],
    ['frontend', VITE],
  ]) {
    if (!existsSync(file)) {
      throw new PrerequisiteError(
        `${service} dependencies are not installed.`,
        '`npm run setup`, then rerun `npm run dev`.',
      );
    }
  }
  const nativeFix = (/** @type {number} */ port) =>
    `Stop whatever listens on ${port} (if it is this project's Docker stack, run \`npm stop\`), then rerun.`;
  await ensurePortsAvailable(
    [
      {
        port: config.postgresPort,
        label: 'Postgres',
        service: 'postgres',
        fix: overrideFix('POSTGRES_HOST_PORT', config.postgresPort, 'npm run dev'),
      },
      { port: DEV_API_PORT, label: 'backend API', fix: nativeFix(DEV_API_PORT) },
      { port: DEV_VITE_PORT, label: 'Vite dev server', fix: nativeFix(DEV_VITE_PORT) },
    ],
    runningServices(),
  );
  ok('Prerequisites met and ports available');

  step('Making sure Ollama is serving');
  await ensureOllamaServing();
  await requireModel(config.ollamaModel);

  step('Starting Postgres (docker compose up -d --wait postgres)');
  compose(['up', '--detach', '--wait', 'postgres']);

  step('Preparing the data/ folder');
  ensureDataDir();

  step('Applying migrations (npm run migration:run in backend/)');
  run(npm(['run', 'migration:run']), { cwd: BACKEND, env: { DATABASE_URL: databaseUrl } });

  // `node --watch` exits at once if its entry file is missing, so the first
  // compile must finish before the watchers start. migration:run's pre-hook
  // normally builds dist/; do it here too rather than rely on that.
  if (ENTRY_FILES.some((file) => !existsSync(path.join(BACKEND, file)))) {
    step('Compiling the backend once (tsc -p tsconfig.build.json)');
    run({ command: process.execPath, args: [TSC, '-p', 'tsconfig.build.json'], shell: false }, { cwd: BACKEND });
  }

  step(`Starting API (:${DEV_API_PORT}), collector and dashboard (http://localhost:${DEV_VITE_PORT})`);
  console.log('    Ctrl+C stops them; Postgres keeps running until `npm stop`.\n');
  const backendEnv = { DATABASE_URL: databaseUrl, NODE_ENV: 'development' };
  process.exitCode = await supervise([
    {
      name: 'tsc',
      command: process.execPath,
      args: [TSC, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
      cwd: BACKEND,
    },
    {
      name: 'api',
      command: process.execPath,
      args: ['--watch', 'dist/main.js'],
      cwd: BACKEND,
      env: { ...backendEnv, PORT: String(DEV_API_PORT) },
    },
    {
      name: 'collector',
      command: process.execPath,
      args: ['--watch', 'dist/worker.js'],
      cwd: BACKEND,
      env: { ...backendEnv, OLLAMA_BASE_URL: OLLAMA_URL, OLLAMA_MODEL: config.ollamaModel },
    },
    {
      name: 'web',
      command: process.execPath,
      args: [VITE, '--port', String(DEV_VITE_PORT), '--strictPort'],
      cwd: FRONTEND,
    },
  ]);
});
