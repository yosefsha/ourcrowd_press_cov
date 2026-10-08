import type { Sentiment } from '../../domain/sentiment';
import type { OrderedCompanyGroup } from '../alert-digest-ordering';
import type { AlertArticle, StoredAlertMention } from '../alert-digest.repository';
import type { AlertDigestDetail } from '../alerts.service';
import { AlertDigestSummaryResponse } from './alert-digest-summary.response';

/** `Article` in frontend/src/types.ts. */
export class AlertArticleResponse {
  readonly id: number;
  readonly title: string;
  readonly snippet: string;
  readonly outletName: string;
  readonly outletUrl: string;
  readonly googleUrl: string;
  readonly publisherUrl: string | null;
  readonly publishedAt: string;
  readonly language: string;
  readonly edition: string;

  constructor(article: AlertArticle) {
    this.id = article.id;
    this.title = article.title;
    this.snippet = article.snippet;
    this.outletName = article.outletName;
    this.outletUrl = article.outletUrl;
    this.googleUrl = article.googleUrl;
    this.publisherUrl = article.publisherUrl;
    this.publishedAt = article.publishedAt.toISOString();
    this.language = article.language;
    this.edition = article.edition;
  }
}

/** `AlertMention` in frontend/src/types.ts. */
export class AlertMentionResponse {
  readonly candidateId: number;
  readonly sentiment: Sentiment;
  readonly article: AlertArticleResponse;

  constructor(mention: StoredAlertMention) {
    this.candidateId = mention.candidateId;
    this.sentiment = mention.sentiment;
    this.article = new AlertArticleResponse(mention.article);
  }
}

/** `AlertDigestCompanyGroup` in frontend/src/types.ts. */
export class AlertDigestCompanyGroupResponse {
  readonly companyId: number;
  readonly displayName: string;
  readonly mentions: readonly AlertMentionResponse[];

  constructor(group: OrderedCompanyGroup<StoredAlertMention>) {
    this.companyId = group.companyId;
    this.displayName = group.displayName;
    this.mentions = group.mentions.map((mention) => new AlertMentionResponse(mention));
  }
}

/** The full Alert Digest — `AlertDigest` in frontend/src/types.ts. Groups are in digest order. */
export class AlertDigestResponse extends AlertDigestSummaryResponse {
  readonly companies: readonly AlertDigestCompanyGroupResponse[];

  constructor(detail: AlertDigestDetail) {
    super(detail.summary);
    this.companies = detail.companies.map((group) => new AlertDigestCompanyGroupResponse(group));
  }
}
