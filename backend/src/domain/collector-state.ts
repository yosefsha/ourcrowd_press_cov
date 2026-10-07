/** What the collector is doing, as recorded in its heartbeat. */
export const COLLECTOR_STATES = ['idle', 'importing', 'running'] as const;
export type CollectorState = (typeof COLLECTOR_STATES)[number];
