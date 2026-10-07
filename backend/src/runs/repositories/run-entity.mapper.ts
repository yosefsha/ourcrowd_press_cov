import type { Run } from '../../domain/run';
import type { RunEntity } from '../../database/entities/run.entity';

/** Maps a `runs` row to the domain Run; the entity never crosses a port. */
export function toRun(entity: RunEntity): Run {
  return {
    id: entity.id,
    type: entity.type,
    status: entity.status,
    trigger: entity.trigger,
    params: entity.params,
    progress: entity.progress,
    error: entity.error,
    createdAt: entity.createdAt,
    startedAt: entity.startedAt,
    finishedAt: entity.finishedAt,
  };
}
