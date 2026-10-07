/**
 * Architectural boundaries checked by `npm run lint` (ADR-009).
 *
 * The API process serves reads, edits and enqueues. It must never fetch news,
 * call Ollama, execute a Run or send alerts — that is the collector's job — so
 * nothing reachable from the API's root module may import collector-only code.
 * `reachable: true` follows the whole import graph, so an indirect import
 * through a shared module is caught as well as a direct one.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'api-must-not-reach-collector-code',
      comment:
        'The API module graph must not import collector-only code (news, classification, ' +
        'pipeline, company import, alert notifiers, run worker). See ADR-009.',
      severity: 'error',
      from: { path: '^src/api\\.module\\.ts$' },
      to: {
        path: '^src/(news|classification|pipeline|companies/import|alerts/notifiers|runs/worker)/',
        reachable: true,
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Type-only imports count: a type import still couples the API to collector code.
    tsPreCompilationDeps: true,
  },
};
