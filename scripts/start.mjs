// `npm start` — runs the whole stack in Docker Compose (Postgres, migration,
// API, collector, dashboard) against Ollama on the host, waits until the
// dashboard can reach the API, and prints its URL. Safe to run repeatedly:
// a running Ollama is reused and `compose up` only recreates what changed.
import { ok, runCli, step } from './lib/cli.mjs';
import { compose, ensurePortsAvailable, overrideFix, runningServices } from './lib/compose.mjs';
import { resolveConfig } from './lib/config.mjs';
import { ensureDataDir } from './lib/data-dir.mjs';
import { PrerequisiteError } from './lib/errors.mjs';
import { waitForOk } from './lib/net.mjs';
import { ensureOllamaServing, requireModel } from './lib/ollama.mjs';
import { checkHostPrerequisites } from './lib/prerequisites.mjs';

const HEALTH_TIMEOUT_MS = 180_000;

await runCli(async () => {
  const config = resolveConfig(process.env);

  step('Checking prerequisites (Node, Docker, Ollama)');
  checkHostPrerequisites();
  await ensurePortsAvailable(
    [
      {
        port: config.postgresPort,
        label: 'Postgres',
        service: 'postgres',
        fix: overrideFix('POSTGRES_HOST_PORT', config.postgresPort, 'npm start'),
      },
      {
        port: config.apiPort,
        label: 'API',
        service: 'api',
        fix: overrideFix('API_HOST_PORT', config.apiPort, 'npm start'),
      },
      {
        port: config.frontendPort,
        label: 'dashboard',
        service: 'frontend',
        fix: overrideFix('FRONTEND_HOST_PORT', config.frontendPort, 'npm start'),
      },
    ],
    runningServices(),
  );
  ok('Prerequisites met and ports available');

  step('Making sure Ollama is serving');
  await ensureOllamaServing();
  await requireModel(config.ollamaModel);

  step('Preparing the data/ folder mounted into the backend containers');
  ensureDataDir();

  step('Building and starting the stack (docker compose up --build -d)');
  compose(['up', '--build', '--detach', '--remove-orphans']);

  // /health through nginx proves both the dashboard and the API are up.
  const dashboard = `http://localhost:${config.frontendPort}`;
  step(`Waiting for ${dashboard}/health`);
  const healthy = await waitForOk(`http://127.0.0.1:${config.frontendPort}/health`, {
    timeoutMs: HEALTH_TIMEOUT_MS,
  });
  if (!healthy) {
    throw new PrerequisiteError(
      `The stack did not become healthy within ${HEALTH_TIMEOUT_MS / 1000}s.`,
      'Inspect `docker compose ps` and `docker compose logs api frontend`, fix the failing service, then rerun `npm start`.',
    );
  }

  step(`Dashboard is up: ${dashboard}`);
  console.log('    Stop the stack with `npm stop` (Ollama keeps running).');
});
