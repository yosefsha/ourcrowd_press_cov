import { ClassifierOutputInvalid, ClassifierUnavailable } from './classifier-errors';

describe('classifier errors', () => {
  it('ClassifierUnavailable is a named Error that keeps its cause', () => {
    const cause = new Error('timeout');
    const error = new ClassifierUnavailable('Ollama did not answer', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ClassifierUnavailable');
    expect(error.cause).toBe(cause);
  });

  it('ClassifierOutputInvalid keeps the raw output for diagnosis', () => {
    const error = new ClassifierOutputInvalid('not JSON', 'Sure! The answer is…');

    expect(error.name).toBe('ClassifierOutputInvalid');
    expect(error.output).toBe('Sure! The answer is…');
    expect(error).not.toBeInstanceOf(ClassifierUnavailable);
  });
});
