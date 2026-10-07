import type { FoundArticle } from '../../src/domain/article';

/**
 * Articles recorded from live Google News RSS search feeds on 2026-10-07
 * (ADR-006: no invented articles). Queries:
 * - `"ZutaCore"` and `"Morphisec"`, edition en-US (hl=en-US&gl=US&ceid=US:en)
 * - `"OncoHost"`, edition he-IL (hl=he&gl=IL&ceid=IL:he)
 *
 * Each item is kept as the feed gave it: the `CBMi…` token of the link is the
 * Google article id, the title is the item title without its " - <outlet>"
 * suffix, the snippet is the text of the item description, and the outlet is
 * the item's `<source>`. The publisher URL is null: it is not in the feed.
 */

export const ZUTACORE_SILICONANGLE: FoundArticle = {
  googleArticleId: "CBMingFBVV95cUxPRjNFdE5oTFVTQUh6Z0pjSHhxSnB1SjZtZnItNVdNU0N5TjhBQ1VGcXRVSE83eER3VENSeUNMLWdGQVRQRlhEZGpUb0JlR01DTktiV01KUHJ1SUt1eTE2UzNCYzRQWDdGMUFaR1Z5V3BOYTBHVDdCa1ZQcDJhbG02YngtSm1YbE5BS0phVEs1WkdweWlpbGhBVDlhaUVLZw",
  title: "ZutaCore raises $100M to scale up waterless cooling for AI data centers",
  snippet: "ZutaCore raises $100M to scale up waterless cooling for AI data centers SiliconANGLE",
  outletName: "SiliconANGLE",
  outletUrl: "https://siliconangle.com",
  googleUrl: "https://news.google.com/rss/articles/CBMingFBVV95cUxPRjNFdE5oTFVTQUh6Z0pjSHhxSnB1SjZtZnItNVdNU0N5TjhBQ1VGcXRVSE83eER3VENSeUNMLWdGQVRQRlhEZGpUb0JlR01DTktiV01KUHJ1SUt1eTE2UzNCYzRQWDdGMUFaR1Z5V3BOYTBHVDdCa1ZQcDJhbG02YngtSm1YbE5BS0phVEs1WkdweWlpbGhBVDlhaUVLZw?oc=5",
  publisherUrl: null,
  publishedAt: new Date("2026-06-02T07:00:00.000Z"),
  language: "en",
  edition: "en-US",
};

export const ZUTACORE_DCD_OPTIONS: FoundArticle = {
  googleArticleId: "CBMiywFBVV95cUxPNXN2NTU2S1dWTFdFdXJPbHNIdTd0S29Pbl8tQzg4NjhtT3NhUVM5ekt6eGdaSmZvRTlNT0JjVWRKZmtoYUZHUGNHNXRvaDRwNG1WbHU5b21sNTZaMXFpNm9iNDJ6NGlLaGR1RnJtbXpIU21JSWh3SWZpdXRXal83TU44bU9QVEV4a0hTMUl3RHF4bl9yOXBiS1hXRU5ZcUQzZ1lDX0dtZVRFR2FZV01tTmp3TEhUYUNTXy1sWXJ5TDd5bXlOblNKeVpDdw",
  title: "ZutaCore partners with Options Technology to offer liquid cooling to financial services",
  snippet: "ZutaCore partners with Options Technology to offer liquid cooling to financial services Data Center Dynamics",
  outletName: "Data Center Dynamics",
  outletUrl: "https://www.datacenterdynamics.com",
  googleUrl: "https://news.google.com/rss/articles/CBMiywFBVV95cUxPNXN2NTU2S1dWTFdFdXJPbHNIdTd0S29Pbl8tQzg4NjhtT3NhUVM5ekt6eGdaSmZvRTlNT0JjVWRKZmtoYUZHUGNHNXRvaDRwNG1WbHU5b21sNTZaMXFpNm9iNDJ6NGlLaGR1RnJtbXpIU21JSWh3SWZpdXRXal83TU44bU9QVEV4a0hTMUl3RHF4bl9yOXBiS1hXRU5ZcUQzZ1lDX0dtZVRFR2FZV01tTmp3TEhUYUNTXy1sWXJ5TDd5bXlOblNKeVpDdw?oc=5",
  publisherUrl: null,
  publishedAt: new Date("2026-09-30T14:04:28.000Z"),
  language: "en",
  edition: "en-US",
};

export const ZUTACORE_ALLEYWATCH: FoundArticle = {
  googleArticleId: "CBMigAFBVV95cUxOM2g2N2JmOF8zT2ZBbldObnpzdUNqRUZqS0psTGZ1YjYwd2VLLXFObE5JUTU2SzhKakp0NWRWSGdNSUZ2WnpDbVk1TWJQUTQtWm1yYk55djFOeldrMTJuSlNQZW5uWWMwVHhGQWN5NDNOVUg3WHZPaGRneG8zWkc2UA",
  title: "The 24 Largest US Funding Rounds of June 2026",
  snippet: "The 24 Largest US Funding Rounds of June 2026 AlleyWatch",
  outletName: "AlleyWatch",
  outletUrl: "https://alleywatch.com",
  googleUrl: "https://news.google.com/rss/articles/CBMigAFBVV95cUxOM2g2N2JmOF8zT2ZBbldObnpzdUNqRUZqS0psTGZ1YjYwd2VLLXFObE5JUTU2SzhKakp0NWRWSGdNSUZ2WnpDbVk1TWJQUTQtWm1yYk55djFOeldrMTJuSlNQZW5uWWMwVHhGQWN5NDNOVUg3WHZPaGRneG8zWkc2UA?oc=5",
  publisherUrl: null,
  publishedAt: new Date("2026-07-21T13:30:11.000Z"),
  language: "en",
  edition: "en-US",
};

export const MORPHISEC_AI_TRUST: FoundArticle = {
  googleArticleId: "CBMivgFBVV95cUxNbXQtb25jUXpWUmIyRjExSU1rRXFvQmlUMUoyaWl1el9LOXg1cmlXSVM5cXBtUHVQcnAzMG9GekdHWGxleUF2LWNzcE44Sk9qZXdzSkJVdk9obkdoclFUNFRSXzVFVnRuUDNQU3haOE5RZEt5V3c4ZE5MZUd3cU5hbnk3WU56aEt0Wmx2clljR0tZOFRhZWpLUXEyU3UyQVBnQ2Y1b0JvWUJNaTdTSTREcUw5WmlmVGNZbDFJRzZn",
  title: "Aligning AI Speed with AI Trust: AI Agent Security Insights for CISOs and Security Leaders",
  snippet: "Aligning AI Speed with AI Trust: AI Agent Security Insights for CISOs and Security Leaders Morphisec",
  outletName: "Morphisec",
  outletUrl: "https://www.morphisec.com",
  googleUrl: "https://news.google.com/rss/articles/CBMivgFBVV95cUxNbXQtb25jUXpWUmIyRjExSU1rRXFvQmlUMUoyaWl1el9LOXg1cmlXSVM5cXBtUHVQcnAzMG9GekdHWGxleUF2LWNzcE44Sk9qZXdzSkJVdk9obkdoclFUNFRSXzVFVnRuUDNQU3haOE5RZEt5V3c4ZE5MZUd3cU5hbnk3WU56aEt0Wmx2clljR0tZOFRhZWpLUXEyU3UyQVBnQ2Y1b0JvWUJNaTdTSTREcUw5WmlmVGNZbDFJRzZn?oc=5",
  publisherUrl: null,
  publishedAt: new Date("2026-09-30T13:10:36.000Z"),
  language: "en",
  edition: "en-US",
};

export const MORPHISEC_ROGUEPLANET: FoundArticle = {
  googleArticleId: "CBMiuAFBVV95cUxOS1B0QnFqYVZSQTZ3WWdyM2s3SjZBMDZsdUl5VVpyZ1duT1NLLXVPLWpyUWdUNFJsLUZEcU9yZGVrTllhdEFFZTMteFBOR3pXeEdxTWl3dm5WQ3VweDVTaW5pYjVQWUs0TlVvOWc4dHF2bGJCMWNlNUxiYjlrZWFEMGdDUWNKRVZYMkpQZmczVXlyb0ZHckp2M3RqMlYwWkU0SXM5SW1OZHN3LWJUd2xOLWgydmN0V0VY",
  title: "Microsoft Defender Zero Day RoguePlanet: When Your Detector Becomes the Attack Surface",
  snippet: "Microsoft Defender Zero Day RoguePlanet: When Your Detector Becomes the Attack Surface Morphisec",
  outletName: "Morphisec",
  outletUrl: "https://www.morphisec.com",
  googleUrl: "https://news.google.com/rss/articles/CBMiuAFBVV95cUxOS1B0QnFqYVZSQTZ3WWdyM2s3SjZBMDZsdUl5VVpyZ1duT1NLLXVPLWpyUWdUNFJsLUZEcU9yZGVrTllhdEFFZTMteFBOR3pXeEdxTWl3dm5WQ3VweDVTaW5pYjVQWUs0TlVvOWc4dHF2bGJCMWNlNUxiYjlrZWFEMGdDUWNKRVZYMkpQZmczVXlyb0ZHckp2M3RqMlYwWkU0SXM5SW1OZHN3LWJUd2xOLWgydmN0V0VY?oc=5",
  publisherUrl: null,
  publishedAt: new Date("2026-06-18T07:00:00.000Z"),
  language: "en",
  edition: "en-US",
};

export const ONCOHOST_ICE: FoundArticle = {
  googleArticleId: "CBMiXEFVX3lxTE5zMWlVUUxBNV9MWkJZWGE3R1hCbjJ0ZnIyekEycE5Hb05OSVk3MGpPVEV3a21WZVFSRldVdUM5NnNaQWlOZGJGektQTnJjUEx6X2dvdXJHaldZTGZG",
  title: "האם התרופה לסרטן תצא מישראל? \"תרופות ב-60 מיליארד דולר בשנה\"",
  snippet: "האם התרופה לסרטן תצא מישראל? \"תרופות ב-60 מיליארד דולר בשנה\" ice (אייס)",
  outletName: "ice (אייס)",
  outletUrl: "https://www.ice.co.il",
  googleUrl: "https://news.google.com/rss/articles/CBMiXEFVX3lxTE5zMWlVUUxBNV9MWkJZWGE3R1hCbjJ0ZnIyekEycE5Hb05OSVk3MGpPVEV3a21WZVFSRldVdUM5NnNaQWlOZGJGektQTnJjUEx6X2dvdXJHaldZTGZG?oc=5",
  publisherUrl: null,
  publishedAt: new Date("2023-05-16T07:00:00.000Z"),
  language: "he",
  edition: "he-IL",
};

export const ONCOHOST_B7NET: FoundArticle = {
  googleArticleId: "CBMi1wRBVV95cUxQLTFWVGowZ1U4YU5ULUJpWkQzd1l0cWkwNHJBZ1JURTZmT3ZFMU5tSUIwNklhOW40dlF2STVmMFE0YzVEWWVtUmRaMFZ3eHFRM0Q1a2lqVWZrVkw2a2pHclhoeGhIUEM1RGlyQUtKZUtqRWk2NEhFcDVQTkFLWFdOd2dxdi0wejQzbnlVMFMyUUJwekx5QWJkZDVuRWZSeDJqM05IcGFuLUsxRm5nSnVKc1NNOWNCUDI3MWdrTXptYkZKUHNCb3FEZFNaLW9rOWNtRDZZUzNzQk5zdVlkX3Zvb2poTlJxanhIMGV5RE1nVkZxVDZZWnN2LVFGYW1LampjUnhNT2s2UFluX1JtQjBNQW5hQlByT0RSUEpxdElaNWVCQ2NoVy1vc0pSWTFMZkJ4MjZoZURDN0E3V3Eyd3B2cE9wcDVLMjZLZWtvMmFFYk8xemwxLXFfdnNvclZMdm5TcE8zSmpGNHh4b05qbHpETzNia2pmUFZwcmw3b3puN0s5Mk1HQm5WYVJYTVhjZml6ZzQ1d01oQ3U5WGdkYk84UkZfSjVxVER4dzFyV2NjWXd0R1lScnlTZG5hZDlVSXRQUXpOcUlVc2hBNVZhS0tOa0pmVy11Q1MyWFlUak5yLUFiT3VCZTkyTHEtUDJBY3dpWUJWY0J5QzN4aXlRYjVSQmZxUE92M0YyYzA4Y1I1RnpWSXctZzl3WjNjdGVEOWtNcmdHY2tRa0tVRFdqMno5Wmt3S2cxVXpzWXRJYlpXWVJJeXkxUEZQZnYzSXhOT1JlajZhUU1lQQ",
  title: "חוקרים בבן גוריון הגיעו לפריצת דרך מהפכנית בחקר מחלת הסרטן (כל הפרטים) -",
  snippet: "חוקרים בבן גוריון הגיעו לפריצת דרך מהפכנית בחקר מחלת הסרטן (כל הפרטים) - באר שבע נט",
  outletName: "באר שבע נט",
  outletUrl: "https://www.b7net.co.il",
  googleUrl: "https://news.google.com/rss/articles/CBMi1wRBVV95cUxQLTFWVGowZ1U4YU5ULUJpWkQzd1l0cWkwNHJBZ1JURTZmT3ZFMU5tSUIwNklhOW40dlF2STVmMFE0YzVEWWVtUmRaMFZ3eHFRM0Q1a2lqVWZrVkw2a2pHclhoeGhIUEM1RGlyQUtKZUtqRWk2NEhFcDVQTkFLWFdOd2dxdi0wejQzbnlVMFMyUUJwekx5QWJkZDVuRWZSeDJqM05IcGFuLUsxRm5nSnVKc1NNOWNCUDI3MWdrTXptYkZKUHNCb3FEZFNaLW9rOWNtRDZZUzNzQk5zdVlkX3Zvb2poTlJxanhIMGV5RE1nVkZxVDZZWnN2LVFGYW1LampjUnhNT2s2UFluX1JtQjBNQW5hQlByT0RSUEpxdElaNWVCQ2NoVy1vc0pSWTFMZkJ4MjZoZURDN0E3V3Eyd3B2cE9wcDVLMjZLZWtvMmFFYk8xemwxLXFfdnNvclZMdm5TcE8zSmpGNHh4b05qbHpETzNia2pmUFZwcmw3b3puN0s5Mk1HQm5WYVJYTVhjZml6ZzQ1d01oQ3U5WGdkYk84UkZfSjVxVER4dzFyV2NjWXd0R1lScnlTZG5hZDlVSXRQUXpOcUlVc2hBNVZhS0tOa0pmVy11Q1MyWFlUak5yLUFiT3VCZTkyTHEtUDJBY3dpWUJWY0J5QzN4aXlRYjVSQmZxUE92M0YyYzA4Y1I1RnpWSXctZzl3WjNjdGVEOWtNcmdHY2tRa0tVRFdqMno5Wmt3S2cxVXpzWXRJYlpXWVJJeXkxUEZQZnYzSXhOT1JlajZhUU1lQQ?oc=5",
  publisherUrl: null,
  publishedAt: new Date("2023-05-31T07:00:00.000Z"),
  language: "he",
  edition: "he-IL",
};

export const RECORDED_ARTICLES: readonly FoundArticle[] = [ZUTACORE_SILICONANGLE, ZUTACORE_DCD_OPTIONS, ZUTACORE_ALLEYWATCH, MORPHISEC_AI_TRUST, MORPHISEC_ROGUEPLANET, ONCOHOST_ICE, ONCOHOST_B7NET];
