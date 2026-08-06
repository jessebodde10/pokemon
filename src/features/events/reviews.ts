import type { EventReview, ReviewTag } from './types';

/**
 * Review aggregation.
 *
 * A star average on its own says little about whether a fair suits you, so the
 * tags are counted alongside it. The counts are what the summary and the
 * advisor reason over - the average is only ever a secondary signal.
 */

export type ReviewSummary = {
  count: number;
  /** Null rather than 0 when nobody has reviewed yet. */
  averageRating: number | null;
  /** Tags ordered by how often they were picked, most first. */
  tagCounts: Array<{ tag: ReviewTag; count: number; share: number }>;
};

export function summariseReviews(
  reviews: readonly EventReview[],
): ReviewSummary {
  if (reviews.length === 0) {
    return { count: 0, averageRating: null, tagCounts: [] };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  const counts = new Map<ReviewTag, number>();
  for (const review of reviews) {
    for (const tag of review.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const tagCounts = [...counts.entries()]
    .map(([tag, count]) => ({
      tag,
      count,
      share: count / reviews.length,
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return {
    count: reviews.length,
    averageRating: Math.round((total / reviews.length) * 10) / 10,
    tagCounts,
  };
}

/**
 * Whether a tag is common enough to state as a characteristic of the event.
 *
 * One person calling a fair busy is an anecdote. A third of them saying it is
 * a property of the event.
 */
export const TAG_CONSENSUS_SHARE = 1 / 3;

export function consensusTags(summary: ReviewSummary): ReviewTag[] {
  // Below three reviews there is no consensus to speak of, only opinions.
  if (summary.count < 3) return [];
  return summary.tagCounts
    .filter((entry) => entry.share >= TAG_CONSENSUS_SHARE)
    .map((entry) => entry.tag);
}
