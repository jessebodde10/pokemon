import type {
  CatalogCard,
  MatchReason,
  SupportedLanguage,
} from '@/types/domain';

/**
 * Weighted matching between an (untrusted) recognition result and catalog
 * records. Pure and deterministic so it can be unit tested exhaustively.
 */

export type MatchInput = {
  visibleName: string | null;
  visibleCardNumber: string | null;
  possibleSetCode: string | null;
  possibleSetName?: string | null;
  language: SupportedLanguage | null;
  variantHints: string[];
};

export const MATCH_WEIGHTS = {
  card_number: 0.34,
  name: 0.3,
  set: 0.16,
  variant: 0.1,
  language: 0.06,
  release_date: 0.04,
} as const satisfies Record<MatchReason['factor'], number>;

export function normaliseText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "199/165" -> { number: "199", total: "165" }; "TG12/TG30" is kept intact. */
export function parseCardNumber(
  raw: string | null | undefined,
): { number: string; total: string | null } | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return null;
  const [left, right] = cleaned.split('/');
  if (!left) return null;
  const number = left.replace(/^0+(?=\d)/, '');
  const total = right ? right.replace(/^0+(?=\d)/, '') : null;
  return { number, total };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** 1 for identical strings, 0 for completely different. */
export function similarity(a: string, b: string): number {
  const left = normaliseText(a);
  const right = normaliseText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const longest = Math.max(left.length, right.length);
  const editScore = 1 - levenshtein(left, right) / longest;

  // Token overlap rescues cases like "charizard" vs "charizard ex".
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  let shared = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1;
  const overlapScore = shared / Math.max(leftTokens.size, rightTokens.size, 1);

  return Math.max(0, Math.min(1, Math.max(editScore, overlapScore * 0.95)));
}

function scoreCardNumber(
  input: MatchInput,
  card: CatalogCard,
): { score: number; detail: string } | null {
  const detected = parseCardNumber(input.visibleCardNumber);
  if (!detected) return null;
  const actual = parseCardNumber(card.cardNumber);
  if (!actual) return { score: 0, detail: 'Catalogusnummer ontbreekt' };

  if (detected.number !== actual.number) {
    return { score: 0, detail: `Nummer ${detected.number} wijkt af` };
  }
  if (detected.total && actual.total && detected.total !== actual.total) {
    return {
      score: 0.6,
      detail: `Kaartnummer komt overeen, settotaal wijkt af (${detected.total} vs ${actual.total})`,
    };
  }
  return {
    score: 1,
    detail: `Kaartnummer ${card.cardNumber} komt exact overeen`,
  };
}

function scoreName(
  input: MatchInput,
  card: CatalogCard,
): { score: number; detail: string } | null {
  if (!input.visibleName) return null;
  const score = similarity(input.visibleName, card.name);
  return {
    score,
    detail:
      score >= 0.99
        ? `Naam "${card.name}" komt exact overeen`
        : `Naamgelijkenis met "${card.name}": ${Math.round(score * 100)}%`,
  };
}

function scoreSet(
  input: MatchInput,
  card: CatalogCard,
): { score: number; detail: string } | null {
  const code = input.possibleSetCode?.trim();
  const name = input.possibleSetName?.trim();
  if (!code && !name) return null;

  if (code && normaliseText(code) === normaliseText(card.setCode)) {
    return { score: 1, detail: `Setcode ${card.setCode} komt overeen` };
  }
  if (name) {
    const score = similarity(name, card.setName);
    return {
      score,
      detail: `Setgelijkenis met "${card.setName}": ${Math.round(score * 100)}%`,
    };
  }
  return { score: 0, detail: `Setcode wijkt af van ${card.setCode}` };
}

function scoreVariant(
  input: MatchInput,
  card: CatalogCard,
): { score: number; detail: string } | null {
  if (input.variantHints.length === 0) return null;
  const target = normaliseText(
    [card.variant, card.rarity].filter(Boolean).join(' '),
  );
  if (!target) return { score: 0.5, detail: 'Variant onbekend in catalogus' };

  let best = 0;
  let bestHint = '';
  for (const hint of input.variantHints) {
    const normalisedHint = normaliseText(hint);
    if (!normalisedHint) continue;
    const contained = target.includes(normalisedHint) ? 1 : 0;
    const score = Math.max(contained, similarity(normalisedHint, target));
    if (score > best) {
      best = score;
      bestHint = hint;
    }
  }
  return {
    score: best,
    detail:
      best >= 0.9
        ? `Variant "${bestHint}" komt overeen`
        : `Variant nog niet bevestigd (${card.variant ?? 'onbekend'})`,
  };
}

function scoreLanguage(
  input: MatchInput,
  card: CatalogCard,
): { score: number; detail: string } | null {
  if (!input.language || input.language === 'unknown') return null;
  const match = input.language === card.language;
  return {
    score: match ? 1 : 0,
    detail: match
      ? `Taal ${card.language} komt overeen`
      : `Taal wijkt af (${input.language} vs ${card.language})`,
  };
}

function scoreReleaseDate(
  _input: MatchInput,
  card: CatalogCard,
): { score: number; detail: string } | null {
  if (!card.releaseDate) return null;
  const released = Date.parse(card.releaseDate);
  if (Number.isNaN(released)) return null;
  // Only used as a light tie-breaker: a card cannot be newer than today.
  const isPlausible = released <= Date.now();
  return {
    score: isPlausible ? 1 : 0,
    detail: isPlausible
      ? `Uitgiftedatum ${card.releaseDate}`
      : 'Uitgiftedatum ligt in de toekomst',
  };
}

const SCORERS: Array<{
  factor: MatchReason['factor'];
  run: (
    input: MatchInput,
    card: CatalogCard,
  ) => { score: number; detail: string } | null;
}> = [
  { factor: 'card_number', run: scoreCardNumber },
  { factor: 'name', run: scoreName },
  { factor: 'set', run: scoreSet },
  { factor: 'variant', run: scoreVariant },
  { factor: 'language', run: scoreLanguage },
  { factor: 'release_date', run: scoreReleaseDate },
];

/**
 * Highest score a candidate can reach once the detected card number
 * contradicts it. Deliberately below AUTO_SELECT_THRESHOLD.
 */
export const CONTRADICTED_NUMBER_CEILING = 0.5;

export type ScoredMatch = {
  card: CatalogCard;
  score: number;
  reasons: MatchReason[];
};

/**
 * Score one candidate. Factors without input data are skipped entirely and
 * their weight is redistributed, so a sparse recognition result is not
 * punished for information it never claimed to have.
 */
export function scoreCandidate(
  input: MatchInput,
  card: CatalogCard,
): ScoredMatch {
  const reasons: MatchReason[] = [];
  let weighted = 0;
  let totalWeight = 0;

  for (const { factor, run } of SCORERS) {
    const result = run(input, card);
    if (!result) continue;
    const weight = MATCH_WEIGHTS[factor];
    weighted += result.score * weight;
    totalWeight += weight;
    reasons.push({
      factor,
      weight,
      score: result.score,
      detail: result.detail,
    });
  }

  let score = totalWeight === 0 ? 0 : weighted / totalWeight;

  // Veto: a card number that was read but contradicts the candidate is a hard
  // signal. Without this cap, a candidate that matches on name, set, variant
  // and language still clears the auto-select threshold while being provably
  // the wrong print - the exact mistake that silently corrupts a collection.
  const numberReason = reasons.find(
    (reason) => reason.factor === 'card_number',
  );
  if (numberReason && numberReason.score === 0) {
    score = Math.min(score, CONTRADICTED_NUMBER_CEILING);
  }

  return { card, score: Math.round(score * 1000) / 1000, reasons };
}

export const MAX_MATCH_CANDIDATES = 5;

/** Rank candidates, best first. Ties are broken by newest release date. */
export function rankCandidates(
  input: MatchInput,
  cards: CatalogCard[],
  limit = MAX_MATCH_CANDIDATES,
): ScoredMatch[] {
  return cards
    .map((card) => scoreCandidate(input, card))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDate = a.card.releaseDate ?? '';
      const bDate = b.card.releaseDate ?? '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return a.card.id.localeCompare(b.card.id);
    })
    .slice(0, limit);
}

/**
 * Minimum score before the pipeline auto-selects a match. Below this the card
 * is still shown, but without a preselected catalog card.
 */
export const AUTO_SELECT_THRESHOLD = 0.62;
