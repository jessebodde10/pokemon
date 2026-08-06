import { distanceKm, findOrigin } from './distance';
import { summariseReviews } from './reviews';
import type { EventDetail, EventListItem } from './types';

/**
 * The event advisor.
 *
 * Rule-based on purpose. Every point a recommendation scores is attached to a
 * reason, so the advice can explain itself instead of asserting. When this is
 * replaced by a model, the model has to produce the same `AdvisorResult`
 * shape - including the reasons - so the interface never regresses into an
 * unexplained ranking.
 */

export const ADVISOR_INTERESTS = [
  'vintage',
  'modern',
  'sealed',
  'one-piece',
  'budget',
  'japans',
  'psa',
  'singles',
] as const;

export type AdvisorInterest = (typeof ADVISOR_INTERESTS)[number];

export const ADVISOR_INTEREST_LABELS: Record<AdvisorInterest, string> = {
  vintage: 'Vintage',
  modern: 'Modern',
  sealed: 'Sealed',
  'one-piece': 'One Piece',
  budget: 'Budget',
  japans: 'Japans',
  psa: 'PSA',
  singles: 'Singles',
};

export type AdvisorRequest = {
  interests: AdvisorInterest[];
  originId: string | null;
  maxDistanceKm: number | null;
};

export type AdvisorReason = { label: string; weight: number };

export type AdvisorRecommendation = {
  item: EventListItem;
  score: number;
  reasons: AdvisorReason[];
  distanceKm: number | null;
};

export type AdvisorResult = {
  recommendations: AdvisorRecommendation[];
  /** Stated plainly when the input was too thin to advise well. */
  caveats: string[];
};

/** Contract an LLM-backed advisor has to satisfy to replace this one. */
export interface EventAdvisor {
  readonly name: string;
  advise(
    request: AdvisorRequest,
    catalogue: readonly EventDetail[],
  ): Promise<AdvisorResult>;
}

/** Which vendor categories and event tags each interest looks for. */
const INTEREST_SIGNALS: Record<
  AdvisorInterest,
  { categories: string[]; tags: string[]; types: string[] }
> = {
  vintage: { categories: ['cat-vintage'], tags: ['vintage'], types: [] },
  modern: { categories: ['cat-modern'], tags: [], types: [] },
  sealed: { categories: ['cat-sealed'], tags: ['sealed'], types: [] },
  'one-piece': { categories: [], tags: [], types: ['one-piece', 'multi-tcg'] },
  budget: { categories: [], tags: [], types: [] },
  japans: { categories: ['cat-japans'], tags: ['japans'], types: [] },
  psa: { categories: ['cat-graded'], tags: ['psa'], types: [] },
  singles: { categories: ['cat-modern', 'cat-vintage'], tags: ['singles'], types: [] },
};

const VENDOR_MATCH_WEIGHT = 3;
const TAG_MATCH_WEIGHT = 2;
const TYPE_MATCH_WEIGHT = 2;
const RATING_WEIGHT = 1.5;
const PROXIMITY_WEIGHT = 2;

export const MAX_RECOMMENDATIONS = 3;

function scoreEvent(
  detail: EventDetail,
  request: AdvisorRequest,
  distance: number | null,
): { score: number; reasons: AdvisorReason[] } {
  const reasons: AdvisorReason[] = [];
  let score = 0;

  for (const interest of request.interests) {
    const signals = INTEREST_SIGNALS[interest];
    const label = ADVISOR_INTEREST_LABELS[interest];

    const matchingVendors = detail.vendors.filter((vendor) =>
      vendor.categoryIds.some((id) => signals.categories.includes(id)),
    );
    if (matchingVendors.length > 0) {
      // Concentration matters as much as the raw count. Three graded dealers
      // out of three is a graded fair; three out of ten is a general fair that
      // happens to have some. Counting only the total would rank the big
      // general fair above the specialist one for every single interest.
      const share = matchingVendors.length / detail.vendors.length;
      const weight =
        VENDOR_MATCH_WEIGHT *
        Math.min(matchingVendors.length, 3) *
        (0.5 + share);
      score += weight;
      reasons.push({
        label: `${matchingVendors.length} van de ${detail.vendors.length} standhouders gericht op ${label}`,
        weight,
      });
    }

    if (signals.tags.some((tag) => detail.event.tags.includes(tag as never))) {
      score += TAG_MATCH_WEIGHT;
      reasons.push({
        label: `Beurs is gelabeld als ${label}`,
        weight: TAG_MATCH_WEIGHT,
      });
    }

    if (signals.types.includes(detail.event.type)) {
      score += TYPE_MATCH_WEIGHT;
      reasons.push({
        label: `Het type beurs sluit aan op ${label}`,
        weight: TYPE_MATCH_WEIGHT,
      });
    }

    // Budget is about what it costs to get in, not about who is selling.
    if (interest === 'budget') {
      const cheapest = detail.tickets
        .map((ticket) => ticket.priceEur)
        .filter((price): price is number => price !== null);
      const isFree = detail.tickets.some((ticket) => ticket.status === 'free');
      // Free beats cheap by a clear margin, otherwise a €8 ticket and free
      // entry end up separated by a rounding error.
      if (isFree) {
        const weight = VENDOR_MATCH_WEIGHT * 1.5;
        score += weight;
        reasons.push({ label: 'Gratis entree', weight });
      } else if (cheapest.length > 0 && Math.min(...cheapest) <= 9) {
        score += TAG_MATCH_WEIGHT;
        reasons.push({
          label: `Toegang vanaf €${Math.min(...cheapest).toFixed(2).replace('.', ',')}`,
          weight: TAG_MATCH_WEIGHT,
        });
      }
    }
  }

  const reviewSummary = summariseReviews(detail.reviews);
  if (reviewSummary.averageRating !== null && reviewSummary.count >= 3) {
    const weight = ((reviewSummary.averageRating - 3) / 2) * RATING_WEIGHT;
    if (weight > 0) {
      score += weight;
      reasons.push({
        label: `Gemiddeld ${reviewSummary.averageRating.toFixed(1).replace('.', ',')} uit ${reviewSummary.count} beoordelingen`,
        weight,
      });
    }
  }

  if (distance !== null && request.maxDistanceKm !== null) {
    // Closer is better, but only within the limit the visitor set.
    const closeness = 1 - Math.min(distance / request.maxDistanceKm, 1);
    const weight = closeness * PROXIMITY_WEIGHT;
    if (weight > 0.2) {
      score += weight;
      reasons.push({ label: `Op ${distance} km hemelsbreed`, weight });
    }
  }

  reasons.sort((a, b) => b.weight - a.weight);
  return { score, reasons };
}

/**
 * The shipped advisor. Same signature as an LLM-backed one would have, so the
 * pages calling it never learn which is in use.
 */
export class RuleBasedEventAdvisor implements EventAdvisor {
  readonly name = 'rule-based-advisor';

  async advise(
    request: AdvisorRequest,
    catalogue: readonly EventDetail[],
  ): Promise<AdvisorResult> {
    const origin = findOrigin(request.originId);
    const caveats: string[] = [];

    if (request.interests.length === 0) {
      caveats.push(
        'Je hebt nog geen voorkeuren gekozen, dus dit is simpelweg de eerstvolgende agenda.',
      );
    }
    if (request.maxDistanceKm !== null && !origin) {
      caveats.push(
        'Zonder vertrekplaats kan afstand niet meewegen; die filter is genegeerd.',
      );
    }

    const scored = catalogue.map((detail) => {
      const distance = origin
        ? distanceKm(origin, detail.venue.coordinates)
        : null;
      const { score, reasons } = scoreEvent(detail, request, distance);
      const reviewSummary = summariseReviews(detail.reviews);

      const item: EventListItem = {
        event: detail.event,
        venue: detail.venue,
        banner: detail.images.find((image) => image.role === 'banner') ?? null,
        vendorCount: detail.vendors.length,
        reviewCount: reviewSummary.count,
        averageRating: reviewSummary.averageRating,
        ticketStatus: detail.tickets.some((ticket) => ticket.status === 'free')
          ? 'free'
          : (detail.tickets[0]?.status ?? 'at-the-door'),
        fromPriceEur:
          detail.tickets
            .map((ticket) => ticket.priceEur)
            .filter((price): price is number => price !== null)
            .sort((a, b) => a - b)[0] ?? null,
      };

      return { item, score, reasons, distanceKm: distance };
    });

    const withinRange = scored.filter(
      (entry) =>
        request.maxDistanceKm === null ||
        entry.distanceKm === null ||
        entry.distanceKm <= request.maxDistanceKm,
    );

    if (withinRange.length === 0 && scored.length > 0) {
      caveats.push(
        'Binnen de opgegeven afstand staat niets gepland. Hieronder staan de dichtstbijzijnde opties daarbuiten.',
      );
    }

    const pool = withinRange.length > 0 ? withinRange : scored;
    const recommendations = [...pool]
      .sort(
        (a, b) =>
          b.score - a.score || a.item.event.date.localeCompare(b.item.event.date),
      )
      .slice(0, MAX_RECOMMENDATIONS);

    // A zero score means nothing matched; saying so is more useful than
    // presenting the date-sorted top three as if it were advice.
    if (recommendations.every((entry) => entry.score === 0)) {
      caveats.push(
        'Geen enkele beurs sluit duidelijk aan op je voorkeuren. Dit is de eerstvolgende agenda, op datum.',
      );
    }

    return { recommendations, caveats };
  }
}

let advisor: EventAdvisor | null = null;

export function getEventAdvisor(): EventAdvisor {
  advisor ??= new RuleBasedEventAdvisor();
  return advisor;
}

/** The hook an LLM-backed advisor plugs into. */
export function setEventAdvisor(next: EventAdvisor | null): void {
  advisor = next;
}
