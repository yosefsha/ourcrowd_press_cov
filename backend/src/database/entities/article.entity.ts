import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** A single published news item at one Outlet, identified by its Google article ID (ADR-008). */
@Entity({ name: 'articles' })
@Unique('UQ_articles_google_article_id', ['googleArticleId'])
@Index('IDX_articles_published_at', ['publishedAt'])
export class ArticleEntity {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'BY DEFAULT',
    primaryKeyConstraintName: 'PK_articles',
  })
  id!: number;

  @Column({ name: 'google_article_id', type: 'text' })
  googleArticleId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  snippet!: string;

  @Column({ name: 'outlet_name', type: 'text' })
  outletName!: string;

  @Column({ name: 'outlet_url', type: 'text' })
  outletUrl!: string;

  @Column({ name: 'google_url', type: 'text' })
  googleUrl!: string;

  @Column({ name: 'publisher_url', type: 'text', nullable: true })
  publisherUrl!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;

  @Column({ type: 'text' })
  language!: string;

  /** The News Edition the Article was first found in, e.g. `en-US`. */
  @Column({ type: 'text' })
  edition!: string;

  @CreateDateColumn({ name: 'first_fetched_at', type: 'timestamptz' })
  firstFetchedAt!: Date;
}
