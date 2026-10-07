import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import { AlertsService } from './alerts.service';
import { AlertDigestIdParams } from './dto/alert-digest-id.params';
import { AlertDigestSummaryResponse } from './dto/alert-digest-summary.response';
import { AlertDigestResponse } from './dto/alert-digest.response';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';

/** Alert Digests for the dashboard's alert bell (ADR-004). */
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  async list(@Query() query: ListAlertsQueryDto): Promise<AlertDigestSummaryResponse[]> {
    const summaries = await this.alerts.list({ acknowledged: query.acknowledged, limit: query.limit });
    return summaries.map((summary) => new AlertDigestSummaryResponse(summary));
  }

  @Get(':id')
  async get(@Param() params: AlertDigestIdParams): Promise<AlertDigestResponse> {
    return new AlertDigestResponse(await this.alerts.get(params.id));
  }

  /** Idempotent: a second acknowledgement returns the digest unchanged. */
  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledge(@Param() params: AlertDigestIdParams): Promise<AlertDigestSummaryResponse> {
    return new AlertDigestSummaryResponse(await this.alerts.acknowledge(params.id));
  }
}
