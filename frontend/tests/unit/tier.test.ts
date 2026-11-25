import { describe, expect, it } from 'vitest';
import { tierFromAction, tierFromScore } from '@/lib/tier';

describe('tier mapping', () => {
  it('maps the backend action_tier strings', () => {
    expect(tierFromAction('high_trust')).toBe('high');
    expect(tierFromAction('medium_trust')).toBe('medium');
    expect(tierFromAction('low_trust')).toBe('low');
  });

  it('never guesses: unknown or missing values are unscored', () => {
    expect(tierFromAction('critical')).toBeNull();
    expect(tierFromAction('')).toBeNull();
    expect(tierFromAction(null)).toBeNull();
    expect(tierFromAction(undefined)).toBeNull();
  });

  it('cuts at 80 and 50 by default, and honours live cut-offs', () => {
    expect(tierFromScore(80)).toBe('high');
    expect(tierFromScore(79)).toBe('medium');
    expect(tierFromScore(50)).toBe('medium');
    expect(tierFromScore(49)).toBe('low');
    expect(tierFromScore(70, { high_min: 70, medium_min: 40 })).toBe('high');
  });
});
