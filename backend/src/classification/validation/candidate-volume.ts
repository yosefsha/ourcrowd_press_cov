import { isRecord } from '../prompts/prompt-parts';

/**
 * How many Candidates a Backfill finds per company, measured on a sample of
 * the Seed List against real Google News (`sample-candidate-volume`), so the
 * Backfill duration estimate rests on counts rather than a guess.
 */

/** One edition's search for one sampled company. */
export interface EditionVolume {
  readonly edition: string;
  /** Articles inside the window. */
  readonly found: number;
  /** The search returned the source's result cap, so more may exist. */
  readonly capped: boolean;
}

export interface CompanyVolume {
  readonly company: string;
  readonly editions: readonly EditionVolume[];
  /** Distinct articles across editions — what the pipeline stores as Candidates. */
  readonly candidates: number;
  /** Of those, the ones passing the name check — what reaches the classifier. */
  readonly classified: number;
}

export interface CandidateVolumeSample {
  readonly recordedAt: Date;
  readonly window: { readonly from: Date; readonly to: Date };
  /** How the companies were chosen, in words. */
  readonly sampleRule: string;
  readonly companies: readonly CompanyVolume[];
}

/** Means over the sampled companies. */
export interface VolumeSummary {
  readonly sampledCompanies: number;
  readonly meanCandidatesPerCompany: number;
  readonly meanClassifiedPerCompany: number;
  /** Mean articles found per company in each edition, before de-duplication. */
  readonly meanFoundPerEdition: Readonly<Record<string, number>>;
  readonly cappedSearches: number;
  readonly searches: number;
}

export class InvalidCandidateVolume extends Error {
  constructor(source: string, problem: string) {
    super(`Invalid candidate volume sample in ${source}: ${problem}`);
    this.name = 'InvalidCandidateVolume';
  }
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function date(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function readEdition(value: unknown): EditionVolume | undefined {
  if (!isRecord(value) || typeof value.edition !== 'string' || typeof value.capped !== 'boolean') return undefined;
  const found = count(value.found);
  return found === undefined ? undefined : { edition: value.edition, found, capped: value.capped };
}

function readCompany(value: unknown): CompanyVolume | undefined {
  if (!isRecord(value) || typeof value.company !== 'string' || !Array.isArray(value.editions)) return undefined;
  const editions = value.editions.map(readEdition);
  const candidates = count(value.candidates);
  const classified = count(value.classified);
  if (editions.some((edition) => edition === undefined) || candidates === undefined || classified === undefined) {
    return undefined;
  }
  return { company: value.company, editions: editions as EditionVolume[], candidates, classified };
}

/** Validates parsed sample JSON; throws `InvalidCandidateVolume` naming the problem. */
export function parseCandidateVolume(json: unknown, source: string): CandidateVolumeSample {
  if (!isRecord(json)) throw new InvalidCandidateVolume(source, 'not a JSON object');
  const recordedAt = date(json.recordedAt);
  const window = isRecord(json.window) ? { from: date(json.window.from), to: date(json.window.to) } : undefined;
  if (recordedAt === undefined || window?.from === undefined || window.to === undefined) {
    throw new InvalidCandidateVolume(source, 'recordedAt and window are required');
  }
  if (typeof json.sampleRule !== 'string') throw new InvalidCandidateVolume(source, 'sampleRule is required');
  if (!Array.isArray(json.companies) || json.companies.length === 0) {
    throw new InvalidCandidateVolume(source, 'companies must be a non-empty array');
  }
  const companies = json.companies.map((entry: unknown, index: number) => {
    const company = readCompany(entry);
    if (company === undefined) throw new InvalidCandidateVolume(source, `company ${index} is malformed`);
    return company;
  });
  return { recordedAt, window: { from: window.from, to: window.to }, sampleRule: json.sampleRule, companies };
}

/** JSON form of the sample, as written to `test/fixtures/validation/candidate-volume.json`. */
export function serializeCandidateVolume(sample: CandidateVolumeSample): string {
  return `${JSON.stringify(sample, null, 2)}\n`;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Means per company over the sample. */
export function summarizeVolume(sample: CandidateVolumeSample): VolumeSummary {
  const editions = [...new Set(sample.companies.flatMap((company) => company.editions.map((entry) => entry.edition)))];
  const searches = sample.companies.flatMap((company) => company.editions);
  return {
    sampledCompanies: sample.companies.length,
    meanCandidatesPerCompany: mean(sample.companies.map((company) => company.candidates)),
    meanClassifiedPerCompany: mean(sample.companies.map((company) => company.classified)),
    meanFoundPerEdition: Object.fromEntries(
      editions.map((edition) => [
        edition,
        mean(sample.companies.map((company) => company.editions.find((entry) => entry.edition === edition)?.found ?? 0)),
      ]),
    ),
    cappedSearches: searches.filter((search) => search.capped).length,
    searches: searches.length,
  };
}
