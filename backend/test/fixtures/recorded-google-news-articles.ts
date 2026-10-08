/**
 * Articles recorded on 2026-10-07 from real Google News RSS searches
 * (`https://news.google.com/rss/search?q="<name>"&hl=en-US&gl=US&ceid=US:en`),
 * first items of each feed, unedited apart from stripping the HTML of the
 * description into `snippet` (ADR-006). Google News does not reveal the
 * publisher URL in the feed, so `publisherUrl` is null as a News Source stores it.
 */
export interface RecordedArticle {
  readonly googleArticleId: string;
  readonly title: string;
  readonly snippet: string;
  readonly outletName: string;
  readonly outletUrl: string;
  readonly googleUrl: string;
  readonly publisherUrl: null;
  readonly publishedAt: Date;
  readonly language: string;
  readonly edition: string;
}

function recorded(fields: Omit<RecordedArticle, 'publisherUrl' | 'publishedAt' | 'language' | 'edition'> & { readonly publishedAt: string }): RecordedArticle {
  return { ...fields, publisherUrl: null, publishedAt: new Date(fields.publishedAt), language: 'en', edition: 'en-US' };
}

/** Search `"<name>"` results per company, in feed order. */
export const RECORDED_ARTICLES = {
  hailo: [
    recorded({
      googleArticleId: "CBMitgFBVV95cUxPV183NnJTTFZncXliZkN1VTRQdnlxYko1R0dZTmRYR1V6SlBQbzZvemYtZ0QzYnhLSGhheUJJQWpHM3JqWVJnUkZia3NfblgxVThtaFo0WHM3elM3VGV2Vmc0SFZQSXA4WDV4R2c0TUItMDd0YVMtVkRVckp5YkxLdjIzd001ellQMG5hSXBfUVh4ekNiWmxIMUdydlNmNHJjcERHUHV4OF8zUEMwcnVxVDdlOG5QQQ",
      title: "Microchip Technology Completes Acquisition of Hailo - Microchip Technology",
      snippet: "Microchip Technology Completes Acquisition of Hailo Microchip Technology",
      outletName: "Microchip Technology",
      outletUrl: "https://ir.microchip.com",
      googleUrl: "https://news.google.com/rss/articles/CBMitgFBVV95cUxPV183NnJTTFZncXliZkN1VTRQdnlxYko1R0dZTmRYR1V6SlBQbzZvemYtZ0QzYnhLSGhheUJJQWpHM3JqWVJnUkZia3NfblgxVThtaFo0WHM3elM3VGV2Vmc0SFZQSXA4WDV4R2c0TUItMDd0YVMtVkRVckp5YkxLdjIzd001ellQMG5hSXBfUVh4ekNiWmxIMUdydlNmNHJjcERHUHV4OF8zUEMwcnVxVDdlOG5QQQ?oc=5",
      publishedAt: "2026-09-21T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMinAFBVV95cUxPeGZrME5GUmJQUkZiNGxyNzY3SHE3RWtnSzB1MkpTcVMxbGRXSlNWNENFdTVUbzIxdE5XdktKR3pTVzAzeGYwQ2hadUNmSnRGWC13NVNBU0lNb29Vbk1OeW1KVmZzS1ZxaGZHdUlVVmpXOG5nNG8wZmFlWXFfVW5PRTZaYUxFLWc4S0lYZncxVEVkeTM5VVp1SUhxcEw",
      title: "Microchip (MCHP) Closes its Hailo Deal. Why the Chipmaker is Buying Edge AI on the Cheap - Yahoo Finance",
      snippet: "Microchip (MCHP) Closes its Hailo Deal. Why the Chipmaker is Buying Edge AI on the Cheap Yahoo Finance",
      outletName: "Yahoo Finance",
      outletUrl: "https://finance.yahoo.com",
      googleUrl: "https://news.google.com/rss/articles/CBMinAFBVV95cUxPeGZrME5GUmJQUkZiNGxyNzY3SHE3RWtnSzB1MkpTcVMxbGRXSlNWNENFdTVUbzIxdE5XdktKR3pTVzAzeGYwQ2hadUNmSnRGWC13NVNBU0lNb29Vbk1OeW1KVmZzS1ZxaGZHdUlVVmpXOG5nNG8wZmFlWXFfVW5PRTZaYUxFLWc4S0lYZncxVEVkeTM5VVp1SUhxcEw?oc=5",
      publishedAt: "2026-09-22T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMipwJBVV95cUxNbWQ5bTZ0NUNZMkZPTGl1Um1rcDBXV3RRTkRfTXZHTHNXeXZrUHN1LWkzMm1uM0ROQnZ5em51QWtENC1CXzdkUEM0UldNNnNNNDhFbG5DN2dDWGRXZWx1am1qU1BYc2NKWC1VU21NeDdjUlBXUW5tYjR3TmhVbXZpdnpTdTRlN2JjWTE5NUJKZ3RCZHVIZUUyandEZDlJVTFBZXM2VFkxRjVsSno3SHN4QURIR0tsVzdvTVg4QXI3ZURTaHJHZlREZUtqa1dnc0ZydnUtYWE4YlZweFhrRURpSmtkcnUyWEgzcFFzNGpVaUN0UVMyN2hXT3phRl9UQmRsUnRCamZVTUZfZVFza2cxNGZKbEs0YUsyV3pwRFlQUXZwRF9zc3hN",
      title: "Hailo-8 Century PCIe Card Starter Kit, Now at Mouser, Powers Automotive, Edge, AI and Video Applications - Electronic Design",
      snippet: "Hailo-8 Century PCIe Card Starter Kit, Now at Mouser, Powers Automotive, Edge, AI and Video Applications Electronic Design",
      outletName: "Electronic Design",
      outletUrl: "https://www.electronicdesign.com",
      googleUrl: "https://news.google.com/rss/articles/CBMipwJBVV95cUxNbWQ5bTZ0NUNZMkZPTGl1Um1rcDBXV3RRTkRfTXZHTHNXeXZrUHN1LWkzMm1uM0ROQnZ5em51QWtENC1CXzdkUEM0UldNNnNNNDhFbG5DN2dDWGRXZWx1am1qU1BYc2NKWC1VU21NeDdjUlBXUW5tYjR3TmhVbXZpdnpTdTRlN2JjWTE5NUJKZ3RCZHVIZUUyandEZDlJVTFBZXM2VFkxRjVsSno3SHN4QURIR0tsVzdvTVg4QXI3ZURTaHJHZlREZUtqa1dnc0ZydnUtYWE4YlZweFhrRURpSmtkcnUyWEgzcFFzNGpVaUN0UVMyN2hXT3phRl9UQmRsUnRCamZVTUZfZVFza2cxNGZKbEs0YUsyV3pwRFlQUXZwRF9zc3hN?oc=5",
      publishedAt: "2026-10-01T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMie0FVX3lxTE1yN0F0QlNFNTNwcWlINHpiamtCa1ZWeWxyazZrejdGcXhfc2didEdOUXdHLWphQjFCQTNCSjA3UWdyZGRUc1NpZEVKMV9kSmFJeXFMNjk1Nlc1S0Q5YzE5Tzk5ZU1NbVVfcjNMOE5pblRCYWZDY2NtRFJ6QQ",
      title: "Microchip acquires edge AI leader Hailo - Jon Peddie Research",
      snippet: "Microchip acquires edge AI leader Hailo Jon Peddie Research",
      outletName: "Jon Peddie Research",
      outletUrl: "https://www.jonpeddie.com",
      googleUrl: "https://news.google.com/rss/articles/CBMie0FVX3lxTE1yN0F0QlNFNTNwcWlINHpiamtCa1ZWeWxyazZrejdGcXhfc2didEdOUXdHLWphQjFCQTNCSjA3UWdyZGRUc1NpZEVKMV9kSmFJeXFMNjk1Nlc1S0Q5YzE5Tzk5ZU1NbVVfcjNMOE5pblRCYWZDY2NtRFJ6QQ?oc=5",
      publishedAt: "2026-09-24T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMiaEFVX3lxTE1xWV9DbElleVNYLV84WUxwRG9NMDVQVjdlWEJMUzRlLTNsYXRvYzVrQTVRODV1azNhZnI2cjNlVnN5LVNfNkpLMjg5N01EdXA2UVFVNXR1TFc2SjJSZUtMd0ZsYTRkMGJZ",
      title: "Microchip acquires Hailo after Israeli AI chip startup's dramatic fall from $1 billion valuation - CTech",
      snippet: "Microchip acquires Hailo after Israeli AI chip startup's dramatic fall from $1 billion valuation CTech",
      outletName: "CTech",
      outletUrl: "https://www.calcalistech.com",
      googleUrl: "https://news.google.com/rss/articles/CBMiaEFVX3lxTE1xWV9DbElleVNYLV84WUxwRG9NMDVQVjdlWEJMUzRlLTNsYXRvYzVrQTVRODV1azNhZnI2cjNlVnN5LVNfNkpLMjg5N01EdXA2UVFVNXR1TFc2SjJSZUtMd0ZsYTRkMGJZ?oc=5",
      publishedAt: "2026-07-25T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMiqwFBVV95cUxOWnJPQ1pTeXN3b1lOSFUtcjd4RjJnMUJJZlFkYVVjdGhqSHRSS0RfWEpjTUpWcVBYSXdvQVdfWi16N0t5ZmZlSW9pblNwUlFOQldxb2J4NlNiNjRrOXRIVjEyZjAtdmtHVm96aE5pbFpOejFNeHZaSWRZQUpXa29sbG5vS3d1cDFXRDU4SjVKWWlNWGttMVQxU0JVWmRRQVBuTWl3bjRUZFE2Y03SAbMBQVVfeXFMTlBpRVJ4WTRVUFMyNC01ei13dkR2YlVPZVR2bEw3STRQbDR2M0lNMDBCSW4yZE9mUDlTQkFEeXN6QWk3a3VvcWtSaGw0clNLMjFtcDJibXNvX1RqUnR2bDJFWDVSb3MzZWR5aVdNZWFqbkUxME9SeWl4ZF9Ka2pWZFFvNVpjOWsxd3VsZUE0NXhVSjlUVGxmeHVrYmJVVXpLazlqR2dUbTFONXM3VUcxS05Ga1U",
      title: "NeoEyes NE503 – A $1199 Edge AI Camera based on Hailo-15H 20 TOPS SoC - CNX Software",
      snippet: "NeoEyes NE503 – A $1199 Edge AI Camera based on Hailo-15H 20 TOPS SoC CNX Software",
      outletName: "CNX Software",
      outletUrl: "https://www.cnx-software.com",
      googleUrl: "https://news.google.com/rss/articles/CBMiqwFBVV95cUxOWnJPQ1pTeXN3b1lOSFUtcjd4RjJnMUJJZlFkYVVjdGhqSHRSS0RfWEpjTUpWcVBYSXdvQVdfWi16N0t5ZmZlSW9pblNwUlFOQldxb2J4NlNiNjRrOXRIVjEyZjAtdmtHVm96aE5pbFpOejFNeHZaSWRZQUpXa29sbG5vS3d1cDFXRDU4SjVKWWlNWGttMVQxU0JVWmRRQVBuTWl3bjRUZFE2Y03SAbMBQVVfeXFMTlBpRVJ4WTRVUFMyNC01ei13dkR2YlVPZVR2bEw3STRQbDR2M0lNMDBCSW4yZE9mUDlTQkFEeXN6QWk3a3VvcWtSaGw0clNLMjFtcDJibXNvX1RqUnR2bDJFWDVSb3MzZWR5aVdNZWFqbkUxME9SeWl4ZF9Ka2pWZFFvNVpjOWsxd3VsZUE0NXhVSjlUVGxmeHVrYmJVVXpLazlqR2dUbTFONXM3VUcxS05Ga1U?oc=5",
      publishedAt: "2026-06-25T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMie0FVX3lxTE1QRFJMeHVxX01Eck5lMFBxRTNkcktRN2oxWm5wRzNxM0wzRldQT0Rycjl4VmUzb0R6XzBTQm5VZkQtak5UaEI0Qlg2NXN2TmxwT1V2RFA1OXJqVlRGVEhrSHpHb1JTbWFnNlJ2SEpmVFVtZUtDMVpualJldw",
      title: "Hailo-8 Century PCIe Card Starter Kit, Now at Mouser, Powers Automotive, Edge, AI and Video Applications - Electronics Media",
      snippet: "Hailo-8 Century PCIe Card Starter Kit, Now at Mouser, Powers Automotive, Edge, AI and Video Applications Electronics Media",
      outletName: "Electronics Media",
      outletUrl: "https://www.electronicsmedia.info",
      googleUrl: "https://news.google.com/rss/articles/CBMie0FVX3lxTE1QRFJMeHVxX01Eck5lMFBxRTNkcktRN2oxWm5wRzNxM0wzRldQT0Rycjl4VmUzb0R6XzBTQm5VZkQtak5UaEI0Qlg2NXN2TmxwT1V2RFA1OXJqVlRGVEhrSHpHb1JTbWFnNlJ2SEpmVFVtZUtDMVpualJldw?oc=5",
      publishedAt: "2026-10-02T07:36:00Z",
    }),
    recorded({
      googleArticleId: "CBMitgFBVV95cUxQYS12SnQ4VjlKZ1RlNXdGOUdlTU5aYWZZeFdsZWF6V1dLZGFHbTVKQXU3ak83cmEtb1AybkJCbElFZVluc0FEamtUMnFWTzRJd2hqRlRETTAxcmJhU3JWY0NWVEo4TFpQR1A5czVqQUlWOE5WOW9td09SVHdNV1FCRGdGcFNYR2I1YmNvMkpiRHFMYXlTbnNGQl9PYm5nQ21waGVYMmJmWXF3N0htMzdHRDYxOE1IUQ",
      title: "Microchip Technology jumps as Hailo close and recovery narrative support the stock - Quiver Quantitative",
      snippet: "Microchip Technology jumps as Hailo close and recovery narrative support the stock Quiver Quantitative",
      outletName: "Quiver Quantitative",
      outletUrl: "https://www.quiverquant.com",
      googleUrl: "https://news.google.com/rss/articles/CBMitgFBVV95cUxQYS12SnQ4VjlKZ1RlNXdGOUdlTU5aYWZZeFdsZWF6V1dLZGFHbTVKQXU3ak83cmEtb1AybkJCbElFZVluc0FEamtUMnFWTzRJd2hqRlRETTAxcmJhU3JWY0NWVEo4TFpQR1A5czVqQUlWOE5WOW9td09SVHdNV1FCRGdGcFNYR2I1YmNvMkpiRHFMYXlTbnNGQl9PYm5nQ21waGVYMmJmWXF3N0htMzdHRDYxOE1IUQ?oc=5",
      publishedAt: "2026-09-25T07:00:00Z",
    }),
  ],
  electreon: [
    recorded({
      googleArticleId: "CBMiigJBVV95cUxPS2JaZ0N0LXNPX2d2b2VqX0g5OFByQkNORm8za1JfWGFIQkJBUUMtRXJ6U2hHV0hOVzd3UDJNMjFadXFDRkZULWZ1Zm1TV05LZEtDeHRYa3ZhTzVPcFRITU1mMFVhV3RKLUJ0b18yd3NUdy1UZzBKQ3A3SFhMQTZ3VGZSZkVPUFpmVVVhRkxmLWlsbHdUUjkySlZqNnpTUUhhS2VvZm1CTV9YTHhfTzBGd21tWUFWQXJnLUcxakpCSGpIN08tcTlzSFB4eW9KODFlM2l5MzBQRW9NdDM4eGtzUFRTT2xGd0t5QzFHY25MVlNzTF9GblBla1JlMGFzQnlZMVRZN2dMUlM3dw",
      title: "Electreon unveils new charging solution at IAA Transportation 2026 With Lite DOT: Charging electric vehicles without cables - PR Newswire",
      snippet: "Electreon unveils new charging solution at IAA Transportation 2026 With Lite DOT: Charging electric vehicles without cables PR Newswire",
      outletName: "PR Newswire",
      outletUrl: "https://www.prnewswire.com",
      googleUrl: "https://news.google.com/rss/articles/CBMiigJBVV95cUxPS2JaZ0N0LXNPX2d2b2VqX0g5OFByQkNORm8za1JfWGFIQkJBUUMtRXJ6U2hHV0hOVzd3UDJNMjFadXFDRkZULWZ1Zm1TV05LZEtDeHRYa3ZhTzVPcFRITU1mMFVhV3RKLUJ0b18yd3NUdy1UZzBKQ3A3SFhMQTZ3VGZSZkVPUFpmVVVhRkxmLWlsbHdUUjkySlZqNnpTUUhhS2VvZm1CTV9YTHhfTzBGd21tWUFWQXJnLUcxakpCSGpIN08tcTlzSFB4eW9KODFlM2l5MzBQRW9NdDM4eGtzUFRTT2xGd0t5QzFHY25MVlNzTF9GblBla1JlMGFzQnlZMVRZN2dMUlM3dw?oc=5",
      publishedAt: "2026-09-14T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMipwFBVV95cUxPLWVBNFV3ZS00dEw5UUJaTkpFNWtiRmd0ODdQbVpfcjdDZ28yWkVWM1NOaW5YQlVLLTk1dV9ydE8zYlpoOXp3amhxUHZCR0dTOUR1eEYyV3U1bDdvdVphdmhnbXB5OUJpRXpaNWJMZUxBRVp4djJBd1A0R202S0s5eG1PNXJaQlhIN182dXVwZTBKWTVVTEpmXzJfTHl6UDZwMEdJNnZtRQ",
      title: "Electreon Debuts 11 kW Wireless Charging Pad for Electric Vehicles - Electric Vehicles",
      snippet: "Electreon Debuts 11 kW Wireless Charging Pad for Electric Vehicles Electric Vehicles",
      outletName: "Electric Vehicles",
      outletUrl: "https://eletric-vehicles.com",
      googleUrl: "https://news.google.com/rss/articles/CBMipwFBVV95cUxPLWVBNFV3ZS00dEw5UUJaTkpFNWtiRmd0ODdQbVpfcjdDZ28yWkVWM1NOaW5YQlVLLTk1dV9ydE8zYlpoOXp3amhxUHZCR0dTOUR1eEYyV3U1bDdvdVphdmhnbXB5OUJpRXpaNWJMZUxBRVp4djJBd1A0R202S0s5eG1PNXJaQlhIN182dXVwZTBKWTVVTEpmXzJfTHl6UDZwMEdJNnZtRQ?oc=5",
      publishedAt: "2026-09-14T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMicEFVX3lxTE13dXQtdi1lYWpWam82Uzhyd2djWDNyMG41QUtfLXhDYVZ5MF9WZThGQlR5dlJialZRb2lSMkJUUDBsR2VpQ19QMnBDcnBka1ZkQ01wTzhiWjFEUmxjSTIzTDZ3eXFFZ0dHRnVBaWV4eW0",
      title: "Electreon Lite DOT: 11 kW Wireless EV Charging - The EV Report",
      snippet: "Electreon Lite DOT: 11 kW Wireless EV Charging The EV Report",
      outletName: "The EV Report",
      outletUrl: "https://theevreport.com",
      googleUrl: "https://news.google.com/rss/articles/CBMicEFVX3lxTE13dXQtdi1lYWpWam82Uzhyd2djWDNyMG41QUtfLXhDYVZ5MF9WZThGQlR5dlJialZRb2lSMkJUUDBsR2VpQ19QMnBDcnBka1ZkQ01wTzhiWjFEUmxjSTIzTDZ3eXFFZ0dHRnVBaWV4eW0?oc=5",
      publishedAt: "2026-09-15T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMipwFBVV95cUxPMXJ2NWM4Nkx4V0ZodHRhTjZrTlVBTktlTjFZcjdxSTdwN3dSWnZldUs3MFNleVJjdm9IQndWYjhVaGtBQXkxcEhjUmtHUTR4R3gxRWRQSDVKa1gxNlBueW5KRThXQllZQkxhU2FWX3hCcE1tX1VfcjRES2RZRTFrVERHZXNwZTNudGpEYmU1amg1R0dPUVNzSmxvSThkMldmVmNQR0UwWQ",
      title: "Electreon introduces wireless charging solution for parking spaces - electrive.com",
      snippet: "Electreon introduces wireless charging solution for parking spaces electrive.com",
      outletName: "electrive.com",
      outletUrl: "https://www.electrive.com",
      googleUrl: "https://news.google.com/rss/articles/CBMipwFBVV95cUxPMXJ2NWM4Nkx4V0ZodHRhTjZrTlVBTktlTjFZcjdxSTdwN3dSWnZldUs3MFNleVJjdm9IQndWYjhVaGtBQXkxcEhjUmtHUTR4R3gxRWRQSDVKa1gxNlBueW5KRThXQllZQkxhU2FWX3hCcE1tX1VfcjRES2RZRTFrVERHZXNwZTNudGpEYmU1amg1R0dPUVNzSmxvSThkMldmVmNQR0UwWQ?oc=5",
      publishedAt: "2026-09-15T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMi7AFBVV95cUxOdzA2dlZPSjM2YUcyRWpmUmRUUzlzLXo1XzRRM3MxdlJ2aEF2Mk5qZlNVa0s2THdYTDA3ZzBCNEFZc0VJanFuWWpRY2pvQlI3Y0E1cWFnR2s5NV9DTTZZbWtTWW5QNE8xalV1OHVPNDA2YnA3Mm1XVGg2VlBoeU1VNUNnb2FlR1E5NnB5dUtzSlVPWmVIMkRJSzU4c2xYVHRfSWJjaDJDSXd1OWNkbHpoNmJiZEN5WFA2TkI1RlNqY1hBOUFhNG5iNjhXX2lvM3VWaWYzNmNzUi1udkVsRVNJc2V1M1d6OXJ0SF9RNQ",
      title: "Electreon completes acquisition of InductEV, establishing a global powerhouse in wireless EV charging - PR Newswire",
      snippet: "Electreon completes acquisition of InductEV, establishing a global powerhouse in wireless EV charging PR Newswire",
      outletName: "PR Newswire",
      outletUrl: "https://www.prnewswire.com",
      googleUrl: "https://news.google.com/rss/articles/CBMi7AFBVV95cUxOdzA2dlZPSjM2YUcyRWpmUmRUUzlzLXo1XzRRM3MxdlJ2aEF2Mk5qZlNVa0s2THdYTDA3ZzBCNEFZc0VJanFuWWpRY2pvQlI3Y0E1cWFnR2s5NV9DTTZZbWtTWW5QNE8xalV1OHVPNDA2YnA3Mm1XVGg2VlBoeU1VNUNnb2FlR1E5NnB5dUtzSlVPWmVIMkRJSzU4c2xYVHRfSWJjaDJDSXd1OWNkbHpoNmJiZEN5WFA2TkI1RlNqY1hBOUFhNG5iNjhXX2lvM3VWaWYzNmNzUi1udkVsRVNJc2V1M1d6OXJ0SF9RNQ?oc=5",
      publishedAt: "2026-03-10T07:00:00Z",
    }),
  ],
  beehero: [
    recorded({
      googleArticleId: "CBMibkFVX3lxTFBTUXFXWHh0cVljbVhoX1piLUdGZVlNcFJwWmJWWGNxU1hzRWRvVG43NHRJQnJibXpZemY4a2FtY29xMGo2dE1BWTFzSTZJcnNaS2pJTGI4dV9PZGpDNWVna2hhZU82b0QtOGZ6WEJn",
      title: "Inside 300,000 hives, BeeHero is measuring what pollination used to leave to guesswork - Ynetnews",
      snippet: "Inside 300,000 hives, BeeHero is measuring what pollination used to leave to guesswork Ynetnews",
      outletName: "Ynetnews",
      outletUrl: "https://www.ynetnews.com",
      googleUrl: "https://news.google.com/rss/articles/CBMibkFVX3lxTFBTUXFXWHh0cVljbVhoX1piLUdGZVlNcFJwWmJWWGNxU1hzRWRvVG43NHRJQnJibXpZemY4a2FtY29xMGo2dE1BWTFzSTZJcnNaS2pJTGI4dV9PZGpDNWVna2hhZU82b0QtOGZ6WEJn?oc=5",
      publishedAt: "2026-09-22T07:00:00Z",
    }),
    recorded({
      googleArticleId: "CBMiowFBVV95cUxQeEVYZVRDVUpURV8xc1pSQUFzZjdiU0owNl9BcFF2NHR5ZXJ6a1B1RWJzc3RCcWRFNWxRS2VBWEJraXhEcy05Um9rcmVlWGd0U080NFJFN0FhWC1GWUVEWm04QzUxMmk0NmlMV0o0V2Y2NFptQTBEOUFHcENHbG9RcG53WC1QY0FwZURBMG5vMHMtcE5MWkdGa3ROS1RDOTQtei0w",
      title: "Pollination Lessons Learned From Inside the Almond Orchard - Growing Produce",
      snippet: "Pollination Lessons Learned From Inside the Almond Orchard Growing Produce",
      outletName: "Growing Produce",
      outletUrl: "https://www.growingproduce.com",
      googleUrl: "https://news.google.com/rss/articles/CBMiowFBVV95cUxQeEVYZVRDVUpURV8xc1pSQUFzZjdiU0owNl9BcFF2NHR5ZXJ6a1B1RWJzc3RCcWRFNWxRS2VBWEJraXhEcy05Um9rcmVlWGd0U080NFJFN0FhWC1GWUVEWm04QzUxMmk0NmlMV0o0V2Y2NFptQTBEOUFHcENHbG9RcG53WC1QY0FwZURBMG5vMHMtcE5MWkdGa3ROS1RDOTQtei0w?oc=5",
      publishedAt: "2026-02-27T16:28:49Z",
    }),
    recorded({
      googleArticleId: "CBMimgFBVV95cUxOdHBONGRKQXpaSXJGX0RVV1hpTGgwMG1nU3JtQ2NqYmpWOE5lWFV4SDIzM2dQbmRhV3ozemY1T2I2b2t2dUtUVmpaN21nempQcmZXMkNiZGJBTDRvSUdaSEg0VDlndDliZk5nTmp5SERFUTNiUlpFM3c2eFcwaVB2VmdYZVQzM2dWQTdncThRNHg5bjZrUl84Z2FR",
      title: "Bulgaria's Webit to invest $100,000 in BeeHero recapitalisation - SeeNews",
      snippet: "Bulgaria's Webit to invest $100,000 in BeeHero recapitalisation SeeNews",
      outletName: "SeeNews",
      outletUrl: "https://seenews.com",
      googleUrl: "https://news.google.com/rss/articles/CBMimgFBVV95cUxOdHBONGRKQXpaSXJGX0RVV1hpTGgwMG1nU3JtQ2NqYmpWOE5lWFV4SDIzM2dQbmRhV3ozemY1T2I2b2t2dUtUVmpaN21nempQcmZXMkNiZGJBTDRvSUdaSEg0VDlndDliZk5nTmp5SERFUTNiUlpFM3c2eFcwaVB2VmdYZVQzM2dWQTdncThRNHg5bjZrUl84Z2FR?oc=5",
      publishedAt: "2026-09-08T07:00:00Z",
    }),
  ],
} as const satisfies Record<string, readonly RecordedArticle[]>;
