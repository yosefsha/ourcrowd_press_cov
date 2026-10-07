import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { join } from 'node:path';

const backendRoot = join(__dirname, '..', '..');
const depcruiseBin = join(backendRoot, 'node_modules', '.bin', 'depcruise');
const config = join(backendRoot, '.dependency-cruiser.cjs');

function cruise(cwd: string): SpawnSyncReturns<string> {
  return spawnSync(depcruiseBin, ['src', '--config', config], { cwd, encoding: 'utf8' });
}

describe('API boundary rule (ADR-009)', () => {
  it('passes for the real source tree', () => {
    const result = cruise(backendRoot);

    expect(result.stdout).toContain('no dependency violations found');
    expect(result.status).toBe(0);
  });

  it('fails when the API module graph reaches collector-only code indirectly', () => {
    const result = cruise(join(__dirname, 'fixtures', 'api-reaches-collector-code'));

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('api-must-not-reach-collector-code');
    expect(result.stdout).toContain('src/news/news-source.ts');
  });
});
