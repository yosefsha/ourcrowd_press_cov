/** Injection token for the `ClassifierHealth` port. */
export const CLASSIFIER_HEALTH = Symbol('CLASSIFIER_HEALTH');

/** Whether the classification model can be reached, and which model is configured. */
export type ClassifierHealthStatus =
  | { readonly ok: true; readonly model: string }
  | { readonly ok: false; readonly model: string; readonly detail: string };

/** Probes the classification model (Ollama, ADR-007) for the collector heartbeat. */
export interface ClassifierHealth {
  check(): Promise<ClassifierHealthStatus>;
}
