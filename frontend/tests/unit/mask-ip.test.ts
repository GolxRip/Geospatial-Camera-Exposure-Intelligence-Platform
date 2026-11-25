import { describe, expect, it } from 'vitest';
import { maskIp } from '@/lib/privacy/mask-ip';

describe('maskIp', () => {
  it('masks IPv4 to the /24 by default', () => {
    expect(maskIp('203.0.113.45', { reveal: false })).toBe('203.0.113.•');
    expect(maskIp('  10.0.0.7 ', { reveal: false })).toBe('10.0.0.•');
  });

  it('normalises leading zeros instead of echoing them', () => {
    expect(maskIp('010.001.000.009', { reveal: false })).toBe('10.1.0.•');
  });

  it('masks IPv6 to the first three groups', () => {
    expect(maskIp('2001:db8:abcd:12::1', { reveal: false })).toBe('2001:db8:abcd:•');
    expect(maskIp('2001:DB8::1', { reveal: false })).toBe('2001:db8:•');
  });

  it('treats an IPv4-mapped IPv6 address as its IPv4 part', () => {
    expect(maskIp('::ffff:203.0.113.45', { reveal: false })).toBe('203.0.113.•');
  });

  it('never echoes a value that is not an address', () => {
    for (const bad of [
      '',
      'not an address',
      '999.1.1.1',
      '1.2.3',
      '1.2.3.4.5',
      '<script>',
      '1.2.3.4/24',
      'localhost',
    ]) {
      const out = maskIp(bad, { reveal: false });
      expect(out, bad).toBe('•••');
    }
    expect(maskIp(null, { reveal: false })).toBe('•••');
    expect(maskIp(undefined, { reveal: false })).toBe('•••');
  });

  it('never leaves the last octet in a masked result', () => {
    for (let i = 0; i < 256; i += 1) {
      expect(maskIp(`198.51.100.${i}`, { reveal: false })).toBe('198.51.100.•');
    }
  });

  it('shows the full address only when reveal is on', () => {
    expect(maskIp('203.0.113.45', { reveal: true })).toBe('203.0.113.45');
  });

  it('defaults to masked (NEXT_PUBLIC_REVEAL_IP is not set in tests)', () => {
    expect(maskIp('203.0.113.45')).toBe('203.0.113.•');
  });
});
