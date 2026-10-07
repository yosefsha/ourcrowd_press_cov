import { NewsSourceUnavailable } from './news-source';

describe('NewsSourceUnavailable', () => {
  it('is a named Error that keeps its cause', () => {
    const cause = new Error('ECONNRESET');
    const error = new NewsSourceUnavailable('Google News did not answer', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NewsSourceUnavailable');
    expect(error.message).toBe('Google News did not answer');
    expect(error.cause).toBe(cause);
  });
});
