import { generateApiKey, hashApiKey } from './api-key.util';

describe('api-key.util', () => {
  it('hashApiKey は決定的で 64 桁の hex', () => {
    const h1 = hashApiKey('bh_live_abc');
    const h2 = hashApiKey('bh_live_abc');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey('bh_live_xyz')).not.toBe(h1);
  });

  it('generateApiKey は bh_live_ 接頭辞・整合したハッシュ・プレフィックスを返す', () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith('bh_live_')).toBe(true);
    expect(key.hash).toBe(hashApiKey(key.plaintext));
    expect(key.prefix).toBe(key.plaintext.slice(0, 12));
  });

  it('毎回異なるキーを生成する', () => {
    expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
  });
});
