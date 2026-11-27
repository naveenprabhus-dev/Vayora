const SENSITIVE_KEY_PATTERN =
  /^(authorization|cookie|set-cookie|x-api-key|api[-_]?key|gemini[-_]?api[-_]?key|token|id[-_]?token|access[-_]?token|refresh[-_]?token|password|secret|private[-_]?key|credentials|email|display[-_]?name|photo[-_]?url|provider[-_]?(info|data)|phone[-_]?number|uid|user[-_]?id|owner[-_]?uid)$/i;

const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
];

export const REDACTED_VALUE = '[REDACTED]';

export function redactStringSecrets(input: string): string {
  let sanitized = input;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    sanitized = sanitized.replace(pattern, REDACTED_VALUE);
  }
  return sanitized;
}

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[TRUNCATED]';
  }
  if (typeof value === 'string') {
    return redactStringSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = REDACTED_VALUE;
      } else {
        result[key] = redactSensitiveData(entry, depth + 1);
      }
    }
    return result;
  }
  return value;
}
