import { IsIn } from 'class-validator';

export class HealthStatusDto {
  @IsIn(['ok'])
  readonly status: 'ok';

  constructor(status: 'ok') {
    this.status = status;
  }
}
