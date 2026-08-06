'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Input, Label, Panel } from '@/components/ui/primitives';
import { addLocalReview, listLocalReviews } from '@/features/events/client-store';
import { summariseReviews } from '@/features/events/reviews';
import {
  REVIEW_TAGS,
  REVIEW_TAG_LABELS,
  type EventReview,
  type ReviewTag,
} from '@/features/events/types';

/**
 * Reviews.
 *
 * The tags carry more decision value than the stars: knowing a fair is busy
 * and vintage-heavy tells you whether to go, where 4.2 out of 5 does not. So
 * the tag distribution is shown above the individual reviews, with counts
 * rather than bare labels.
 */
export function ReviewSection({
  eventId,
  initialReviews,
}: {
  eventId: string;
  initialReviews: EventReview[];
}) {
  const reduceMotion = useReducedMotion();
  const [reviews, setReviews] = React.useState(initialReviews);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const local = listLocalReviews(eventId).map(
      (review): EventReview => ({
        ...review,
        tags: review.tags.filter((tag): tag is ReviewTag =>
          (REVIEW_TAGS as readonly string[]).includes(tag),
        ),
      }),
    );
    if (local.length > 0) {
      setReviews((current) => [...local, ...current]);
    }
  }, [eventId]);

  const summary = summariseReviews(reviews);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          {summary.averageRating === null ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nog geen beoordelingen.
            </p>
          ) : (
            <>
              <span className="text-3xl font-bold tabular-nums">
                {summary.averageRating.toFixed(1).replace('.', ',')}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                uit {summary.count}{' '}
                {summary.count === 1 ? 'beoordeling' : 'beoordelingen'}
              </span>
            </>
          )}
        </div>
        <Button
          type="button"
          variant={open ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Annuleren' : 'Beoordeling schrijven'}
        </Button>
      </div>

      {summary.tagCounts.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">
            Wat bezoekers noemden
          </h3>
          <ul className="flex flex-wrap gap-2">
            {summary.tagCounts.map((entry) => (
              <li key={entry.tag}>
                <Badge tone={entry.share >= 1 / 3 ? 'accent' : 'neutral'}>
                  {REVIEW_TAG_LABELS[entry.tag]}
                  <span className="tabular-nums opacity-70">
                    {entry.count}×
                  </span>
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open ? (
        <ReviewForm
          eventId={eventId}
          onSubmitted={(review) => {
            setReviews((current) => [review, ...current]);
            setOpen(false);
            toast.success('Bedankt, je beoordeling staat erbij.');
          }}
        />
      ) : null}

      {reviews.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--text-muted)]">
            Deze beurs is nog niet beoordeeld. Ben je er geweest? Dan help je
            anderen door te vertellen wat je aantrof.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review, index) => (
            <motion.li
              key={review.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index, 5) * 0.03 }}
            >
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{review.authorName}</p>
                  <span
                    className="flex items-center gap-0.5"
                    aria-label={`${review.rating} van 5 sterren`}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        aria-hidden="true"
                        className={
                          star <= review.rating
                            ? 'size-3.5 fill-[var(--color-gold)] text-[var(--color-gold)]'
                            : 'size-3.5 text-[var(--color-ink-700)]'
                        }
                      />
                    ))}
                  </span>
                </div>
                {review.body ? (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    {review.body}
                  </p>
                ) : null}
                {review.tags.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {review.tags.map((tag) => (
                      <li key={tag}>
                        <Badge>{REVIEW_TAG_LABELS[tag]}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            </motion.li>
          ))}
        </ul>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Beoordelingen die je hier plaatst worden in deze demo alleen in je eigen
        browser bewaard.
      </p>
    </div>
  );
}

function ReviewForm({
  eventId,
  onSubmitted,
}: {
  eventId: string;
  onSubmitted: (review: EventReview) => void;
}) {
  const [rating, setRating] = React.useState(0);
  const [name, setName] = React.useState('');
  const [body, setBody] = React.useState('');
  const [tags, setTags] = React.useState<ReviewTag[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError('Geef eerst een aantal sterren.');
      return;
    }
    if (name.trim().length === 0) {
      setError('Vul een naam in, ook een voornaam is genoeg.');
      return;
    }

    const review: EventReview = {
      id: `local-${Date.now()}`,
      eventId,
      authorName: name.trim().slice(0, 40),
      rating,
      body: body.trim().slice(0, 600),
      tags,
      createdAt: new Date().toISOString(),
    };
    addLocalReview({ ...review, tags: review.tags });
    onSubmitted(review);
  }

  return (
    <Panel raised>
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-[var(--text-muted)]">
            Hoeveel sterren?
          </legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  setRating(star);
                  setError(null);
                }}
                aria-label={`${star} ${star === 1 ? 'ster' : 'sterren'}`}
                aria-pressed={rating === star}
                className="rounded-md p-1 transition-transform hover:scale-110"
              >
                <Star
                  aria-hidden="true"
                  className={
                    star <= rating
                      ? 'size-6 fill-[var(--color-gold)] text-[var(--color-gold)]'
                      : 'size-6 text-[var(--color-ink-600)]'
                  }
                />
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="review-name">Je naam</Label>
          <Input
            id="review-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            maxLength={40}
            placeholder="Voornaam"
          />
        </div>

        <div>
          <Label htmlFor="review-body">Wat trof je aan?</Label>
          <textarea
            id="review-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={600}
            rows={3}
            placeholder="Bijvoorbeeld: veel vintage, maar rond het middaguur erg druk."
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--color-ink-950)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--color-ink-500)]"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-[var(--text-muted)]">
            Wat viel op? Kies wat klopt.
          </legend>
          <div className="flex flex-wrap gap-2">
            {REVIEW_TAGS.map((tag) => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setTags((current) =>
                      current.includes(tag)
                        ? current.filter((entry) => entry !== tag)
                        : [...current, tag],
                    )
                  }
                  className={
                    active
                      ? 'rounded-full border border-[var(--color-holo-cyan)] bg-[color-mix(in_oklab,var(--color-holo-cyan)_18%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--color-holo-cyan)]'
                      : 'rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:border-white/30'
                  }
                >
                  {REVIEW_TAG_LABELS[tag]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-critical)]">
            {error}
          </p>
        ) : null}

        <Button type="submit">Beoordeling plaatsen</Button>
      </form>
    </Panel>
  );
}
