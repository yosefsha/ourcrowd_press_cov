import {
  ClassifierOutputInvalid,
  ClassifierUnavailable,
  MAX_DIAGNOSTIC_OUTPUT_LENGTH,
  truncateForDiagnosis,
} from './classifier-errors';

describe('classifier errors', () => {
  it('ClassifierUnavailable is a named Error that keeps its cause', () => {
    const cause = new Error('timeout');
    const error = new ClassifierUnavailable('Ollama did not answer', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ClassifierUnavailable');
    expect(error.cause).toBe(cause);
  });

  it('ClassifierOutputInvalid keeps a short raw output for diagnosis', () => {
    const error = new ClassifierOutputInvalid('not JSON', 'Sure! The answer is…');

    expect(error.name).toBe('ClassifierOutputInvalid');
    expect(error.output).toBe('Sure! The answer is…');
    expect(error).not.toBeInstanceOf(ClassifierUnavailable);
  });

  it('ClassifierOutputInvalid truncates a long raw output and keeps it out of the message', () => {
    const raw = 'x'.repeat(10_000);
    const error = new ClassifierOutputInvalid('not JSON', raw);

    expect(error.output).toHaveLength(MAX_DIAGNOSTIC_OUTPUT_LENGTH);
    expect(error.output.endsWith('…')).toBe(true);
    expect(error.message).toBe('not JSON');
  });
});

describe('truncateForDiagnosis', () => {
  it('leaves text at the limit untouched', () => {
    expect(truncateForDiagnosis('abcde', 5)).toBe('abcde');
  });

  it('cuts longer text to the limit, ellipsis included', () => {
    expect(truncateForDiagnosis('abcdef', 5)).toBe('abcd…');
  });
});
