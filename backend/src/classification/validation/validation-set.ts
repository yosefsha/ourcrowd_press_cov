import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import { isRecord } from '../prompts/prompt-parts';
import { readCompany } from '../recorded/recorded-verdicts';

/**
 * The classifier validation set (#18): real Candidates taken from recorded
 * Google News feeds (ADR-006), weighted toward ambiguous company names, each to
 * be labelled by a human for relevance and sentiment.
 */

/** Whether a news search for the company's name mostly returns unrelated articles. */
export const NAME_KINDS = ['ambiguous', 'clear'] as const;
export type NameKind = (typeof NAME_KINDS)[number];

/** The article half of a validation item, as a Candidate carries it. */
export interface ValidationArticle {
  readonly title: string;
  readonly snippet: string;
  readonly outlet: string;
  readonly publishedAt: Date;
  /** The Google News link (the publisher URL is not resolved for the set). */
  readonly url: string;
  /** The News Edition it was found in, e.g. `he-IL`. */
  readonly edition: string;
  /** ISO 639-1 language of the edition, e.g. `he`. */
  readonly language: string;
}

/** One Candidate to classify and label. */
export interface ValidationItem {
  /** Stable, human-readable id, e.g. `harvey-en-03`. */
  readonly id: string;
  readonly nameKind: NameKind;
  /** The recorded feed it was taken from, relative to `test/fixtures/`. */
  readonly sourceFeed: string;
  readonly company: CompanyProfile;
  readonly article: ValidationArticle;
}

export interface ValidationSet {
  readonly builtAt: Date;
  readonly items: readonly ValidationItem[];
}

export class InvalidValidationSet extends Error {
  constructor(source: string, problem: string) {
    super(`Invalid validation set in ${source}: ${problem}`);
    this.name = 'InvalidValidationSet';
  }
}

/** The article as the classifiers read it. */
export function toClassifiableArticle(article: ValidationArticle): ClassifiableArticle {
  return {
    title: article.title,
    snippet: article.snippet,
    outletName: article.outlet,
    publishedAt: article.publishedAt,
    language: article.language,
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function readNameKind(value: unknown): NameKind | undefined {
  return (NAME_KINDS as readonly unknown[]).includes(value) ? (value as NameKind) : undefined;
}

function readArticle(value: unknown): ValidationArticle | undefined {
  if (!isRecord(value)) return undefined;
  const title = readString(value.title);
  const snippet = readString(value.snippet);
  const outlet = readString(value.outlet);
  const publishedAt = readDate(value.publishedAt);
  const url = readString(value.url);
  const edition = readString(value.edition);
  const language = readString(value.language);
  if (
    title === undefined ||
    snippet === undefined ||
    outlet === undefined ||
    publishedAt === undefined ||
    url === undefined ||
    edition === undefined ||
    language === undefined
  ) {
    return undefined;
  }
  return { title, snippet, outlet, publishedAt, url, edition, language };
}

function readItem(value: unknown): ValidationItem | undefined {
  if (!isRecord(value)) return undefined;
  const id = readString(value.id);
  const nameKind = readNameKind(value.nameKind);
  const sourceFeed = readString(value.sourceFeed);
  const company = readCompany(value.company);
  const article = readArticle(value.article);
  if (id === undefined || id.trim() === '' || nameKind === undefined || sourceFeed === undefined || !company || !article) {
    return undefined;
  }
  return { id, nameKind, sourceFeed, company, article };
}

/** Validates parsed validation-set JSON; throws `InvalidValidationSet` naming the problem. */
export function parseValidationSet(json: unknown, source: string): ValidationSet {
  if (!isRecord(json)) throw new InvalidValidationSet(source, 'not a JSON object');
  const builtAt = readDate(json.builtAt);
  if (builtAt === undefined) throw new InvalidValidationSet(source, 'builtAt is required');
  if (!Array.isArray(json.items) || json.items.length === 0) {
    throw new InvalidValidationSet(source, 'items must be a non-empty array');
  }
  const ids = new Set<string>();
  const items = json.items.map((entry: unknown, index: number) => {
    const item = readItem(entry);
    if (item === undefined) throw new InvalidValidationSet(source, `item ${index} is malformed`);
    if (ids.has(item.id)) throw new InvalidValidationSet(source, `item id ${item.id} is repeated`);
    ids.add(item.id);
    return item;
  });
  return { builtAt, items };
}

/** JSON form of the set, as written to `test/fixtures/validation/validation-set.json`. */
export function serializeValidationSet(set: ValidationSet): string {
  return `${JSON.stringify(set, null, 2)}\n`;
}
