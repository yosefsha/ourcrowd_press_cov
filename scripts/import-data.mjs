// `npm run import-data [-- <args>]` — runs the backend's own `import-data`
// script inside the running api container, so it uses the stack's database
// and the image's compiled code. Extra arguments are passed through.
import { runCli, step } from './lib/cli.mjs';
import { compose, runningServices } from './lib/compose.mjs';
import { PrerequisiteError } from './lib/errors.mjs';
import { definesScript, readServiceManifest } from './lib/manifest.mjs';
import { checkAll, checkDocker } from './lib/prerequisites.mjs';

const BACKEND_SCRIPT = 'import-data';

await runCli(async () => {
  if (!definesScript(readServiceManifest('backend'), BACKEND_SCRIPT)) {
    throw new PrerequisiteError(
      `backend/package.json has no "${BACKEND_SCRIPT}" script yet, so there is nothing to run.`,
      'The import command arrives with issue #12 (data export and import-data). Pull a main that includes it, then rerun `npm start` and `npm run import-data`.',
    );
  }

  checkAll([checkDocker]);
  if (!runningServices().has('api')) {
    throw new PrerequisiteError(
      'The api container is not running.',
      'Start the stack with `npm start`, then rerun `npm run import-data`.',
    );
  }

  step(`Running \`npm run ${BACKEND_SCRIPT}\` in the api container`);
  const tty = process.stdin.isTTY && process.stdout.isTTY ? [] : ['-T'];
  const passthrough = process.argv.slice(2);
  compose([
    'exec',
    ...tty,
    'api',
    'npm',
    'run',
    BACKEND_SCRIPT,
    ...(passthrough.length > 0 ? ['--', ...passthrough] : []),
  ]);
});
