import { describe, expect, it } from 'vitest';
import {
  REDACTED_VALUE,
  redactSensitiveData,
  redactStringSecrets,
} from '../../src/utils/redact.ts';

describe('redact utilities', () => {
  it('redacts Bearer tokens, Google API keys, and JWT strings', () => {
    const raw =
      'Authorization: Bearer secret-jwt-token-123 key=AIzaSyDummyKeyValue123456789012345 jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature12345';
    const sanitized = redactStringSecrets(raw);

    expect(sanitized).not.toContain('secret-jwt-token-123');
    expect(sanitized).not.toContain('AIzaSyDummyKeyValue123456789012345');
    expect(sanitized).not.toContain('signature12345');
    expect(sanitized).toContain(REDACTED_VALUE);
  });

  it('recursively redacts sensitive object keys while preserving safe fields', () => {
    const input = {
      requestId: 'req-123',
      headers: {
        authorization: 'Bearer abcdef',
        'x-api-key': 'secret-123',
      },
      nested: {
        geminiApiKey: 'AIzaSyFakeKey123456789012345678',
        city: 'Warsaw',
      },
    };

    const output = redactSensitiveData(input) as typeof input;
    expect(output.requestId).toBe('req-123');
    expect(output.headers.authorization).toBe(REDACTED_VALUE);
    expect(output.headers['x-api-key']).toBe(REDACTED_VALUE);
    expect(output.nested.geminiApiKey).toBe(REDACTED_VALUE);
    expect(output.nested.city).toBe('Warsaw');
  });
});
