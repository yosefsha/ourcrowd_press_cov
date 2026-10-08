/**
 * Measures how many Candidates a Backfill finds per company, on an evenly
 * spaced sample of the Seed List against real Google News, for the Backfill
 * duration estimate in `docs/validation-report.md` (#18). Run from `backend/`:
 *
 *   npm run build
 *   node dist/classification/validation/sample-candidate-volume.cli.js [--companies 20]
 *
 * Searches go through the real `GoogleNewsRssNewsSource` with publisher URL
 * resolution switched off (only counts are kept), spaced 1.5 s apart.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { configuration } from '../../config/configuration';
import type { CompanyProfile } from '../../domain/company';
import { parseSeedList } from '../../domain/seed-line';
import { FetchGoogleNewsTransport } from '../../news/google-news/fetch-google-news.transport';
import { RequestThrottle } from '../../news/google-news/request-throttle';
import type { PublisherUrlResolver } from '../../news/publisher-url-resolver';
import { GoogleNewsRssNewsSource } from '../../news/repositories/google-news-rss.news-source';
import { serializeCandidateVolume, type CompanyVolume } from './candidate-volume';
import { namesCompany } from './names-company';
import { VALIDATION_PATHS } from './validation-paths';

const POLITE_INTERVAL_MS = 1500;
/** The same quarter the recorded feeds cover, so the sample and the set agree. */
const WINDOW = { from: new Date('2026-07-01T00:00:00.000Z'), to: new Date('2026-10-01T00:00:00.000Z') };

/** Leaves every publisher URL unresolved: the sample needs counts, not links. */
const noPublisherUrls: PublisherUrlResolver = { resolvePublisherUrl: () => Promise.resolve(null) };

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      companies: { type: 'string', default: '20' },
      out: { type: 'string', default: VALIDATION_PATHS.volume },
    },
  });
  const wanted = Number(values.companies);
  if (!Number.isInteger(wanted) || wanted < 1) throw new Error('--companies must be a positive integer');

  const config = configuration();
  const seed = parseSeedList(await readFile(config.seedList.path, 'utf8'));
  const step = Math.max(1, Math.floor(seed.length / wanted));
  const sampled = seed.filter((_, index) => index % step === 0).slice(0, wanted);
  const source = new GoogleNewsRssNewsSource(
    new FetchGoogleNewsTransport(new RequestThrottle(POLITE_INTERVAL_MS)),
    noPublisherUrls,
  );

  const companies: CompanyVolume[] = [];
  for (const company of sampled) {
    const profile: CompanyProfile = {
      displayName: company.displayName,
      aliases: company.aliases,
      domain: company.domain,
      description: null,
      searchTerms: [],
    };
    const distinct = new Map<string, { title: string; snippet: string }>();
    const editions = [];
    for (const edition of config.news.editions) {
      const { articles, capped } = await source.findCandidates(profile, WINDOW, edition);
      editions.push({ edition: edition.code, found: articles.length, capped });
      for (const article of articles) distinct.set(article.googleArticleId, article);
    }
    const classified = [...distinct.values()].filter((article) => namesCompany(profile, article)).length;
    companies.push({ company: company.sourceName, editions, candidates: distinct.size, classified });
    console.log(`${company.sourceName}: ${editions.map((e) => `${e.edition} ${e.found}${e.capped ? ' (capped)' : ''}`).join(', ')}; ${classified} classified`);
  }

  const outPath = resolve(values.out);
  await writeFile(
    outPath,
    serializeCandidateVolume({
      recordedAt: new Date(),
      window: WINDOW,
      sampleRule: `one in every ${step} of the ${seed.length} Seed List companies (${companies.length} sampled), searched in ${config.news.editions.map((e) => e.code).join(' and ')} for Q3 2026 with the profile the Seed List gives them`,
      companies,
    }),
    'utf8',
  );
  console.log(`Wrote ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
