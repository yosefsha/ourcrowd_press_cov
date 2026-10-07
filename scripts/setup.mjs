// `npm run setup` — checks the host prerequisites, pulls the Ollama model and
// installs both services' dependencies. Installs nothing system-level: a
// missing tool is reported with the command that installs it.
import path from 'node:path';

import { ok, runCli, step } from './lib/cli.mjs';
import { REPO_ROOT, resolveConfig } from './lib/config.mjs';
import { ensureDataDir } from './lib/data-dir.mjs';
import { ensureOllamaServing, pullModelIfMissing } from './lib/ollama.mjs';
import { checkHostPrerequisites } from './lib/prerequisites.mjs';
import { npm, run } from './lib/process.mjs';

await runCli(async () => {
  const config = resolveConfig(process.env);

  step('Checking prerequisites (Node, Docker, Ollama)');
  checkHostPrerequisites();
  ok(`Node ${process.versions.node}, Docker running, Ollama installed`);

  step(`Making sure the Ollama model ${config.ollamaModel} is pulled`);
  await ensureOllamaServing();
  await pullModelIfMissing(config.ollamaModel);

  step('Preparing the data/ folder mounted into the backend containers');
  ensureDataDir();

  for (const service of ['backend', 'frontend']) {
    step(`Installing ${service} dependencies (npm ci)`);
    run(npm(['ci']), { cwd: path.join(REPO_ROOT, service) });
  }

  step('Setup complete. Next: npm start');
});
