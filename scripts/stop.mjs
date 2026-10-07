// `npm stop` — stops and removes the compose stack. The Postgres volume is
// kept, and Ollama is left running: other tools may be using it.
import { runCli, step } from './lib/cli.mjs';
import { compose } from './lib/compose.mjs';
import { checkAll, checkDocker } from './lib/prerequisites.mjs';

await runCli(async () => {
  checkAll([checkDocker]);
  step('Stopping the stack (docker compose down)');
  compose(['down', '--remove-orphans']);
  step('Stopped. Data is kept in the postgres-data volume; Ollama was left running.');
});
