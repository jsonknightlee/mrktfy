const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'x-api-key',
  'x-test-login-secret',
]);

const isPlainObject = (value) => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

export const redactToken = (value, visibleChars = 6) => {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (value.length <= visibleChars * 2) return '[redacted]';
  return `${value.slice(0, visibleChars)}…[redacted]…${value.slice(-visibleChars)}`;
};

export const redactHeaders = (headers = {}) => {
  if (!isPlainObject(headers) && typeof headers !== 'object') return headers;

  return Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => {
      const lowerKey = String(key).toLowerCase();
      if (SENSITIVE_HEADER_KEYS.has(lowerKey)) {
        return [key, '[redacted]'];
      }

      if (lowerKey === 'cookie' || lowerKey === 'set-cookie') {
        return [key, '[redacted]'];
      }

      return [key, value];
    })
  );
};

export const redactRequestConfig = (config = {}) => ({
  method: config.method,
  url: config.url,
  baseURL: config.baseURL,
  headers: redactHeaders(config.headers),
  data: isPlainObject(config.data) ? config.data : config.data,
});

export const redactAuthPayload = (payload = {}) => {
  if (!isPlainObject(payload)) return payload;

  const result = { ...payload };
  for (const key of Object.keys(result)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('token') || lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('authorization')) {
      result[key] = '[redacted]';
    }
  }

  return result;
};
