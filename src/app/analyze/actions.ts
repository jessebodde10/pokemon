'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { serverConfig } from '@/config/env';
import {
  getClientIp,
  getOrCreateRequester,
  getRequester,
} from '@/features/auth/requester';
import { getOrCreateGuestToken } from '@/features/auth/session';
import {
  actionFail,
  actionOk,
  type ActionResult,
} from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import {
  changeCardMatch,
  confirmCardMatch,
  confirmCardMatches,
  createAnalysisSession,
  deleteAnalysis,
  finaliseAnalysis,
  markCardUnknown,
  reanalyseCard,
  refreshSessionPrices,
  registerUploadedImage,
  removeDetectedCard,
  retryAnalysis,
  searchCatalog,
  setCardQuantity,
  startAnalysis,
} from '@/services/analysis-service';
import { addConfirmedCardsToCollection } from '@/services/collection-service';
import { requireUser } from '@/features/auth/session';
import type { CatalogCard } from '@/types/domain';

/**
 * Server actions for the analysis flow.
 *
 * Each action validates its own input, resolves the requester server-side and
 * returns a discriminated result instead of throwing, so the client can render
 * a safe message without ever seeing an internal error.
 */

const uuid = z.string().min(1).max(128);

export async function createAnalysisSessionAction(): Promise<
  ActionResult<{ sessionId: string; maxImages: number }>
> {
  try {
    const requester = await getOrCreateRequester();
    const guestToken = requester.userId
      ? 'authenticated'
      : await getOrCreateGuestToken();

    const session = await createAnalysisSession({
      userId: requester.userId,
      guestToken,
      ipAddress: await getClientIp(),
    });

    return actionOk({
      sessionId: session.id,
      maxImages: requester.userId
        ? serverConfig.limits.userMaxImages
        : serverConfig.limits.guestMaxImages,
    });
  } catch (error) {
    logger.error('createAnalysisSessionAction failed', error);
    return actionFail(error);
  }
}

export async function uploadImageAction(
  formData: FormData,
): Promise<ActionResult<{ imageId: string; filename: string }>> {
  try {
    const sessionId = uuid.parse(formData.get('sessionId'));
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new Error('No file supplied');
    }

    const image = await registerUploadedImage({
      sessionId,
      requester: await getRequester(),
      file: {
        filename: file.name,
        declaredMimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      },
    });

    return actionOk({ imageId: image.id, filename: image.originalFilename });
  } catch (error) {
    logger.error('uploadImageAction failed', error);
    return actionFail(error);
  }
}

export async function startAnalysisAction(
  sessionId: string,
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const session = await startAnalysis({
      sessionId: uuid.parse(sessionId),
      requester: await getRequester(),
    });
    return actionOk({ sessionId: session.id });
  } catch (error) {
    logger.error('startAnalysisAction failed', error);
    return actionFail(error);
  }
}

export async function retryAnalysisAction(
  sessionId: string,
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const session = await retryAnalysis({
      sessionId: uuid.parse(sessionId),
      requester: await getRequester(),
    });
    return actionOk({ sessionId: session.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function confirmCardAction(input: {
  detectedCardId: string;
  quantity?: number;
}): Promise<ActionResult<{ detectedCardId: string }>> {
  try {
    const card = await confirmCardMatch({
      detectedCardId: uuid.parse(input.detectedCardId),
      requester: await getRequester(),
      quantity: input.quantity,
    });
    revalidatePath(`/analyze/${card.analysisSessionId}/review`);
    return actionOk({ detectedCardId: card.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function confirmCardsAction(
  detectedCardIds: string[],
): Promise<ActionResult<{ confirmed: number; skipped: number }>> {
  try {
    const ids = z.array(uuid).min(1).max(200).parse(detectedCardIds);
    const result = await confirmCardMatches({
      detectedCardIds: ids,
      requester: await getRequester(),
    });
    if (result.sessionId) {
      revalidatePath(`/analyze/${result.sessionId}/review`);
    }
    return actionOk({
      confirmed: result.confirmed,
      skipped: result.skipped,
    });
  } catch (error) {
    logger.error('confirmCardsAction failed', error);
    return actionFail(error);
  }
}

export async function changeCardMatchAction(input: {
  detectedCardId: string;
  catalogCardId: string;
  quantity?: number;
}): Promise<ActionResult<{ detectedCardId: string }>> {
  try {
    const card = await changeCardMatch({
      detectedCardId: uuid.parse(input.detectedCardId),
      catalogCardId: uuid.parse(input.catalogCardId),
      requester: await getRequester(),
      quantity: input.quantity,
    });
    revalidatePath(`/analyze/${card.analysisSessionId}/review`);
    return actionOk({ detectedCardId: card.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function markCardUnknownAction(
  detectedCardId: string,
): Promise<ActionResult<{ detectedCardId: string }>> {
  try {
    const card = await markCardUnknown({
      detectedCardId: uuid.parse(detectedCardId),
      requester: await getRequester(),
    });
    revalidatePath(`/analyze/${card.analysisSessionId}/review`);
    return actionOk({ detectedCardId: card.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function removeCardAction(
  detectedCardId: string,
): Promise<ActionResult<{ removed: true }>> {
  try {
    await removeDetectedCard({
      detectedCardId: uuid.parse(detectedCardId),
      requester: await getRequester(),
    });
    return actionOk({ removed: true });
  } catch (error) {
    return actionFail(error);
  }
}

export async function setCardQuantityAction(input: {
  detectedCardId: string;
  quantity: number;
}): Promise<ActionResult<{ quantity: number }>> {
  try {
    const card = await setCardQuantity({
      detectedCardId: uuid.parse(input.detectedCardId),
      quantity: z.coerce.number().int().min(1).max(99).parse(input.quantity),
      requester: await getRequester(),
    });
    return actionOk({ quantity: card.quantity });
  } catch (error) {
    return actionFail(error);
  }
}

export async function reanalyseCardAction(
  detectedCardId: string,
): Promise<ActionResult<{ detectedCardId: string }>> {
  try {
    const card = await reanalyseCard({
      detectedCardId: uuid.parse(detectedCardId),
      requester: await getRequester(),
    });
    revalidatePath(`/analyze/${card.analysisSessionId}/review`);
    return actionOk({ detectedCardId: card.id });
  } catch (error) {
    return actionFail(error);
  }
}

const searchSchema = z.object({
  name: z.string().trim().max(80).optional(),
  setName: z.string().trim().max(80).optional(),
  cardNumber: z.string().trim().max(24).optional(),
  pokedexNumber: z.coerce.number().int().positive().max(2000).optional(),
});

export async function searchCatalogAction(
  input: z.input<typeof searchSchema>,
): Promise<ActionResult<CatalogCard[]>> {
  try {
    const parsed = searchSchema.parse(input);
    return actionOk(await searchCatalog(parsed));
  } catch (error) {
    return actionFail(error);
  }
}

export async function finaliseAnalysisAction(
  sessionId: string,
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const session = await finaliseAnalysis({
      sessionId: uuid.parse(sessionId),
      requester: await getRequester(),
    });
    revalidatePath(`/analyze/${session.id}/report`);
    return actionOk({ sessionId: session.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function refreshPricesAction(
  sessionId: string,
): Promise<ActionResult<{ refreshed: number }>> {
  try {
    const refreshed = await refreshSessionPrices({
      sessionId: uuid.parse(sessionId),
      requester: await getRequester(),
    });
    revalidatePath(`/analyze/${sessionId}/report`);
    return actionOk({ refreshed });
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteAnalysisAction(
  sessionId: string,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    await deleteAnalysis({
      sessionId: uuid.parse(sessionId),
      requester: await getRequester(),
    });
    revalidatePath('/dashboard/analyses');
    return actionOk({ deleted: true });
  } catch (error) {
    return actionFail(error);
  }
}

export async function saveToCollectionAction(
  sessionId: string,
): Promise<ActionResult<{ added: number }>> {
  try {
    const user = await requireUser();
    const added = await addConfirmedCardsToCollection({
      sessionId: uuid.parse(sessionId),
      userId: user.id,
    });
    revalidatePath('/dashboard/collection');
    return actionOk({ added });
  } catch (error) {
    return actionFail(error);
  }
}
