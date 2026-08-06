import { describe, expect, it } from 'vitest';
import { MAX_RECOMMENDATIONS, RuleBasedEventAdvisor } from './advisor';
import { getEventsRepository } from './repository';
import { generateEventSummary } from './summary';
import type { EventDetail } from './types';

const advisor = new RuleBasedEventAdvisor();

async function catalogue(): Promise<EventDetail[]> {
  const repository = getEventsRepository();
  const list = await repository.listEvents();
  const details = await Promise.all(
    list.map((item) => repository.getEventBySlug(item.event.slug)),
  );
  return details.filter((detail): detail is EventDetail => detail !== null);
}

describe('RuleBasedEventAdvisor', () => {
  it('returns at most three recommendations', async () => {
    const result = await advisor.advise(
      { interests: ['vintage'], originId: null, maxDistanceKm: null },
      await catalogue(),
    );
    expect(result.recommendations.length).toBeLessThanOrEqual(
      MAX_RECOMMENDATIONS,
    );
  });

  it('gives every recommendation a reason it can be held to', async () => {
    const result = await advisor.advise(
      { interests: ['psa', 'vintage'], originId: null, maxDistanceKm: null },
      await catalogue(),
    );
    for (const entry of result.recommendations) {
      expect(entry.reasons.length).toBeGreaterThan(0);
      expect(entry.reasons[0]?.label.length).toBeGreaterThan(0);
    }
  });

  it('puts a graded-heavy fair on top for someone asking about PSA', async () => {
    const result = await advisor.advise(
      { interests: ['psa'], originId: null, maxDistanceKm: null },
      await catalogue(),
    );
    const top = result.recommendations[0];
    expect(top).toBeDefined();
    expect(top?.item.event.slug).toBe('rotterdam-graded-expo');
  });

  it('surfaces a Japanese-import fair for someone asking about Japans', async () => {
    const result = await advisor.advise(
      { interests: ['japans'], originId: null, maxDistanceKm: null },
      await catalogue(),
    );
    const slugs = result.recommendations.map((entry) => entry.item.event.slug);
    expect(slugs).toContain('antwerpen-japan-import-fair');
  });

  it('prefers a free fair for a budget visitor', async () => {
    const result = await advisor.advise(
      { interests: ['budget'], originId: null, maxDistanceKm: null },
      await catalogue(),
    );
    const top = result.recommendations[0];
    expect(top?.item.ticketStatus).toBe('free');
  });

  it('says so when no preference was given instead of pretending to advise', async () => {
    const result = await advisor.advise(
      { interests: [], originId: null, maxDistanceKm: null },
      await catalogue(),
    );
    expect(result.caveats.join(' ')).toContain('geen voorkeuren');
  });

  it('flags that distance was ignored without a departure point', async () => {
    const result = await advisor.advise(
      { interests: ['vintage'], originId: null, maxDistanceKm: 25 },
      await catalogue(),
    );
    expect(result.caveats.join(' ')).toContain('vertrekplaats');
  });

  it('falls back beyond the radius rather than returning nothing', async () => {
    const result = await advisor.advise(
      { interests: ['vintage'], originId: 'groningen', maxDistanceKm: 5 },
      await catalogue(),
    );
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.caveats.join(' ')).toContain('dichtstbijzijnde');
  });

  it('respects a radius that does contain events', async () => {
    const result = await advisor.advise(
      { interests: ['vintage'], originId: 'utrecht', maxDistanceKm: 60 },
      await catalogue(),
    );
    for (const entry of result.recommendations) {
      expect(entry.distanceKm).not.toBeNull();
      expect(entry.distanceKm ?? 0).toBeLessThanOrEqual(60);
    }
  });
});

describe('generateEventSummary', () => {
  it('names the specialisations that are actually present', async () => {
    const detail = await getEventsRepository().getEventBySlug(
      'rotterdam-graded-expo',
    );
    expect(detail).not.toBeNull();
    const summary = generateEventSummary(detail!);
    const text = summary.paragraphs.join(' ');
    expect(text).toContain('geslabde kaarten');
    expect(summary.basedOn.join(' ')).toContain('standhoudersprofielen');
  });

  it('admits when an event has no reviews yet', async () => {
    const detail = await getEventsRepository().getEventBySlug(
      'utrecht-lorcana-gathering',
    );
    const summary = generateEventSummary(detail!);
    expect(summary.paragraphs.join(' ')).toContain('nog geen beoordelingen');
  });

  it('never invents a vendor count', async () => {
    const detail = await getEventsRepository().getEventBySlug(
      'gent-one-piece-convention',
    );
    const summary = generateEventSummary(detail!);
    expect(summary.paragraphs.join(' ')).toContain(
      String(detail!.vendors.length),
    );
  });
});
