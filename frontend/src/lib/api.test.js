import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './api';

describe('getErrorMessage', () => {
  it('prefers structured API error details', () => {
    const error = {
      response: {
        data: {
          error: {
            message: 'Validation failed',
            details: [{ message: 'Email is invalid' }, { message: 'Phone is too short' }],
          },
        },
      },
    };
    expect(getErrorMessage(error)).toBe('Email is invalid, Phone is too short');
  });

  it('falls back to the API message and then the Error message', () => {
    expect(getErrorMessage({ response: { data: { error: { message: 'Forbidden' } } } })).toBe('Forbidden');
    expect(getErrorMessage(new Error('Network down'))).toBe('Network down');
  });

  it('returns a generic message for unknown errors', () => {
    expect(getErrorMessage({})).toBe('Something went wrong');
  });
});
