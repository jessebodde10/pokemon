import { consensusTags, summariseReviews } from './reviews';
import type { EventDetail, Vendor } from './types';

/**
 * The "AI samenvatting" shown on an event page.
 *
 * Deliberately rule-based, and labelled in the UI as automatically generated
 * from vendor and review data rather than as a model's opinion. Every sentence
 * traces back to something countable: which specialisations the vendors list,
 * and which tags enough reviewers agreed on. That keeps the widget honest
 * while the interface behind it stays ready for a real model.
 *
 * `generateEventSummary` is the seam. Swapping it for an LLM call means
 * implementing the same signature and keeping the `basedOn` provenance.
 */

export type EventSummary = {
  paragraphs: string[];
  /** What the text was derived from, shown under the widget. */
  basedOn: string[];
};

function countVendorsWithCategory(
  vendors: readonly Vendor[],
  categoryId: string,
): number {
  return vendors.filter((vendor) => vendor.categoryIds.includes(categoryId))
    .length;
}

/** Dutch needs the singular for exactly one, in both the noun and the verb. */
function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

/** Dutch enumeration: commas, then "en" before the last item. */
export function joinDutch(values: readonly string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0] ?? '';
  const head = values.slice(0, -1).join(', ');
  return `${head} en ${values[values.length - 1]}`;
}

export function generateEventSummary(detail: EventDetail): EventSummary {
  const { vendors, reviews, event } = detail;
  const paragraphs: string[] = [];
  const basedOn: string[] = [];

  const vintage = countVendorsWithCategory(vendors, 'cat-vintage');
  const graded = countVendorsWithCategory(vendors, 'cat-graded');
  const sealed = countVendorsWithCategory(vendors, 'cat-sealed');
  const japans = countVendorsWithCategory(vendors, 'cat-japans');
  const retro = countVendorsWithCategory(vendors, 'cat-retro');

  // Opening sentence: who is this fair actually for, judged on how the
  // vendors describe themselves.
  const strengths: string[] = [];
  if (vintage >= 2) strengths.push('vintage Pokémonkaarten');
  if (japans >= 1) strengths.push('Japanse prints');
  if (sealed >= 2) strengths.push('sealed product');
  if (graded >= 2) strengths.push('geslabde kaarten');
  if (retro >= 1) strengths.push('retro speelgoed');

  if (strengths.length > 0) {
    paragraphs.push(
      `Deze beurs is vooral interessant voor verzamelaars van ${joinDutch(strengths)}. Dat volgt uit de specialisaties die de ${plural(vendors.length, 'aangemelde standhouder', 'aangemelde standhouders')} zelf opgeven.`,
    );
  } else {
    paragraphs.push(
      `Er ${vendors.length === 1 ? 'is' : 'zijn'} ${plural(vendors.length, 'standhouder', 'standhouders')} aangemeld. Hun specialisaties lopen uiteen, dus dit is eerder een brede beurs dan een gerichte.`,
    );
  }
  basedOn.push(
    plural(vendors.length, 'standhoudersprofiel', 'standhoudersprofielen'),
  );

  if (graded >= 1) {
    paragraphs.push(
      graded === 1
        ? 'Er is één standhouder die in graded kaarten handelt, dus PSA is vertegenwoordigd maar niet breed.'
        : `Graded is goed vertegenwoordigd: ${graded} van de ${vendors.length} standhouders handelen in geslabde kaarten.`,
    );
  }

  // Second paragraph: what visitors consistently reported.
  const summary = summariseReviews(reviews);
  const agreed = consensusTags(summary);
  if (agreed.length > 0) {
    const phrases: string[] = [];
    if (agreed.includes('druk')) phrases.push('het kan er druk zijn');
    if (agreed.includes('goede-sfeer')) phrases.push('de sfeer wordt geprezen');
    if (agreed.includes('goede-prijzen') || agreed.includes('goede-deals')) {
      phrases.push('bezoekers noemen de prijzen gunstig');
    }
    if (agreed.includes('veel-vintage')) {
      phrases.push('het vintage-aanbod valt bezoekers op');
    }
    if (agreed.includes('veel-slabs'))
      phrases.push('er zijn veel slabs te zien');
    if (agreed.includes('veel-kinderen')) {
      phrases.push('er komen relatief veel kinderen');
    }
    if (phrases.length > 0) {
      paragraphs.push(
        `Op basis van ${plural(summary.count, 'beoordeling', 'beoordelingen')}: ${joinDutch(phrases)}.`,
      );
      basedOn.push(plural(summary.count, 'beoordeling', 'beoordelingen'));
    }
  } else if (summary.count > 0) {
    paragraphs.push(
      summary.count === 1
        ? 'Er is één beoordeling, te weinig om er een patroon uit af te leiden.'
        : `Er zijn ${summary.count} beoordelingen, maar te weinig overeenstemming om er een patroon uit af te leiden.`,
    );
    basedOn.push(plural(summary.count, 'beoordeling', 'beoordelingen'));
  } else {
    paragraphs.push(
      'Deze beurs heeft nog geen beoordelingen, dus over de sfeer en drukte valt nog niets te zeggen.',
    );
  }

  if (event.expectedVisitors !== null) {
    basedOn.push('bezoekersverwachting van de organisator');
  }

  return { paragraphs, basedOn };
}
