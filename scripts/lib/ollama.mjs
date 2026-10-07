import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ok } from './cli.mjs';
import { OLLAMA_PORT, OLLAMA_URL } from './config.mjs';
import { PrerequisiteError } from './errors.mjs';
import { isPortFree, respondsOk, waitForOk } from './net.mjs';
import { run } from './process.mjs';

const SERVE_LOG = path.join(os.tmpdir(), 'press-coverage-ollama-serve.log');
const SERVE_TIMEOUT_MS = 30_000;

/**
 * Normalises a model reference the way Ollama does: no tag means `:latest`.
 *
 * @param {string} name
 * @returns {string}
 */
export function normalizeModelName(name) {
  const trimmed = name.trim().toLowerCase();
  const lastSegment = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return lastSegment.includes(':') ? trimmed : `${trimmed}:latest`;
}

/**
 * Whether `model` is among the names Ollama's `/api/tags` returned.
 *
 * @param {unknown} tagsResponse The parsed `/api/tags` body.
 * @param {string} model
 * @returns {boolean}
 */
export function isModelPulled(tagsResponse, model) {
  const wanted = normalizeModelName(model);
  const models =
    typeof tagsResponse === 'object' && tagsResponse !== null && 'models' in tagsResponse
      ? tagsResponse.models
      : undefined;
  if (!Array.isArray(models)) return false;
  return models.some((entry) => {
    const name = typeof entry === 'object' && entry !== null ? entry.name ?? entry.model : undefined;
    return typeof name === 'string' && normalizeModelName(name) === wanted;
  });
}

/**
 * Makes sure an Ollama server answers on the host. An already-running server
 * (the desktop app, `brew services`, a previous `npm start`) is left alone;
 * `ollama serve` is started in the background only when the port is free.
 *
 * @returns {Promise<void>}
 * @throws {PrerequisiteError}
 */
export async function ensureOllamaServing() {
  if (await respondsOk(`${OLLAMA_URL}/api/version`)) {
    ok(`Ollama is serving on ${OLLAMA_URL}`);
    return;
  }
  if (!(await isPortFree(OLLAMA_PORT))) {
    throw new PrerequisiteError(
      `Port ${OLLAMA_PORT} is in use, but not by a responding Ollama server.`,
      `Stop the process listening on port ${OLLAMA_PORT} (or restart Ollama), then rerun.`,
    );
  }

  const log = openSync(SERVE_LOG, 'a');
  try {
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: ['ignore', log, log],
      windowsHide: true,
    });
    child.once('error', () => {
      // Reported below as "did not come up"; the log has the details.
    });
    child.unref();
  } finally {
    closeSync(log);
  }

  if (!(await waitForOk(`${OLLAMA_URL}/api/version`, { timeoutMs: SERVE_TIMEOUT_MS }))) {
    throw new PrerequisiteError(
      `Started \`ollama serve\`, but it did not answer on ${OLLAMA_URL} within ${SERVE_TIMEOUT_MS / 1000}s.`,
      `Check ${SERVE_LOG}, or start Ollama yourself (\`ollama serve\` or the Ollama app), then rerun.`,
    );
  }
  ok(`Started \`ollama serve\` in the background (log: ${SERVE_LOG})`);
}

/**
 * @param {string} model
 * @returns {Promise<boolean>}
 */
export async function hasModel(model) {
  const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new PrerequisiteError(
      `Ollama answered /api/tags with HTTP ${response.status}.`,
      'Restart Ollama, then rerun.',
    );
  }
  return isModelPulled(await response.json(), model);
}

/**
 * Pulls the model if it is not present yet. Used by `npm run setup`.
 *
 * @param {string} model
 * @returns {Promise<void>}
 */
export async function pullModelIfMissing(model) {
  if (await hasModel(model)) {
    ok(`Model ${model} is already pulled`);
    return;
  }
  run({ command: 'ollama', args: ['pull', model], shell: false });
  ok(`Pulled ${model}`);
}

/**
 * Fails when the model is not present. Used by `npm start` / `npm run dev`,
 * which never download several gigabytes behind the person's back.
 *
 * @param {string} model
 * @returns {Promise<void>}
 * @throws {PrerequisiteError}
 */
export async function requireModel(model) {
  if (!(await hasModel(model))) {
    throw new PrerequisiteError(
      `Ollama model ${model} is not pulled; the collector refuses to boot without it.`,
      `\`ollama pull ${model}\` (or \`npm run setup\`), then rerun.`,
    );
  }
  ok(`Model ${model} is available`);
}
