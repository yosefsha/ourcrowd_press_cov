import type { FoundArticle } from '../../../src/domain/article';

/**
 * Articles recorded from real Google News RSS search responses (ADR-006) on
 * 2026-10-07, `https://news.google.com/rss/search?q="<company>"&hl=en-US&gl=US&ceid=US:en`.
 * Every field is copied from the feed item: `googleArticleId` is the `CBMi…`
 * token of `<link>`, `snippet` is `<description>` with its markup stripped,
 * `outletName` / `outletUrl` are `<source>`, and `publishedAt` is `<pubDate>`.
 * The publisher URL was not resolved, as in the feed.
 *
 * Keyed by the Tracked Company (from docs/ourcrowd_companies.txt) whose search
 * returned the item.
 */
export const RECORDED_ARTICLES = {
  morphisecAiTrust: {
    company: 'Morphisec',
    article: {
      googleArticleId:
        'CBMivgFBVV95cUxNbXQtb25jUXpWUmIyRjExSU1rRXFvQmlUMUoyaWl1el9LOXg1cmlXSVM5cXBtUHVQcnAzMG9GekdHWGxleUF2LWNzcE44Sk9qZXdzSkJVdk9obkdoclFUNFRSXzVFVnRuUDNQU3haOE5RZEt5V3c4ZE5MZUd3cU5hbnk3WU56aEt0Wmx2clljR0tZOFRhZWpLUXEyU3UyQVBnQ2Y1b0JvWUJNaTdTSTREcUw5WmlmVGNZbDFJRzZn',
      title:
        'Aligning AI Speed with AI Trust: AI Agent Security Insights for CISOs and Security Leaders - Morphisec',
      snippet:
        'Aligning AI Speed with AI Trust: AI Agent Security Insights for CISOs and Security Leaders Morphisec',
      outletName: 'Morphisec',
      outletUrl: 'https://www.morphisec.com',
      googleUrl:
        'https://news.google.com/rss/articles/CBMivgFBVV95cUxNbXQtb25jUXpWUmIyRjExSU1rRXFvQmlUMUoyaWl1el9LOXg1cmlXSVM5cXBtUHVQcnAzMG9GekdHWGxleUF2LWNzcE44Sk9qZXdzSkJVdk9obkdoclFUNFRSXzVFVnRuUDNQU3haOE5RZEt5V3c4ZE5MZUd3cU5hbnk3WU56aEt0Wmx2clljR0tZOFRhZWpLUXEyU3UyQVBnQ2Y1b0JvWUJNaTdTSTREcUw5WmlmVGNZbDFJRzZn?oc=5',
      publisherUrl: null,
      publishedAt: new Date('2026-09-30T13:10:36Z'),
      language: 'en',
      edition: 'en-US',
    },
  },
  zutacoreDcdPartnership: {
    company: 'ZutaCore',
    article: {
      googleArticleId:
        'CBMiywFBVV95cUxPNXN2NTU2S1dWTFdFdXJPbHNIdTd0S29Pbl8tQzg4NjhtT3NhUVM5ekt6eGdaSmZvRTlNT0JjVWRKZmtoYUZHUGNHNXRvaDRwNG1WbHU5b21sNTZaMXFpNm9iNDJ6NGlLaGR1RnJtbXpIU21JSWh3SWZpdXRXal83TU44bU9QVEV4a0hTMUl3RHF4bl9yOXBiS1hXRU5ZcUQzZ1lDX0dtZVRFR2FZV01tTmp3TEhUYUNTXy1sWXJ5TDd5bXlOblNKeVpDdw',
      title:
        'ZutaCore partners with Options Technology to offer liquid cooling to financial services - Data Center Dynamics',
      snippet:
        'ZutaCore partners with Options Technology to offer liquid cooling to financial services Data Center Dynamics',
      outletName: 'Data Center Dynamics',
      outletUrl: 'https://www.datacenterdynamics.com',
      googleUrl:
        'https://news.google.com/rss/articles/CBMiywFBVV95cUxPNXN2NTU2S1dWTFdFdXJPbHNIdTd0S29Pbl8tQzg4NjhtT3NhUVM5ekt6eGdaSmZvRTlNT0JjVWRKZmtoYUZHUGNHNXRvaDRwNG1WbHU5b21sNTZaMXFpNm9iNDJ6NGlLaGR1RnJtbXpIU21JSWh3SWZpdXRXal83TU44bU9QVEV4a0hTMUl3RHF4bl9yOXBiS1hXRU5ZcUQzZ1lDX0dtZVRFR2FZV01tTmp3TEhUYUNTXy1sWXJ5TDd5bXlOblNKeVpDdw?oc=5',
      publisherUrl: null,
      publishedAt: new Date('2026-09-30T14:04:28Z'),
      language: 'en',
      edition: 'en-US',
    },
  },
  zutacoreBusinessWirePartnership: {
    company: 'ZutaCore',
    article: {
      googleArticleId:
        'CBMiiwJBVV95cUxOUVFzM3Q2LThiMGNqMFhoanNsN29kUXBhYVZPNFB4ekhHS1VXVlNxOXMyX1RXZllWaHZrbVRyNGdkc3I0dVl6dVJKVUhPaF9FYkZnWjRLRzBkMFI2eGJNOUsxX2g4Q1dKdFZYUWtSdnp4N3AwRm8xZjJ5cG9TNjF4SFNxLTFzaHJGXzNWMmdkRnNiQU1UYm12cENrZks5ZjdlYWpfR1NzT2ZOcnZGd3VaZndFa0paX1doODl1X2tHdzVoOE9ySFlyZGlUdzV5STR2R2hDTlZPUFc0aUZFNUgtMzNTQ1E4dzFVelJsTHF0dnZVTkU2bXZPMFhhVUNxNjRnenlaS2tTMGFfQkk',
      title:
        'Options Technology Partners with ZutaCore to Bring Waterless, Two-Phase Liquid Cooling to Financial Services Infrastructure - Business Wire',
      snippet:
        'Options Technology Partners with ZutaCore to Bring Waterless, Two-Phase Liquid Cooling to Financial Services Infrastructure Business Wire',
      outletName: 'Business Wire',
      outletUrl: 'https://www.businesswire.com',
      googleUrl:
        'https://news.google.com/rss/articles/CBMiiwJBVV95cUxOUVFzM3Q2LThiMGNqMFhoanNsN29kUXBhYVZPNFB4ekhHS1VXVlNxOXMyX1RXZllWaHZrbVRyNGdkc3I0dVl6dVJKVUhPaF9FYkZnWjRLRzBkMFI2eGJNOUsxX2g4Q1dKdFZYUWtSdnp4N3AwRm8xZjJ5cG9TNjF4SFNxLTFzaHJGXzNWMmdkRnNiQU1UYm12cENrZks5ZjdlYWpfR1NzT2ZOcnZGd3VaZndFa0paX1doODl1X2tHdzVoOE9ySFlyZGlUdzV5STR2R2hDTlZPUFc0aUZFNUgtMzNTQ1E4dzFVelJsTHF0dnZVTkU2bXZPMFhhVUNxNjRnenlaS2tTMGFfQkk?oc=5',
      publisherUrl: null,
      publishedAt: new Date('2026-09-23T07:00:00Z'),
      language: 'en',
      edition: 'en-US',
    },
  },
  zutacoreFunding: {
    company: 'ZutaCore',
    article: {
      googleArticleId:
        'CBMingFBVV95cUxPRjNFdE5oTFVTQUh6Z0pjSHhxSnB1SjZtZnItNVdNU0N5TjhBQ1VGcXRVSE83eER3VENSeUNMLWdGQVRQRlhEZGpUb0JlR01DTktiV01KUHJ1SUt1eTE2UzNCYzRQWDdGMUFaR1Z5V3BOYTBHVDdCa1ZQcDJhbG02YngtSm1YbE5BS0phVEs1WkdweWlpbGhBVDlhaUVLZw',
      title: 'ZutaCore raises $100M to scale up waterless cooling for AI data centers - SiliconANGLE',
      snippet: 'ZutaCore raises $100M to scale up waterless cooling for AI data centers SiliconANGLE',
      outletName: 'SiliconANGLE',
      outletUrl: 'https://siliconangle.com',
      googleUrl:
        'https://news.google.com/rss/articles/CBMingFBVV95cUxPRjNFdE5oTFVTQUh6Z0pjSHhxSnB1SjZtZnItNVdNU0N5TjhBQ1VGcXRVSE83eER3VENSeUNMLWdGQVRQRlhEZGpUb0JlR01DTktiV01KUHJ1SUt1eTE2UzNCYzRQWDdGMUFaR1Z5V3BOYTBHVDdCa1ZQcDJhbG02YngtSm1YbE5BS0phVEs1WkdweWlpbGhBVDlhaUVLZw?oc=5',
      publisherUrl: null,
      publishedAt: new Date('2026-06-02T07:00:00Z'),
      language: 'en',
      edition: 'en-US',
    },
  },
  oncohostAward: {
    company: 'OncoHost',
    article: {
      googleArticleId:
        'CBMi0wFBVV95cUxON1UydF9mWHFZMTZIZkl4T0MyZllfOFdpWU9GQ3gwdTc1blRnSjdkUVBmYTFmQ1Qzb3BXSVZTdDJJSWJfb2E5TUJBUVJkdC1GdnpHWGVaajZLRFExWHJNLXQ5RnV0RGdmbWJmVnNGMnR2VG9hZXdZa2V6Tk1FZ2dXaTZubEh2VURMLVVIekJjR0cxcm03OHZhRkMxdkozWnZZblNEakduV0pHb2dyaDZxSW5KbHdpOVlESGVIMnFYUU1wdGxxSi1uSko4ZGhUOThyMlpn',
      title: 'OncoHost Wins 2026 Artificial Intelligence Excellence Award in Health Category - PR Newswire',
      snippet: 'OncoHost Wins 2026 Artificial Intelligence Excellence Award in Health Category PR Newswire',
      outletName: 'PR Newswire',
      outletUrl: 'https://www.prnewswire.com',
      googleUrl:
        'https://news.google.com/rss/articles/CBMi0wFBVV95cUxON1UydF9mWHFZMTZIZkl4T0MyZllfOFdpWU9GQ3gwdTc1blRnSjdkUVBmYTFmQ1Qzb3BXSVZTdDJJSWJfb2E5TUJBUVJkdC1GdnpHWGVaajZLRFExWHJNLXQ5RnV0RGdmbWJmVnNGMnR2VG9hZXdZa2V6Tk1FZ2dXaTZubEh2VURMLVVIekJjR0cxcm03OHZhRkMxdkozWnZZblNEakduV0pHb2dyaDZxSW5KbHdpOVlESGVIMnFYUU1wdGxxSi1uSko4ZGhUOThyMlpn?oc=5',
      publisherUrl: null,
      publishedAt: new Date('2026-03-24T07:00:00Z'),
      language: 'en',
      edition: 'en-US',
    },
  },
} as const satisfies Record<string, { readonly company: string; readonly article: FoundArticle }>;
