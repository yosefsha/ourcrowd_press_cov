import { Controller, Get, Param, Query } from '@nestjs/common';

import { CoverageService } from './coverage.service';
import type { CandidatePageDto } from './dto/candidate-page.dto';
import { CandidatesQueryDto } from './dto/candidates-query.dto';
import { CompaniesQueryDto } from './dto/companies-query.dto';
import { CompanyIdParamDto } from './dto/company-id-param.dto';
import type { CompanyDetailDto } from './dto/company-detail.dto';
import type { CompanyOverviewRowDto } from './dto/company-overview-row.dto';
import type { CoverageSummaryDto } from './dto/coverage-summary.dto';
import { CoverageWindowQueryDto } from './dto/coverage-window-query.dto';

/** Read-only dashboard endpoints for a Coverage Window (`?window=rolling90|YYYY-Qn`). */
@Controller()
export class CoverageController {
  constructor(private readonly coverage: CoverageService) {}

  @Get('summary')
  summary(@Query() query: CoverageWindowQueryDto): Promise<CoverageSummaryDto> {
    return this.coverage.summary(query.window);
  }

  @Get('companies')
  listCompanies(@Query() query: CompaniesQueryDto): Promise<CompanyOverviewRowDto[]> {
    return this.coverage.listCompanies(query);
  }

  @Get('companies/:id')
  getCompany(
    @Param() params: CompanyIdParamDto,
    @Query() query: CoverageWindowQueryDto,
  ): Promise<CompanyDetailDto> {
    return this.coverage.getCompany(params.id, query.window);
  }

  @Get('companies/:id/candidates')
  listCandidates(
    @Param() params: CompanyIdParamDto,
    @Query() query: CandidatesQueryDto,
  ): Promise<CandidatePageDto> {
    return this.coverage.listCandidates(params.id, query);
  }
}
