import { CommandFailedError, PrerequisiteError, PrerequisiteErrors } from './errors.mjs';

/** @param {string} message */
export function step(message) {
  console.log(`\n==> ${message}`);
}

/** @param {string} message */
export function ok(message) {
  console.log(`    ok  ${message}`);
}

/**
 * Formats one fixable problem for the terminal.
 *
 * @param {PrerequisiteError} error
 * @returns {string}
 */
export function formatPrerequisiteError(error) {
  const fix = error.fix
    .split('\n')
    .map((line, index) => (index === 0 ? `    Fix: ${line}` : `         ${line}`))
    .join('\n');
  return `  x ${error.problem}\n${fix}`;
}

/**
 * Runs a script's main function and turns its failures into a readable report
 * and a non-zero exit code. Unexpected errors keep their stack trace.
 *
 * @param {() => Promise<void>} main
 * @returns {Promise<void>}
 */
export async function runCli(main) {
  try {
    await main();
  } catch (error) {
    process.exitCode = 1;
    if (error instanceof PrerequisiteErrors) {
      console.error(`\n${error.errors.length} prerequisite(s) not met:\n`);
      console.error(error.errors.map(formatPrerequisiteError).join('\n\n'));
    } else if (error instanceof PrerequisiteError) {
      console.error(`\n${formatPrerequisiteError(error)}`);
    } else if (error instanceof CommandFailedError) {
      console.error(`\n  x ${error.message}`);
    } else {
      throw error;
    }
  }
}
