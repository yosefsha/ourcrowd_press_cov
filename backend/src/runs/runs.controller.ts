import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { EnqueueRunDto } from './dto/enqueue-run.dto';
import { ListRunsQueryDto } from './dto/list-runs-query.dto';
import { RunDetailDto } from './dto/run-detail.dto';
import { RunDto } from './dto/run.dto';
import { RunsService } from './runs.service';

/** The Run queue as the dashboard sees it: enqueue, history, live progress. */
@Controller('runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  /** 202 with the queued Run; 409 `{message, activeRun}` while another Run is active. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueue(@Body() body: EnqueueRunDto): Promise<RunDto> {
    return RunDto.from(await this.runs.enqueue(body));
  }

  /** Recent Runs, newest first. */
  @Get()
  async list(@Query() query: ListRunsQueryDto): Promise<RunDto[]> {
    const runs = await this.runs.listRecent(query.limit);
    return runs.map((run) => RunDto.from(run));
  }

  /** 200 with the queued or running Run; 204 when the queue is idle. */
  @Get('active')
  async active(@Res({ passthrough: true }) response: Response): Promise<RunDto | undefined> {
    const run = await this.runs.findActive();
    if (run === null) {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }
    return RunDto.from(run);
  }

  /** One Run with its per-company errors; 404 for an unknown id. */
  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number): Promise<RunDetailDto> {
    return RunDetailDto.fromDetail(await this.runs.getDetail(id));
  }
}
