import { AlertDeliveryFailed } from './alert-notifier';

describe('AlertDeliveryFailed', () => {
  it('names the channel and keeps the cause', () => {
    const cause = new Error('EACCES');
    const error = new AlertDeliveryFailed('file', 'cannot write', { cause });

    expect(error.name).toBe('AlertDeliveryFailed');
    expect(error.channel).toBe('file');
    expect(error.message).toBe('Alert delivery via file failed: cannot write');
    expect(error.cause).toBe(cause);
  });
});
