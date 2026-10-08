/** Injection token for the `ClassifierHealth` port. */
export const CLASSIFIER_HEALTH = Symbol('CLASSIFIER_HEALTH');

/** Whether the classification model can serve verdicts right now. */
export type ClassifierHealthStatus =
  | { readonly ok: true; readonly model: string }
  | {
      readonly ok: false;
      readonly model: string;
      /** What is wrong and the command that fixes it, e.g. `ollama pull qwen2.5:7b`. */
      readonly detail: string;
    };

/**
 * Probes the classification model without classifying anything. The collector
 * refuses to boot on an unhealthy status (ADR-007) and reports it in its
 * heartbeat (ADR-009).
 */
export interface ClassifierHealth {
  /** Never throws for an unreachable or incomplete model runtime — that is `ok: false`. */
  check(): Promise<ClassifierHealthStatus>;
}
