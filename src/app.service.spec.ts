import { AppService } from './app.service';

describe('AppService', () => {
  it('returns deployment-friendly health metadata', () => {
    const service = new AppService();

    const result = service.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('t-app-backend');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
