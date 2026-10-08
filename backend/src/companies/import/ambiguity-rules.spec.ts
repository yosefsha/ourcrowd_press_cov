import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseSeedList } from '../../domain/seed-line';
import { assessNameByRules } from './ambiguity-rules';

/** The real Seed List shipped with the project. */
const seedList = parseSeedList(readFileSync(join(__dirname, '../../../../docs/ourcrowd_companies.txt'), 'utf8'));

function flaggedByRules(displayName: string): boolean {
  return assessNameByRules(displayName)?.ambiguous ?? false;
}

describe('assessNameByRules', () => {
  it('flags a common first name (Harvey)', () => {
    expect(assessNameByRules('Harvey')).toEqual({
      ambiguous: true,
      reason: '"Harvey" is a common first name, so a news search for it would mostly return unrelated people.',
    });
  });

  it('flags a common English word (Wave), whatever its case', () => {
    expect(assessNameByRules('Wave')?.reason).toContain('common English word');
    expect(flaggedByRules('ISLAND')).toBe(true);
  });

  it('flags a name of three characters or fewer (Ro, xAI, IQM)', () => {
    expect(assessNameByRules('Ro')?.reason).toBe(
      '"Ro" is only 2 characters long, so a news search for it would mostly match unrelated text.',
    );
    expect(flaggedByRules('xAI')).toBe(true);
    expect(flaggedByRules('IQM')).toBe(true);
  });

  it('passes multi-word names even when made of common words (Quantum Machines)', () => {
    expect(assessNameByRules('Quantum Machines')).toBeNull();
    expect(assessNameByRules('Scale AI')).toBeNull();
  });

  it('passes a coined single word (ZutaCore, Databricks) and a four-character name (Ukko)', () => {
    expect(assessNameByRules('ZutaCore')).toBeNull();
    expect(assessNameByRules('Databricks')).toBeNull();
    expect(assessNameByRules('Ukko')).toBeNull();
  });

  it('ignores surrounding whitespace', () => {
    expect(flaggedByRules('  Harvey  ')).toBe(true);
  });

  describe('on the real Seed List', () => {
    const byName = new Map(seedList.map((seed) => [seed.displayName, flaggedByRules(seed.displayName)]));

    it.each(['Harvey', 'Wave', 'Ro', 'Island', 'Stripe', 'Glean', 'Peak', 'Shield', 'Lemonade', 'Casper', 'Silo'])(
      'flags %s',
      (name) => {
        expect(byName.get(name)).toBe(true);
      },
    );

    it.each(['Quantum Machines', 'ZutaCore', 'OpenEvidence', 'Cerebras', 'Together AI', 'Lambda', 'SSI', 'Ludeo'])(
      'treats %s as the parser reads it',
      (name) => {
        expect(byName.has(name)).toBe(true);
        expect(byName.get(name)).toBe(name.length <= 3);
      },
    );
  });
});
