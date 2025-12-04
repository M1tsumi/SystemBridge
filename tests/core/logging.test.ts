import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../src/core/logging.js';

describe('createLogger', () => {
  it('suppresses log calls below configured level', () => {
    const info = vi.fn();
    const warn = vi.fn();

    const logger = createLogger({
      level: 'warn',
      info,
      warn
    });

    logger.info('hello');
    logger.warn('danger');

    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('danger', undefined);
  });

  it('delegates to supplied logger implementation', () => {
    const debug = vi.fn();
    const custom = createLogger({ level: 'debug', debug });

    custom.debug('payload', { id: 1 });

    expect(debug).toHaveBeenCalledWith('payload', { id: 1 });
  });
});
