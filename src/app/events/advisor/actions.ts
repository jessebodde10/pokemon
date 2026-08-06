'use server';

import { z } from 'zod';
import {
  ADVISOR_INTERESTS,
  getEventAdvisor,
  type AdvisorResult,
} from '@/features/events/advisor';
import { DISTANCE_OPTIONS } from '@/features/events/filtering';
import { getEventsRepository } from '@/features/events/repository';
import type { EventDetail } from '@/features/events/types';

/**
 * Server action behind the advisor form.
 *
 * Running the advice server-side is what keeps the swap to an LLM a one-line
 * change: the API key never has to reach the browser, and the client component
 * already treats the result as opaque.
 */
const requestSchema = z.object({
  interests: z.array(z.enum(ADVISOR_INTERESTS)).max(ADVISOR_INTERESTS.length),
  originId: z.string().max(40).nullable(),
  maxDistanceKm: z
    .number()
    .refine((value) => (DISTANCE_OPTIONS as readonly number[]).includes(value), {
      message: 'Onbekende afstand',
    })
    .nullable(),
});

export async function adviseAction(
  input: z.input<typeof requestSchema>,
): Promise<AdvisorResult> {
  const request = requestSchema.parse(input);
  const repository = getEventsRepository();

  const list = await repository.listEvents();
  const details = await Promise.all(
    list.map((item) => repository.getEventBySlug(item.event.slug)),
  );
  const catalogue = details.filter(
    (detail): detail is EventDetail => detail !== null,
  );

  return getEventAdvisor().advise(request, catalogue);
}
