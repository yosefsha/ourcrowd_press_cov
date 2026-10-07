import { Controller, Get } from '@nestjs/common';

import { CollectorHealthService } from './collector-health.service';
import { CollectorHealthDto } from './dto/collector-health.dto';

/** The collector's heartbeat as the dashboard shows it. */
@Controller('collector')
export class CollectorHealthController {
  constructor(private readonly collectorHealth: CollectorHealthService) {}

  @Get('health')
  async health(): Promise<CollectorHealthDto> {
    return CollectorHealthDto.from(await this.collectorHealth.health());
  }
}
