import { fileURLToPath } from 'node:url';

import { PrerequisiteError } from './errors.mjs';

/** Repository root: every script runs Docker Compose and npm from here. */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';

/**
 * Ollama's port on the host. Fixed rather than configurable because the
 * collector container reaches it at host.docker.internal:11434 (ADR-007).
 */
export const OLLAMA_PORT = 11434;
export const OLLAMA_URL = `http://127.0.0.1:${OLLAMA_PORT}`;

/** Ports the native processes of `npm run dev` listen on. */
export const DEV_API_PORT = 8000;
export const DEV_VITE_PORT = 5173;

/**
 * @typedef {object} RunConfig
 * @property {number} postgresPort Host port Postgres is published on.
 * @property {number} apiPort Host port the compose API is published on.
 * @property {number} frontendPort Host port the dashboard is published on.
 * @property {string} ollamaModel Model the collector classifies with.
 */

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function readPort(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new PrerequisiteError(
      `${name}=${raw} is not a valid TCP port.`,
      `Set ${name} to an integer between 1 and 65535, or unset it to use ${fallback}.`,
    );
  }
  return port;
}

/**
 * Resolves the run configuration from the environment. The port variable names
 * are the ones docker-compose.yml interpolates, so one setting moves both.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {RunConfig}
 */
export function resolveConfig(env) {
  const model = (env.OLLAMA_MODEL ?? '').trim();
  return {
    postgresPort: readPort(env, 'POSTGRES_HOST_PORT', 5432),
    apiPort: readPort(env, 'API_HOST_PORT', 8000),
    frontendPort: readPort(env, 'FRONTEND_HOST_PORT', 8080),
    ollamaModel: model === '' ? DEFAULT_OLLAMA_MODEL : model,
  };
}
