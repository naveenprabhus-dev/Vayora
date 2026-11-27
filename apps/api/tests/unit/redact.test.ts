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

  it('redacts PII fields and inline email addresses while keeping safe metadata', () => {
    const input = {
      requestId: 'req-pii-1',
      userId: 'uid_abc_123',
      uid: 'uid_abc_123',
      ownerUid: 'uid_abc_123',
      email: 'resident@household.org',
      displayName: 'Elena Nowak',
      photoUrl: 'https://example.org/avatar.png',
      providerInfo: [{ providerId: 'password', email: 'resident@household.org' }],
      message: 'Failed operation for resident@household.org with Bearer secret-token-value',
    };

    const output = redactSensitiveData(input) as typeof input;
    expect(output.requestId).toBe('req-pii-1');
    expect(output.userId).toBe(REDACTED_VALUE);
    expect(output.uid).toBe(REDACTED_VALUE);
    expect(output.ownerUid).toBe(REDACTED_VALUE);
    expect(output.email).toBe(REDACTED_VALUE);
    expect(output.displayName).toBe(REDACTED_VALUE);
    expect(output.photoUrl).toBe(REDACTED_VALUE);
    expect(output.providerInfo).toBe(REDACTED_VALUE);
    expect(output.message).not.toContain('resident@household.org');
    expect(output.message).not.toContain('secret-token-value');
    expect(output.message).toContain(REDACTED_VALUE);
  });
});
