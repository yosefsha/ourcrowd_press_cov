# `data/` — snapshot of a real run

This folder holds the export of a complete real run: live Google News feeds, classified by the
local Ollama model (`qwen2.5:7b`). Nothing in it is fabricated or hand-edited
([ADR-006](../docs/adr/ADR-006-real-data-only-recorded-fixtures-in-tests.md)). The file formats are
described in the main README under [The `data/` folder](../README.md#the-data-folder). To browse it
in the dashboard, see [Viewing the committed snapshot](../README.md#viewing-the-committed-snapshot).

Exported **2026-10-09 04:42 UTC** (time zone `Asia/Jerusalem`), `schemaVersion` 1.

## The two Runs

| Run | Type | Trigger | Started (UTC) | Duration | Companies | Candidates classified | Mentions confirmed | Errors |
|---|---|---|---|---|---|---|---|---|
| 1 | Backfill | dashboard | 2026-10-08 18:59 | 2 h 25 min | 147 | 2,458 | 954 | 0 |
| 2 | Daily Check | schedule (07:00 local) | 2026-10-09 04:01 | 41 min | 147 | 475 of 757 found | 138 | 0 |

- **Run 1** backfilled every active company over the whole Coverage Window, with no cutoff.
- **Run 2** was the scheduled Daily Check the next morning. It found 757 Candidates. 282 of them
  were already known from Run 1, so 475 were classified, and 138 became new Mentions. They
  produced the snapshot's **Alert Digest**: 137 items across 12 companies, 17 of them negative
  (`alert-digests.json`, `alerts/2026-10-09-run2.json`). The 138th, a SpaceX article published
  2026-10-02 04:38 UTC, is just over 7 days old, so it is not a New Mention and is not alerted on.

## Counts

| | |
|---|---|
| Tracked Companies | 258 (147 active, 111 in Needs Review) |
| Articles | 2,924 |
| Candidates | 2,933: 1,092 relevant, 1,841 rejected (1,284 by the name check, 557 by Ollama) |
| Mentions | 1,092: 712 positive, 277 neutral, 103 negative |
| Mention dates | 2026-07-11 to 2026-10-09 |
| Companies with at least one Mention | 58 |

**Mention Status at export time** (`mention-status.json`), for all 258 companies: 27 Active,
19 Recent, 12 Quiet, 200 No coverage. The 200 includes the 111 Needs Review companies, which were
never searched.

The most-covered companies are SpaceX (196), Cerebras (140), Beyond Meat (100), BioCatch (67),
OpenEvidence (67), Ursa Major (58), Databricks (53) and Innoviz (52). Eight companies hit the
News Source's per-query cap (`coverageCapped`), so their real coverage is higher than shown:
Beyond Meat, Cerebras, Databricks, Ludeo, Scale AI, SpaceX, Spot AI and Together AI.

## Companies still in Needs Review

The Seed List import triages each name. A name that a plain news search would mostly match to
unrelated articles goes to Needs Review instead of being searched
([ADR-010](../docs/adr/ADR-010-tracked-companies-in-db-with-review-gate.md)). Most of the 111 were flagged because the name is a common English word
(Peak, Wave, Shield, Island, Stripe, Glean), a common Hebrew word, or a first name (Harvey).
**They were not reviewed before this run**, so they have no coverage in the snapshot. That includes
some well-covered companies, such as Anthropic, xAI, Stripe, Lemonade and Groq. Approving a
company on the companies page, with Search Terms that make the name unambiguous, includes it in
the next Run.

<details>
<summary>All 111 Needs Review companies</summary>

Abes Market, Air EV, Amitree, Anthropic, Arrow Global, Astra, BillGuard, Bites, Bizzabo,
BlueCircle (formerly Trellis), Boatsetter, CB4, CarDekho, Carrar, Casper, Classiq, Clinch,
Crosswise, Cyfirma, DailyPay, Eko Health, EquipmentShare, Future Family, Glean, Greenlight, Groq,
Guild, HEQA Security (formerly QuantLR), Hailo, Harvey, Hub Security, IQM, InZiv, Island, ItsMine,
JUMP Bikes, Juganu, Kando, Kardome, Kemtai, Kini, Klook, Lambda (lambda.ai), Lano, Launchpad,
Lemonade, Lifeward (formerly known as ReWalk), MST, Magisto, Maolac, MasterClass, MeMed,
Medisafe, Mentad, Mermade Seafoods, MigVax, Nanomedic, Near, Neolithics, NetOp, Neura, Orchard,
Oriient, Oshi (formerly Plantish), Ossio, Overtime, Parko, Peak, People.ai, Powwow, Privateer,
PulmOne, Ravin AI, RealView Imaging, RepAir Carbon, Rewire, Ro, SSI (Safe Superintelligence),
Sense Education, Sfara, Shield, Shopial, Silo, Sotero, Stoke Space, Stringify, Stripe, Sufresca,
Sweetch, Syqe, Tailor Brands, Tala, TensorWave, Tevel, The Bouqs, The EVERY Company, The
Trendlines Group, Tovala, Treedom, Ubimo, Ukko, VAYAVISION, Wave, Wayup, Workspot, Ynsect,
YuLife, Zippin, mPrest, wefox, xAI

</details>

## Import round-trip

Verified on 2026-10-11 on a fresh Postgres: `npm run migration:run`, then `npm run import-data`,
reported *258 companies, 2924 articles, 2933 candidates (1092 mentions), 2 runs, 1 alert digests*.
That matches `manifest.json`. The API then served the dashboard summary, the per-company Mention
Status and the Alert Digest from the imported data. In the rolling 90-day window the numbers drift
a little from the export (for example 1,087 Mentions rather than 1,092), because the window keeps
moving and the data does not. Pick 2026-Q3 in the Coverage Window selector for a fixed view.
