import { getCorsOrigins } from './cors.util';

describe('getCorsOrigins', () => {
  it('returns true when no origin env is configured', () => {
    expect(getCorsOrigins({})).toBe(true);
  });

  it('prefers CORS_ORIGIN when present', () => {
    expect(getCorsOrigins({ CORS_ORIGIN: 'https://app.example.com' })).toEqual([
      'https://app.example.com',
    ]);
  });

  it('splits and trims comma-separated origins', () => {
    expect(
      getCorsOrigins({
        CORS_ORIGINS: 'https://app.example.com, https://admin.example.com  ,',
      }),
    ).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });
});
