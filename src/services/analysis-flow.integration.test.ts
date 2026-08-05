import { beforeEach, describe, expect, it } from 'vitest';
import {
  InMemoryPokoraRepository,
  resetInMemoryStore,
} from '@/repositories/in-memory-repository';
import { getRepository, setRepository } from '@/repositories';
import { InMemoryFileStorage, setFileStorage } from '@/repositories/storage';
import { getProviders, setProviders } from '@/providers/registry';
import type { CardCatalogProvider } from '@/providers/types';
import {
  changeCardMatch,
  confirmCardMatch,
  confirmCardMatches,
  createAnalysisSession,
  finaliseAnalysis,
  getReviewData,
  markCardUnknown,
  registerUploadedImage,
  removeDetectedCard,
  startAnalysis,
} from './analysis-service';
import { CATALOG_LOOKUP_CONCURRENCY, runAnalysis } from './analysis-pipeline';
import { generateCollectionReport } from './report-service';
import { addConfirmedCardsToCollection } from './collection-service';
import { createTestPng } from '@/test/fixtures/test-image';
import type { Requester } from './analysis-access';

/**
 * End-to-end exercise of the service layer on mock providers and the in-memory
 * store. Nothing is stubbed except the transport: the real validation,
 * matching, pricing, report and authorisation code all run.
 */

const GUEST_TOKEN = 'integration-guest-token-0123456789';
const guest: Requester = { userId: null, guestToken: GUEST_TOKEN };

beforeEach(() => {
  resetInMemoryStore();
  setRepository(new InMemoryPokoraRepository());
  setFileStorage(new InMemoryFileStorage());
  setProviders(null);
});

async function uploadOne(sessionId: string, filename = 'binder-page-1.png') {
  return registerUploadedImage({
    sessionId,
    requester: guest,
    file: {
      filename,
      declaredMimeType: 'image/png',
      bytes: createTestPng(),
    },
  });
}

async function runFullAnalysis() {
  const session = await createAnalysisSession({
    userId: null,
    guestToken: GUEST_TOKEN,
    ipAddress: '198.51.100.5',
  });
  await uploadOne(session.id);
  await startAnalysis({ sessionId: session.id, requester: guest });
  await runAnalysis(session.id);
  return session;
}

/**
 * Wraps the real mock catalog so lookups take measurable time and records how
 * many were in flight at once.
 */
function instrumentedCatalog() {
  const base = getProviders().catalog;
  const state = { peak: 0, active: 0, calls: 0 };
  const catalog: CardCatalogProvider = {
    name: base.name,
    getCardById: (id) => base.getCardById(id),
    searchCards: async (query) => {
      state.calls += 1;
      state.active += 1;
      state.peak = Math.max(state.peak, state.active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.active -= 1;
      return base.searchCards(query);
    },
  };
  setProviders({ ...getProviders(), catalog });
  return state;
}

describe('catalog matching runs concurrently', () => {
  it('overlaps lookups instead of walking the page one card at a time', async () => {
    const state = instrumentedCatalog();
    await runFullAnalysis();

    // The mock page holds nine cards, so a serial run would peak at one.
    expect(state.calls).toBeGreaterThan(1);
    expect(state.peak).toBeGreaterThan(1);
    expect(state.peak).toBeLessThanOrEqual(CATALOG_LOOKUP_CONCURRENCY);
  });

  it('still produces the same matches as a serial run', async () => {
    const serial = await runFullAnalysis();
    const serialCards = await getRepository().listDetectedCards(serial.id);
    const serialSelection = serialCards.map(
      (card) => card.selectedCatalogCardId,
    );

    resetInMemoryStore();
    setRepository(new InMemoryPokoraRepository());
    setFileStorage(new InMemoryFileStorage());
    setProviders(null);
    instrumentedCatalog();

    const parallel = await runFullAnalysis();
    const parallelCards = await getRepository().listDetectedCards(parallel.id);

    expect(parallelCards.map((card) => card.selectedCatalogCardId)).toEqual(
      serialSelection,
    );
  });
});

describe('creating an analysis session', () => {
  it('starts in the created state with a guest expiry', async () => {
    const session = await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: null,
    });
    expect(session.status).toBe('created');
    expect(session.guestToken).toBe(GUEST_TOKEN);
    expect(session.expiresAt).not.toBeNull();
  });

  it('does not expire sessions owned by a user', async () => {
    const session = await createAnalysisSession({
      userId: 'user-1',
      guestToken: 'ignored',
      ipAddress: null,
    });
    expect(session.userId).toBe('user-1');
    expect(session.guestToken).toBeNull();
    expect(session.expiresAt).toBeNull();
  });

  it('lets a guest retry after an analysis that found nothing', async () => {
    await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: '198.51.100.5',
    });

    // No cards detected, so the first attempt delivered no value and must not
    // cost the guest their single daily analysis.
    const retry = await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: '198.51.100.5',
    });
    expect(retry.status).toBe('created');
  });

  it('enforces the guest daily limit once an analysis produced cards', async () => {
    const first = await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: '198.51.100.5',
    });
    await getRepository().updateSession(first.id, {
      status: 'needs_review',
      detectedCardsCount: 9,
    });

    await expect(
      createAnalysisSession({
        userId: null,
        guestToken: GUEST_TOKEN,
        ipAddress: '198.51.100.5',
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('registering an image', () => {
  it('stores a valid PNG and records its real dimensions', async () => {
    const session = await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: null,
    });
    const image = await uploadOne(session.id);

    expect(image.mimeType).toBe('image/png');
    expect(image.width).toBe(2400);
    expect(image.height).toBe(1800);
    expect(image.processingStatus).toBe('pending');
    expect(image.storagePath).not.toContain('binder-page-1');
  });

  it('rejects a file whose bytes are not an image', async () => {
    const session = await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: null,
    });
    await expect(
      registerUploadedImage({
        sessionId: session.id,
        requester: guest,
        file: {
          filename: 'evil.png',
          declaredMimeType: 'image/png',
          bytes: new TextEncoder().encode('<?php echo "hi"; ?>'),
        },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_VALIDATION' });
  });

  it('rejects an unsupported declared MIME type', async () => {
    const session = await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: null,
    });
    await expect(
      registerUploadedImage({
        sessionId: session.id,
        requester: guest,
        file: {
          filename: 'doc.pdf',
          declaredMimeType: 'application/pdf',
          bytes: createTestPng(),
        },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_VALIDATION' });
  });

  it('enforces the guest image limit', async () => {
    const session = await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: null,
    });
    await uploadOne(session.id, 'a.png');
    await uploadOne(session.id, 'b.png');
    await uploadOne(session.id, 'c.png');
    await expect(uploadOne(session.id, 'd.png')).rejects.toMatchObject({
      code: 'UPLOAD_VALIDATION',
    });
  });

  it("denies uploading into someone else's session", async () => {
    const session = await createAnalysisSession({
      userId: null,
      guestToken: GUEST_TOKEN,
      ipAddress: null,
    });
    await expect(
      registerUploadedImage({
        sessionId: session.id,
        requester: { userId: null, guestToken: 'a-different-token' },
        file: {
          filename: 'x.png',
          declaredMimeType: 'image/png',
          bytes: createTestPng(),
        },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED_ANALYSIS_ACCESS' });
  });
});

describe('running the mock pipeline', () => {
  it('reaches needs_review and produces detected cards', async () => {
    const created = await runFullAnalysis();
    const session = await getRepository().getSession(created.id);

    expect(session?.status).toBe('needs_review');
    expect(session?.statusDetail).toBeNull();
    expect(session!.detectedCardsCount).toBeGreaterThan(0);
  });

  it('attaches ranked candidates and preselects confident matches', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });

    const withCandidates = cards.filter((card) => card.candidates.length > 0);
    expect(withCandidates.length).toBeGreaterThan(0);
    expect(cards.some((card) => card.selectedCatalogCard !== null)).toBe(true);

    for (const card of withCandidates) {
      expect(card.candidates.length).toBeLessThanOrEqual(5);
      const scores = card.candidates.map((c) => c.candidate.matchScore);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
  });

  it('never marks a card as user-confirmed automatically', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    expect(cards.every((card) => card.card.userConfirmed === false)).toBe(true);
  });

  it('marks illegible cards as unknown', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    expect(cards.some((card) => card.card.reviewStatus === 'unknown')).toBe(
      true,
    );
  });

  it('leaves condition on unknown for a binder page', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    const binderCards = cards.filter(
      (card) => card.card.region.width * card.card.region.height < 0.45,
    );
    expect(binderCards.length).toBeGreaterThan(0);
    expect(
      binderCards.every((card) => card.card.conditionEstimate === 'unknown'),
    ).toBe(true);
  });

  it('fetches prices for preselected cards', async () => {
    const created = await runFullAnalysis();
    const prices = await getRepository().listPriceEstimates(created.id);
    expect(prices.length).toBeGreaterThan(0);
    expect(prices.every((price) => price.currency === 'EUR')).toBe(true);
  });

  it('records at least one card without usable price data', async () => {
    const created = await runFullAnalysis();
    const prices = await getRepository().listPriceEstimates(created.id);
    expect(prices.some((price) => price.mid === null)).toBe(true);
  });

  it('is deterministic across runs', async () => {
    const first = await runFullAnalysis();
    const firstCards = (
      await getReviewData({ sessionId: first.id, requester: guest })
    ).cards.map((card) => card.card.visibleName);

    resetInMemoryStore();
    setRepository(new InMemoryPokoraRepository());
    setFileStorage(new InMemoryFileStorage());

    const second = await runFullAnalysis();
    const secondCards = (
      await getReviewData({ sessionId: second.id, requester: guest })
    ).cards.map((card) => card.card.visibleName);

    expect(secondCards).toEqual(firstCards);
  });
});

describe('review actions', () => {
  it('confirms a card and updates the session counters', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    const target = cards.find((card) => card.selectedCatalogCard !== null)!;

    const updated = await confirmCardMatch({
      detectedCardId: target.card.id,
      requester: guest,
    });
    expect(updated.reviewStatus).toBe('confirmed');
    expect(updated.userConfirmed).toBe(true);

    const session = await getRepository().getSession(created.id);
    expect(session?.confirmedCardsCount).toBe(1);
  });

  it('refuses to confirm a card without a selected match', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    const unmatched = cards.find((card) => card.selectedCatalogCard === null);
    if (!unmatched) return;

    await expect(
      confirmCardMatch({ detectedCardId: unmatched.card.id, requester: guest }),
    ).rejects.toMatchObject({ code: 'UPLOAD_VALIDATION' });
  });

  it('changes a match, marks it corrected and reprices it', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    const target = cards.find((card) => card.candidates.length > 1)!;
    const alternative = target.candidates[1]!.catalogCard!;

    const updated = await changeCardMatch({
      detectedCardId: target.card.id,
      catalogCardId: alternative.id,
      requester: guest,
    });

    expect(updated.selectedCatalogCardId).toBe(alternative.id);
    expect(updated.reviewStatus).toBe('corrected');
    expect(updated.userConfirmed).toBe(true);

    const prices = await getRepository().listPriceEstimates(created.id);
    const price = prices.find((p) => p.detectedCardId === target.card.id);
    expect(price?.catalogCardId).toBe(alternative.id);
  });

  it('marks a card unknown and clears its selection', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    const target = cards.find((card) => card.selectedCatalogCard !== null)!;

    const updated = await markCardUnknown({
      detectedCardId: target.card.id,
      requester: guest,
    });
    expect(updated.reviewStatus).toBe('unknown');
    expect(updated.selectedCatalogCardId).toBeNull();
  });

  it('removes a card together with its candidates and price', async () => {
    const created = await runFullAnalysis();
    const before = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    const target = before.cards[0]!;

    await removeDetectedCard({
      detectedCardId: target.card.id,
      requester: guest,
    });

    const after = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    expect(after.cards).toHaveLength(before.cards.length - 1);

    const candidates = await getRepository().listMatchCandidates(created.id);
    expect(candidates.some((c) => c.detectedCardId === target.card.id)).toBe(
      false,
    );
  });

  it('confirms many cards in one call and counts them once', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    const matched = cards.filter((card) => card.selectedCatalogCard !== null);
    expect(matched.length).toBeGreaterThan(1);

    const result = await confirmCardMatches({
      detectedCardIds: matched.map((card) => card.card.id),
      requester: guest,
    });

    expect(result.confirmed).toBe(matched.length);
    expect(result.skipped).toBe(0);

    const session = await getRepository().getSession(created.id);
    expect(session?.confirmedCardsCount).toBe(matched.length);
  });

  it('skips unmatched cards in a bulk confirm instead of failing', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    const unmatched = cards.filter((card) => card.selectedCatalogCard === null);
    const matched = cards.filter((card) => card.selectedCatalogCard !== null);
    expect(unmatched.length).toBeGreaterThan(0);

    const result = await confirmCardMatches({
      detectedCardIds: [...matched, ...unmatched].map((card) => card.card.id),
      requester: guest,
    });

    expect(result.confirmed).toBe(matched.length);
    expect(result.skipped).toBe(unmatched.length);
  });

  it('denies a bulk confirm from another requester', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    await expect(
      confirmCardMatches({
        detectedCardIds: [cards[0]!.card.id],
        requester: { userId: null, guestToken: 'not-my-token' },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED_ANALYSIS_ACCESS' });
  });

  it('denies review actions from another requester', async () => {
    const created = await runFullAnalysis();
    const { cards } = await getReviewData({
      sessionId: created.id,
      requester: guest,
    });
    await expect(
      markCardUnknown({
        detectedCardId: cards[0]!.card.id,
        requester: { userId: null, guestToken: 'not-my-token' },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED_ANALYSIS_ACCESS' });
  });
});

describe('report generation', () => {
  async function confirmEverythingMatched(sessionId: string) {
    const { cards } = await getReviewData({ sessionId, requester: guest });
    let confirmed = 0;
    for (const card of cards) {
      if (!card.selectedCatalogCard) continue;
      await confirmCardMatch({
        detectedCardId: card.card.id,
        requester: guest,
      });
      confirmed += 1;
    }
    return confirmed;
  }

  it('excludes unreviewed cards from the total', async () => {
    const created = await runFullAnalysis();
    const report = await generateCollectionReport(created.id, guest);

    expect(report.summary.totalConfirmed).toBe(0);
    expect(report.summary.totalValue.mid).toBeNull();
    expect(report.summary.totalDetected).toBeGreaterThan(0);
  });

  it('produces an ordered band once cards are confirmed', async () => {
    const created = await runFullAnalysis();
    const confirmed = await confirmEverythingMatched(created.id);
    expect(confirmed).toBeGreaterThan(0);

    const report = await generateCollectionReport(created.id, guest);
    const { low, mid, high } = report.summary.totalValue;

    expect(mid).not.toBeNull();
    expect(low!).toBeLessThanOrEqual(mid!);
    expect(mid!).toBeLessThanOrEqual(high!);
    expect(report.summary.totalConfirmed).toBe(confirmed);
  });

  it('reports cards without price data instead of counting them as zero', async () => {
    const created = await runFullAnalysis();
    await confirmEverythingMatched(created.id);
    const report = await generateCollectionReport(created.id, guest);

    expect(report.summary.cardsWithoutPriceData).toBeGreaterThan(0);
    expect(
      report.warnings.some((warning) => warning.includes('niet als €0')),
    ).toBe(true);
    expect(
      report.allCards.some(
        (card) => !card.hasPriceData && card.lineValue.mid === null,
      ),
    ).toBe(true);
  });

  it('limits top cards to ten and sorts them descending', async () => {
    const created = await runFullAnalysis();
    await confirmEverythingMatched(created.id);
    const report = await generateCollectionReport(created.id, guest);

    expect(report.topCards.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < report.topCards.length; i += 1) {
      expect(report.topCards[i - 1]!.lineValue.mid!).toBeGreaterThanOrEqual(
        report.topCards[i]!.lineValue.mid!,
      );
    }
  });

  it('flags attention cards with a reason and no financial advice', async () => {
    const created = await runFullAnalysis();
    await confirmEverythingMatched(created.id);
    const report = await generateCollectionReport(created.id, guest);

    expect(report.attentionCards.length).toBeGreaterThan(0);
    for (const card of report.attentionCards) {
      expect(card.attentionReasons.length).toBeGreaterThan(0);
      for (const reason of card.attentionReasons) {
        expect(reason.message.toLowerCase()).not.toMatch(
          /verkoop nu|koop nu|investeer|beleggingsadvies|gaat stijgen/,
        );
      }
    }
  });

  it('computes a data quality score between 0 and 100 with an explanation', async () => {
    const created = await runFullAnalysis();
    await confirmEverythingMatched(created.id);
    const report = await generateCollectionReport(created.id, guest);

    expect(report.dataQuality.score).toBeGreaterThanOrEqual(0);
    expect(report.dataQuality.score).toBeLessThanOrEqual(100);
    expect(report.dataQuality.explanation.length).toBeGreaterThan(10);
    expect(report.dataQuality.factors.length).toBe(8);
  });

  it('keeps the narrative consistent with the computed totals', async () => {
    const created = await runFullAnalysis();
    await confirmEverythingMatched(created.id);
    const report = await generateCollectionReport(created.id, guest);

    expect(report.narrative.summary).toContain(
      String(report.summary.totalConfirmed),
    );
    expect(report.narrative.cautions.join(' ')).toContain('indicatief');
  });

  it('denies report access to another requester', async () => {
    const created = await runFullAnalysis();
    await expect(
      generateCollectionReport(created.id, {
        userId: null,
        guestToken: 'someone-else',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED_ANALYSIS_ACCESS' });
  });

  it('finalises the analysis into the completed state', async () => {
    const created = await runFullAnalysis();
    await confirmEverythingMatched(created.id);
    const session = await finaliseAnalysis({
      sessionId: created.id,
      requester: guest,
    });
    expect(session.status).toBe('completed');
    expect(session.completedAt).not.toBeNull();
  });
});

describe('collection', () => {
  it('adds only confirmed cards to a user collection', async () => {
    const repository = getRepository();
    const session = await createAnalysisSession({
      userId: 'user-1',
      guestToken: 'ignored',
      ipAddress: null,
    });
    const user: Requester = { userId: 'user-1', guestToken: null };

    await registerUploadedImage({
      sessionId: session.id,
      requester: user,
      file: {
        filename: 'page.png',
        declaredMimeType: 'image/png',
        bytes: createTestPng(),
      },
    });
    await startAnalysis({ sessionId: session.id, requester: user });
    await runAnalysis(session.id);

    const { cards } = await getReviewData({
      sessionId: session.id,
      requester: user,
    });
    const matched = cards.filter((card) => card.selectedCatalogCard !== null);
    await confirmCardMatch({
      detectedCardId: matched[0]!.card.id,
      requester: user,
    });

    const added = await addConfirmedCardsToCollection({
      sessionId: session.id,
      userId: 'user-1',
    });
    expect(added).toBe(1);

    const collection = await repository.listCollection('user-1');
    expect(collection).toHaveLength(1);
    expect(collection[0]?.userId).toBe('user-1');
  });
});
