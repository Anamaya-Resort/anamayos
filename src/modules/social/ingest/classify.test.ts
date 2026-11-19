import { describe, expect, it } from 'vitest';
import { classifyPost, extractHashtags } from './classify';

/**
 * The cases that actually went wrong while this was written, kept so
 * they stay fixed. The last two are the substring traps: scoring on
 * plain `includes` tagged a rainforest post as wellness because
 * "rainforest" contains "rest".
 */
describe('classifyPost', () => {
  it('prefers the specific pillar over the general one it contains', () => {
    expect(classifyPost('Day 3 of our 200 hr yoga teacher training', []).slugs[0])
      .toBe('yoga-teacher-training');
  });

  it('still prefers it when the general pillar has more matches', () => {
    const c = classifyPost('Our yoga teacher training: vinyasa, asana, pranayama', []);
    expect(c.slugs[0]).toBe('yoga-teacher-training');
    expect(c.slugs).toContain('yoga');
  });

  it('weights hashtags above prose', () => {
    const caption = 'Cold plunge morning #biohacking #coldplunge';
    expect(classifyPost(caption, extractHashtags(caption)).slugs[0]).toBe('biohacking');
  });

  it('tags adventure content', () => {
    expect(classifyPost('Waterfall hike through the rainforest, sloth spotted', []).slugs[0])
      .toBe('ecolodge-adventure');
  });

  it('leaves a thin caption unclassified rather than guessing', () => {
    expect(classifyPost('Good morning', []).slugs).toHaveLength(0);
    expect(classifyPost(null, []).confidence).toBeNull();
  });

  it('does not find "rest" inside "rainforest"', () => {
    expect(classifyPost('Walking in the rainforest', []).slugs).not.toContain('wellness');
  });

  it('does not find "om" inside "morning"', () => {
    expect(classifyPost('Coming this morning from home', []).slugs).toHaveLength(0);
  });

  it('reports confidence on a 0..1 scale', () => {
    const c = classifyPost('Biohacking: cold plunge, red light, hyperbaric', []);
    expect(c.confidence).toBeGreaterThan(0);
    expect(c.confidence).toBeLessThanOrEqual(1);
  });
});

describe('extractHashtags', () => {
  it('lowercases, strips the hash and deduplicates', () => {
    expect(extractHashtags('#Yoga #yoga #CostaRica done')).toEqual(['yoga', 'costarica']);
  });
  it('handles accented tags', () => {
    expect(extractHashtags('#pura #vidá')).toEqual(['pura', 'vidá']);
  });
  it('returns nothing for an empty caption', () => {
    expect(extractHashtags(null)).toEqual([]);
  });
});
