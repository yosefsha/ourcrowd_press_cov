import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { HealthStatusDto } from './dto/health-status.dto';

/**
 * Liveness probe for the load balancer. Served at `/health`, outside the `/api`
 * prefix, and answers without touching Postgres so a slow database does not get
 * healthy tasks killed.
 */
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): HealthStatusDto {
    return new HealthStatusDto('ok');
  }
}
