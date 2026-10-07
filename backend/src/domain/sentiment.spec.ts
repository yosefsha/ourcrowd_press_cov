import { isSentiment } from './sentiment';

describe('isSentiment', () => {
  it.each([['positive'], ['negative'], ['neutral']])('accepts %s', (value) => {
    expect(isSentiment(value)).toBe(true);
  });

  it.each([['Positive'], ['mixed'], [''], [null], [1], [undefined]])('rejects %j', (value) => {
    expect(isSentiment(value)).toBe(false);
  });
});
