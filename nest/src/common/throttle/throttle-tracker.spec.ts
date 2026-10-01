import { JwtService } from '@nestjs/jwt';
import { buildThrottleTracker } from './throttle-tracker';

describe('buildThrottleTracker', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const tracker = buildThrottleTracker(jwt);
  const valid = jwt.sign({ sub: 'user-1', tid: 'tenant-1' });

  it('Authorization ヘッダの有効なトークンはユーザー単位で数える', () => {
    expect(tracker({ ip: '203.0.113.1', headers: { authorization: `Bearer ${valid}` } })).toBe(
      'user:user-1',
    );
  });

  it('SSE 用の ?token= の有効なトークンもユーザー単位で数える', () => {
    expect(tracker({ ip: '203.0.113.1', headers: {}, query: { token: valid } })).toBe(
      'user:user-1',
    );
  });

  it('トークンが無ければ IP 単位で数える', () => {
    expect(tracker({ ip: '203.0.113.1', headers: {} })).toBe('ip:203.0.113.1');
  });

  it('別の秘密鍵で署名された（偽造）トークンは IP 単位で数える', () => {
    const forged = new JwtService({ secret: 'other' }).sign({ sub: 'user-2', tid: 'tenant-1' });
    expect(tracker({ ip: '203.0.113.1', headers: { authorization: `Bearer ${forged}` } })).toBe(
      'ip:203.0.113.1',
    );
  });

  it('期限切れのトークンは IP 単位で数える', () => {
    const expired = jwt.sign({ sub: 'user-1', tid: 'tenant-1' }, { expiresIn: -10 });
    expect(tracker({ ip: '203.0.113.1', headers: { authorization: `Bearer ${expired}` } })).toBe(
      'ip:203.0.113.1',
    );
  });

  it('公開 API の API キー（JWT ではない Bearer）は IP 単位で数える', () => {
    expect(tracker({ ip: '203.0.113.1', headers: { authorization: 'Bearer bh_xxx' } })).toBe(
      'ip:203.0.113.1',
    );
  });
});
