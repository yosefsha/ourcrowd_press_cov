import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';

import { CompaniesService } from './companies.service';
import { AdminCompaniesQueryDto } from './dto/admin-companies-query.dto';
import { AdminCompanyDto } from './dto/admin-company.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueuedRunDto } from './dto/queued-run.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

/** The companies page's API: Tracked Companies in every status, their profiles and lifecycle. */
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  async list(@Query() query: AdminCompaniesQueryDto): Promise<AdminCompanyDto[]> {
    const companies = await this.companies.list(query);
    return companies.map((company) => new AdminCompanyDto(company));
  }

  @Post()
  async create(@Body() body: CreateCompanyDto): Promise<AdminCompanyDto> {
    return new AdminCompanyDto(await this.companies.create(body));
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCompanyDto): Promise<AdminCompanyDto> {
    return new AdminCompanyDto(await this.companies.update(id, body.toChanges()));
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  async markReviewed(@Param('id', ParseIntPipe) id: number): Promise<AdminCompanyDto> {
    return new AdminCompanyDto(await this.companies.markReviewed(id));
  }

  @Post(':id/needs-review')
  @HttpCode(HttpStatus.OK)
  async sendToReview(@Param('id', ParseIntPipe) id: number): Promise<AdminCompanyDto> {
    return new AdminCompanyDto(await this.companies.sendToReview(id));
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id', ParseIntPipe) id: number): Promise<AdminCompanyDto> {
    return new AdminCompanyDto(await this.companies.deactivate(id));
  }

  @Post(':id/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  async reprocess(@Param('id', ParseIntPipe) id: number): Promise<QueuedRunDto> {
    return new QueuedRunDto(await this.companies.reprocess(id));
  }
}
