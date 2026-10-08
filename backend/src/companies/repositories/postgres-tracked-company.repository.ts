import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';

import type { CompanyProfile, TrackedCompany } from '../../domain/company';
import { TrackedCompanyEntity } from '../../database/entities/tracked-company.entity';
import {
  DuplicateTrackedCompany,
  NewTrackedCompany,
  TrackedCompanyFilter,
  TrackedCompanyNotFound,
  TrackedCompanyRepository,
  TrackedCompanyStatusChange,
} from '../tracked-company.repository';

const UNIQUE_VIOLATION = '23505';
const SOURCE_NAME_INDEX = 'UQ_tracked_companies_source_name';
const DISPLAY_NAME_INDEX = 'UQ_tracked_companies_display_name_live';

/** `TrackedCompanyRepository` on the `tracked_companies` table. */
@Injectable()
export class PostgresTrackedCompanyRepository implements TrackedCompanyRepository {
  constructor(
    @InjectRepository(TrackedCompanyEntity)
    private readonly companies: Repository<TrackedCompanyEntity>,
  ) {}

  async list(filter: TrackedCompanyFilter = {}): Promise<readonly TrackedCompany[]> {
    const query = this.companies.createQueryBuilder('company');
    if (filter.statuses !== undefined) {
      if (filter.statuses.length === 0) return [];
      query.andWhere('company.status IN (:...statuses)', { statuses: [...filter.statuses] });
    }
    if (filter.ids !== undefined) {
      if (filter.ids.length === 0) return [];
      query.andWhere('company.id IN (:...ids)', { ids: [...filter.ids] });
    }
    const text = filter.query?.trim() ?? '';
    if (text !== '') {
      const pattern = `%${escapeLike(text)}%`;
      query.andWhere(
        new Brackets((match) => {
          match
            .where(`company.displayName ILIKE :pattern ESCAPE '\\'`, { pattern })
            .orWhere(`company.sourceName ILIKE :pattern ESCAPE '\\'`, { pattern })
            .orWhere(
              `EXISTS (SELECT 1 FROM unnest(company.aliases) AS alias WHERE alias ILIKE :pattern ESCAPE '\\')`,
              { pattern },
            );
        }),
      );
    }
    query.orderBy('lower(company.displayName)', 'ASC').addOrderBy('company.id', 'ASC');
    const rows = await query.getMany();
    return rows.map(toDomain);
  }

  async get(id: number): Promise<TrackedCompany> {
    return toDomain(await this.findRow(id));
  }

  async create(company: NewTrackedCompany): Promise<TrackedCompany> {
    const row = this.companies.create({
      sourceName: company.sourceName,
      ...profileColumns(company.profile),
      status: company.status,
      reviewReason: company.reviewReason,
    });
    return toDomain(await this.save(row));
  }

  async update(id: number, changes: Partial<CompanyProfile>): Promise<TrackedCompany> {
    const row = await this.findRow(id);
    Object.assign(row, profileColumns(changes));
    return toDomain(await this.save(row));
  }

  async setStatus(id: number, change: TrackedCompanyStatusChange): Promise<TrackedCompany> {
    const row = await this.findRow(id);
    row.status = change.status;
    row.reviewReason = change.status === 'needs_review' ? change.reason : null;
    return toDomain(await this.save(row));
  }

  async recordCoverageCapped(id: number, capped: boolean): Promise<void> {
    const result = await this.companies.update({ id }, { coverageCapped: capped });
    if (result.affected === 0) throw new TrackedCompanyNotFound(id);
  }

  private async findRow(id: number): Promise<TrackedCompanyEntity> {
    const row = await this.companies.findOneBy({ id });
    if (row === null) throw new TrackedCompanyNotFound(id);
    return row;
  }

  /** Saves the row, turning a unique-index violation into `DuplicateTrackedCompany`. */
  private async save(row: TrackedCompanyEntity): Promise<TrackedCompanyEntity> {
    try {
      return await this.companies.save(row);
    } catch (error) {
      const constraint = uniqueViolationConstraint(error);
      if (constraint === SOURCE_NAME_INDEX) throw new DuplicateTrackedCompany('sourceName', row.sourceName ?? '');
      if (constraint === DISPLAY_NAME_INDEX) throw new DuplicateTrackedCompany('displayName', row.displayName);
      throw error;
    }
  }
}

function uniqueViolationConstraint(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) return null;
  const driverError: unknown = error.driverError;
  if (typeof driverError !== 'object' || driverError === null) return null;
  const { code, constraint } = driverError as { code?: unknown; constraint?: unknown };
  return code === UNIQUE_VIOLATION && typeof constraint === 'string' ? constraint : null;
}

function profileColumns(profile: Partial<CompanyProfile>): Partial<TrackedCompanyEntity> {
  return {
    ...(profile.displayName !== undefined && { displayName: profile.displayName }),
    ...(profile.aliases !== undefined && { aliases: [...profile.aliases] }),
    ...(profile.domain !== undefined && { domain: profile.domain }),
    ...(profile.description !== undefined && { description: profile.description }),
    ...(profile.searchTerms !== undefined && { searchTerms: [...profile.searchTerms] }),
  };
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function toDomain(row: TrackedCompanyEntity): TrackedCompany {
  return {
    id: row.id,
    sourceName: row.sourceName,
    status: row.status,
    reviewReason: row.reviewReason,
    coverageCapped: row.coverageCapped,
    profile: {
      displayName: row.displayName,
      aliases: [...row.aliases],
      domain: row.domain,
      description: row.description,
      searchTerms: [...row.searchTerms],
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
