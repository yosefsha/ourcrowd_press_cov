import { isCronExpression } from './cron-expression';

describe('isCronExpression', () => {
  it.each([
    ['0 7 * * *'],
    ['*/15 * * * *'],
    ['0 7 * * mon-fri'],
    ['30 6,18 1-15 JAN,jul 0'],
    ['0 0 * * 7'],
    ['  0 7 * * *  '],
  ])('accepts %j', (expression) => {
    expect(isCronExpression(expression)).toBe(true);
  });

  it.each([
    [''],
    ['0 7 * *'],
    ['0 0 7 * * *'],
    ['60 7 * * *'],
    ['0 24 * * *'],
    ['0 7 0 * *'],
    ['0 7 * 13 *'],
    ['0 7 * * 8'],
    ['0 7 * * fri-mon'],
    ['*/0 * * * *'],
    ['0 7 * * funday'],
    ['@daily'],
    ['0 7 * * *; rm -rf /'],
  ])('rejects %j', (expression) => {
    expect(isCronExpression(expression)).toBe(false);
  });
});
