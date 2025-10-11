import { describe, expect, it } from 'vitest';

import { MessageValidationError, validateMessage } from '../../src/validation/validateMessage.js';

describe('validateMessage', () => {
  it('throws a MessageValidationError when the envelope is malformed', () => {
    expect(() => validateMessage({})).toThrow(MessageValidationError);
  });
});
