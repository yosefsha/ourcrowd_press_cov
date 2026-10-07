# Press Coverage Monitoring

Tracks press coverage of OurCrowd portfolio and fund companies: what was written about each company, its sentiment, and how recently it was covered.

## Language

### Companies

**Tracked Company**:
A company whose press coverage is monitored. Most start from the OurCrowd seed list; others can be added by hand. A Tracked Company is either active or deactivated — deactivated companies keep their history but are no longer monitored.
_Avoid_: Portfolio company (unless the portfolio/fund distinction matters), client, startup

**Seed List**:
The company list supplied by OurCrowd, used once to start the set of Tracked Companies. Not the ongoing source of truth.
_Avoid_: Master list, company file

**Source Name**:
The exact line a Tracked Company had in the Seed List; never changes. Empty for companies added by hand.
_Avoid_: Original name, raw name

**Company Profile**:
The editable context that identifies a Tracked Company in the press: display name, aliases (including former names), domain, a one-line description and search terms.
_Avoid_: Company metadata, enrichment

**Needs Review**:
The state of a Tracked Company judged possibly ambiguous, whose Company Profile must be reviewed by a person before any news is collected for it.
_Avoid_: Pending, flagged, unverified

**Re-process**:
Discarding a Tracked Company's Candidates and Mentions and collecting and classifying them afresh with its current Company Profile.
_Avoid_: Re-classify, refresh, re-run

**Search Terms**:
The query a News Source uses to look for a Tracked Company, chosen to exclude unrelated uses of the company's name.
_Avoid_: Keywords, query

### Coverage

**News Source**:
A provider that, given a Tracked Company, returns Candidates about it (e.g. Google News search, a news API, a scraper).
_Avoid_: Feed, provider, collector

**News Edition**:
A language-and-region variant of a News Source searched separately (e.g. English/US, Hebrew/Israel).
_Avoid_: Locale, market, region

**Article**:
A single published news item at one Outlet. The same story republished by another Outlet is a different Article.
_Avoid_: Story, post, news item

**Outlet**:
The publication an Article appeared in (e.g. Reuters, Calcalist).
_Avoid_: Source (clashes with News Source), publisher, site

**Candidate**:
An Article returned by a News Source for a particular Tracked Company, not yet confirmed to be about that company. One Article can be a Candidate for several Tracked Companies.
_Avoid_: Result, hit, raw article

**Relevance Verdict**:
The judgement, made once per Candidate, of whether it is actually about the Tracked Company, with a short reason.
_Avoid_: Filter result, match

**Mention**:
A Candidate whose Relevance Verdict confirms it is about the Tracked Company — identified by the pair (Article, Tracked Company). Only Mentions carry a Sentiment and count as press coverage.
_Avoid_: Article, hit, press item (when the relevance check has not happened)

**Sentiment**:
Whether a Mention is positive, negative or neutral toward the Tracked Company — not the tone of the article overall.
_Avoid_: Tone, polarity, score

**Mention Status**:
How recently a Tracked Company was last mentioned, as of now and regardless of the Coverage Window: **Active** (≤ 7 days), **Recent** (8–30 days), **Quiet** (31–90 days) or **No coverage** (no Mention found since collection began). Rejected Candidates never count; Sentiment does not matter.
_Avoid_: Last seen, freshness, health

### Time

**Coverage Window**:
The period of Mentions the dashboard shows. Defaults to the rolling last 90 days; can be switched to a calendar quarter (e.g. Q3 2026, or the current quarter to date).
_Avoid_: Last quarter (ambiguous), period, range

**Run**:
One execution of a Backfill or a Daily Check. It is queued, then running, and ends as completed, completed with errors, failed or interrupted. At most one Run is queued or running at a time.
_Avoid_: Job, task, sync

**Backfill**:
The Run that collects Candidates covering the whole Coverage Window, used when monitoring starts. It may stop at a cutoff before today, and it never alerts.
_Avoid_: Initial load, seed run

**Daily Check**:
The Run, intended once a day, that collects Candidates published since the previous successful Daily Check and raises an Alert Digest for New Mentions.
_Avoid_: Cron, sync, refresh

### Alerting

**New Mention**:
A Mention first confirmed as a Mention in the current Daily Check and published within the last 7 days. Only New Mentions are alerted on. (Confirmation, not first fetch, is what counts — a Candidate left unclassified by a failed Run still alerts when a later Run confirms it.)
_Avoid_: Fresh mention, recent mention

**Alert Digest**:
The single summary of all New Mentions found by one Daily Check, grouped by Tracked Company with negative Mentions first. It stays visible in the dashboard until acknowledged.
_Avoid_: Notification, alert email, report
