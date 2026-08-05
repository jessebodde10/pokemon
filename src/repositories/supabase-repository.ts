import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';
import { getServiceRoleClient } from '@/lib/supabase/service-client';
import type {
  AnalysisImage,
  AnalysisSession,
  AnalysisStatus,
  AuditEvent,
  CardMatchCandidate,
  CardRegion,
  CatalogCard,
  CollectionItem,
  ConditionEstimate,
  DetectedCard,
  ImageProcessingStatus,
  MatchReason,
  Profile,
  ReviewStatus,
  StoredPriceEstimate,
  SupportedLanguage,
} from '@/types/domain';
import type {
  PokoraRepository,
  DetectedCardPatch,
  NewAnalysisImage,
  NewAnalysisSession,
  NewAuditEvent,
  NewCollectionItem,
  NewDetectedCard,
  NewMatchCandidate,
  SessionPatch,
} from './pokora-repository';

/**
 * Supabase-backed repository.
 *
 * Uses the service-role key and therefore bypasses RLS: every caller is a
 * server-side service that has already authorised the request. RLS still
 * exists as defence in depth for anything that reaches Postgres with an
 * end-user JWT (for example the Supabase dashboard or a future client SDK).
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
 * Supabase's generated types are not available without a live project, so rows
 * are typed structurally through the mapper functions below instead. Every
 * `any` is confined to a mapper boundary and immediately narrowed. */
type Row = Record<string, any>;

function fail(context: string, error: PostgrestError | null): never {
  logger.error('Supabase query failed', error, { context });
  throw new Error(`Database operation failed: ${context}`);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asRegion(value: unknown): CardRegion {
  const record = (value ?? {}) as Record<string, unknown>;
  const num = (key: string) =>
    typeof record[key] === 'number' ? (record[key] as number) : 0;
  return {
    x: num('x'),
    y: num('y'),
    width: num('width'),
    height: num('height'),
  };
}

function mapSession(row: Row): AnalysisSession {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    guestToken: row.guest_token ?? null,
    ownerHash: row.owner_hash ?? null,
    status: row.status as AnalysisStatus,
    statusDetail: row.status_detail ?? null,
    totalImages: row.total_images ?? 0,
    detectedCardsCount: row.detected_cards_count ?? 0,
    confirmedCardsCount: row.confirmed_cards_count ?? 0,
    unknownCardsCount: row.unknown_cards_count ?? 0,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? null,
    expiresAt: row.expires_at ?? null,
  };
}

function mapImage(row: Row): AnalysisImage {
  return {
    id: row.id,
    analysisSessionId: row.analysis_session_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    width: row.width ?? 0,
    height: row.height ?? 0,
    byteSize: row.byte_size ?? 0,
    processingStatus: row.processing_status as ImageProcessingStatus,
    qualityScore: row.quality_score ?? null,
    qualityWarnings: asStringArray(row.quality_warnings),
    createdAt: row.created_at,
  };
}

function mapDetectedCard(row: Row): DetectedCard {
  return {
    id: row.id,
    analysisSessionId: row.analysis_session_id,
    analysisImageId: row.analysis_image_id,
    position: row.position ?? 0,
    cropStoragePath: row.crop_storage_path ?? null,
    region: asRegion(row.region),
    visibleName: row.visible_name ?? null,
    visibleCardNumber: row.visible_card_number ?? null,
    detectedLanguage: (row.detected_language ??
      null) as SupportedLanguage | null,
    variantHints: asStringArray(row.variant_hints),
    recognitionConfidence: row.recognition_confidence ?? null,
    selectedCatalogCardId: row.selected_catalog_card_id ?? null,
    reviewStatus: row.review_status as ReviewStatus,
    userConfirmed: Boolean(row.user_confirmed),
    conditionEstimate: row.condition_estimate as ConditionEstimate,
    quantity: row.quantity ?? 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCandidate(row: Row): CardMatchCandidate {
  return {
    id: row.id,
    detectedCardId: row.detected_card_id,
    catalogCardId: row.catalog_card_id,
    matchScore: row.match_score ?? 0,
    matchReasons: Array.isArray(row.match_reasons)
      ? (row.match_reasons as MatchReason[])
      : [],
    rank: row.rank ?? 0,
  };
}

function mapCatalogCard(row: Row): CatalogCard {
  return {
    id: row.id,
    externalId: row.external_id,
    name: row.name,
    setId: row.set_id,
    setName: row.set_name,
    setCode: row.set_code ?? '',
    cardNumber: row.card_number ?? '',
    rarity: row.rarity ?? null,
    variant: row.variant ?? null,
    language: (row.language ?? 'en') as SupportedLanguage,
    imageSmallUrl: row.image_small_url ?? null,
    imageLargeUrl: row.image_large_url ?? null,
    releaseDate: row.release_date ?? null,
    pokedexNumber: row.pokedex_number ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

function mapPrice(row: Row): StoredPriceEstimate {
  return {
    id: row.id,
    detectedCardId: row.detected_card_id,
    catalogCardId: row.catalog_card_id ?? null,
    currency: 'EUR',
    low: row.low_value ?? null,
    mid: row.mid_value ?? null,
    high: row.high_value ?? null,
    sampleSize: row.sample_size ?? 0,
    sourceName: row.source_name,
    sourceUrl: row.source_url ?? undefined,
    lastUpdatedAt: row.source_updated_at,
    conditionBasis: row.condition_basis,
    confidence: row.confidence ?? 0,
    warnings: asStringArray(row.warnings),
    createdAt: row.created_at,
  };
}

function mapCollectionItem(row: Row): CollectionItem {
  return {
    id: row.id,
    userId: row.user_id,
    catalogCardId: row.catalog_card_id,
    quantity: row.quantity ?? 1,
    conditionEstimate: row.condition_estimate as ConditionEstimate,
    sourceAnalysisSessionId: row.source_analysis_session_id ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabasePokoraRepository implements PokoraRepository {
  readonly name = 'supabase';

  private get db(): SupabaseClient {
    return getServiceRoleClient();
  }

  // --- sessions ---

  async createSession(input: NewAnalysisSession): Promise<AnalysisSession> {
    const { data, error } = await this.db
      .from('analysis_sessions')
      .insert({
        user_id: input.userId,
        guest_token: input.guestToken,
        owner_hash: input.ownerHash,
        expires_at: input.expiresAt,
        status: 'created',
      })
      .select()
      .single();
    if (error || !data) fail('createSession', error);
    return mapSession(data);
  }

  async getSession(sessionId: string): Promise<AnalysisSession | null> {
    const { data, error } = await this.db
      .from('analysis_sessions')
      .select()
      .eq('id', sessionId)
      .maybeSingle();
    if (error) fail('getSession', error);
    return data ? mapSession(data) : null;
  }

  async updateSession(
    sessionId: string,
    patch: SessionPatch,
  ): Promise<AnalysisSession> {
    const payload: Row = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.statusDetail !== undefined) {
      payload.status_detail = patch.statusDetail;
    }
    if (patch.totalImages !== undefined)
      payload.total_images = patch.totalImages;
    if (patch.detectedCardsCount !== undefined) {
      payload.detected_cards_count = patch.detectedCardsCount;
    }
    if (patch.confirmedCardsCount !== undefined) {
      payload.confirmed_cards_count = patch.confirmedCardsCount;
    }
    if (patch.unknownCardsCount !== undefined) {
      payload.unknown_cards_count = patch.unknownCardsCount;
    }
    if (patch.errorMessage !== undefined) {
      payload.error_message = patch.errorMessage;
    }
    if (patch.completedAt !== undefined)
      payload.completed_at = patch.completedAt;

    const { data, error } = await this.db
      .from('analysis_sessions')
      .update(payload)
      .eq('id', sessionId)
      .select()
      .single();
    if (error || !data) fail('updateSession', error);
    return mapSession(data);
  }

  async listSessionsForUser(userId: string): Promise<AnalysisSession[]> {
    const { data, error } = await this.db
      .from('analysis_sessions')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) fail('listSessionsForUser', error);
    return (data ?? []).map(mapSession);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.db
      .from('analysis_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) fail('deleteSession', error);
  }

  async countSessionsSince(
    owner: { userId: string } | { ownerHash: string },
    since: string,
    scope: 'all' | 'productive' = 'all',
  ): Promise<number> {
    let query = this.db
      .from('analysis_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);
    if (scope === 'productive') {
      query = query.gt('detected_cards_count', 0);
    }
    query =
      'userId' in owner
        ? query.eq('user_id', owner.userId)
        : query.eq('owner_hash', owner.ownerHash);
    const { count, error } = await query;
    if (error) fail('countSessionsSince', error);
    return count ?? 0;
  }

  async listExpiredGuestSessions(now: string): Promise<AnalysisSession[]> {
    const { data, error } = await this.db
      .from('analysis_sessions')
      .select()
      .is('user_id', null)
      .not('expires_at', 'is', null)
      .lt('expires_at', now)
      .limit(500);
    if (error) fail('listExpiredGuestSessions', error);
    return (data ?? []).map(mapSession);
  }

  // --- images ---

  async addImage(input: NewAnalysisImage): Promise<AnalysisImage> {
    const { data, error } = await this.db
      .from('analysis_images')
      .insert({
        analysis_session_id: input.analysisSessionId,
        storage_path: input.storagePath,
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        width: input.width,
        height: input.height,
        byte_size: input.byteSize,
        processing_status: input.processingStatus,
        quality_score: input.qualityScore,
        quality_warnings: input.qualityWarnings,
      })
      .select()
      .single();
    if (error || !data) fail('addImage', error);
    return mapImage(data);
  }

  async listImages(sessionId: string): Promise<AnalysisImage[]> {
    const { data, error } = await this.db
      .from('analysis_images')
      .select()
      .eq('analysis_session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) fail('listImages', error);
    return (data ?? []).map(mapImage);
  }

  async updateImage(
    imageId: string,
    patch: Partial<
      Pick<
        AnalysisImage,
        'processingStatus' | 'qualityScore' | 'qualityWarnings'
      >
    >,
  ): Promise<void> {
    const payload: Row = {};
    if (patch.processingStatus !== undefined) {
      payload.processing_status = patch.processingStatus;
    }
    if (patch.qualityScore !== undefined)
      payload.quality_score = patch.qualityScore;
    if (patch.qualityWarnings !== undefined) {
      payload.quality_warnings = patch.qualityWarnings;
    }
    if (Object.keys(payload).length === 0) return;
    const { error } = await this.db
      .from('analysis_images')
      .update(payload)
      .eq('id', imageId);
    if (error) fail('updateImage', error);
  }

  // --- detected cards ---

  async replaceDetectedCards(
    sessionId: string,
    cards: NewDetectedCard[],
  ): Promise<DetectedCard[]> {
    const { error: deleteError } = await this.db
      .from('detected_cards')
      .delete()
      .eq('analysis_session_id', sessionId);
    if (deleteError) fail('replaceDetectedCards.delete', deleteError);
    if (cards.length === 0) return [];

    const { data, error } = await this.db
      .from('detected_cards')
      .insert(
        cards.map((card) => ({
          analysis_session_id: card.analysisSessionId,
          analysis_image_id: card.analysisImageId,
          position: card.position,
          crop_storage_path: card.cropStoragePath,
          region: card.region,
          visible_name: card.visibleName,
          visible_card_number: card.visibleCardNumber,
          detected_language: card.detectedLanguage,
          variant_hints: card.variantHints,
          recognition_confidence: card.recognitionConfidence,
          selected_catalog_card_id: card.selectedCatalogCardId,
          review_status: card.reviewStatus,
          user_confirmed: card.userConfirmed,
          condition_estimate: card.conditionEstimate,
          quantity: card.quantity,
        })),
      )
      .select();
    if (error || !data) fail('replaceDetectedCards.insert', error);
    return data.map(mapDetectedCard);
  }

  async listDetectedCards(sessionId: string): Promise<DetectedCard[]> {
    const { data, error } = await this.db
      .from('detected_cards')
      .select()
      .eq('analysis_session_id', sessionId)
      .order('position', { ascending: true })
      .order('id', { ascending: true });
    if (error) fail('listDetectedCards', error);
    return (data ?? []).map(mapDetectedCard);
  }

  async getDetectedCard(detectedCardId: string): Promise<DetectedCard | null> {
    const { data, error } = await this.db
      .from('detected_cards')
      .select()
      .eq('id', detectedCardId)
      .maybeSingle();
    if (error) fail('getDetectedCard', error);
    return data ? mapDetectedCard(data) : null;
  }

  async updateDetectedCard(
    detectedCardId: string,
    patch: DetectedCardPatch,
  ): Promise<DetectedCard> {
    const payload: Row = { updated_at: new Date().toISOString() };
    if (patch.selectedCatalogCardId !== undefined) {
      payload.selected_catalog_card_id = patch.selectedCatalogCardId;
    }
    if (patch.reviewStatus !== undefined)
      payload.review_status = patch.reviewStatus;
    if (patch.userConfirmed !== undefined) {
      payload.user_confirmed = patch.userConfirmed;
    }
    if (patch.conditionEstimate !== undefined) {
      payload.condition_estimate = patch.conditionEstimate;
    }
    if (patch.quantity !== undefined) payload.quantity = patch.quantity;
    if (patch.visibleName !== undefined)
      payload.visible_name = patch.visibleName;
    if (patch.visibleCardNumber !== undefined) {
      payload.visible_card_number = patch.visibleCardNumber;
    }

    const { data, error } = await this.db
      .from('detected_cards')
      .update(payload)
      .eq('id', detectedCardId)
      .select()
      .single();
    if (error || !data) fail('updateDetectedCard', error);
    return mapDetectedCard(data);
  }

  async deleteDetectedCard(detectedCardId: string): Promise<void> {
    const { error } = await this.db
      .from('detected_cards')
      .delete()
      .eq('id', detectedCardId);
    if (error) fail('deleteDetectedCard', error);
  }

  // --- match candidates ---

  async replaceMatchCandidates(
    detectedCardId: string,
    candidates: NewMatchCandidate[],
  ): Promise<void> {
    const { error: deleteError } = await this.db
      .from('card_match_candidates')
      .delete()
      .eq('detected_card_id', detectedCardId);
    if (deleteError) fail('replaceMatchCandidates.delete', deleteError);
    if (candidates.length === 0) return;

    const { error } = await this.db.from('card_match_candidates').insert(
      candidates.map((candidate) => ({
        detected_card_id: candidate.detectedCardId,
        catalog_card_id: candidate.catalogCardId,
        match_score: candidate.matchScore,
        match_reasons: candidate.matchReasons,
        rank: candidate.rank,
      })),
    );
    if (error) fail('replaceMatchCandidates.insert', error);
  }

  async listMatchCandidates(sessionId: string): Promise<CardMatchCandidate[]> {
    const { data: cardRows, error: cardError } = await this.db
      .from('detected_cards')
      .select('id')
      .eq('analysis_session_id', sessionId);
    if (cardError) fail('listMatchCandidates.cards', cardError);
    const ids = (cardRows ?? []).map((row: Row) => row.id as string);
    if (ids.length === 0) return [];

    const { data, error } = await this.db
      .from('card_match_candidates')
      .select()
      .in('detected_card_id', ids)
      .order('rank', { ascending: true });
    if (error) fail('listMatchCandidates', error);
    return (data ?? []).map(mapCandidate);
  }

  // --- catalog ---

  async upsertCatalogCards(cards: CatalogCard[]): Promise<void> {
    if (cards.length === 0) return;
    const { error } = await this.db.from('catalog_cards').upsert(
      cards.map((card) => ({
        id: card.id,
        external_id: card.externalId,
        name: card.name,
        set_id: card.setId,
        set_name: card.setName,
        set_code: card.setCode,
        card_number: card.cardNumber,
        rarity: card.rarity,
        variant: card.variant,
        language: card.language,
        image_small_url: card.imageSmallUrl,
        image_large_url: card.imageLargeUrl,
        release_date: card.releaseDate,
        pokedex_number: card.pokedexNumber,
        metadata: card.metadata,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' },
    );
    if (error) fail('upsertCatalogCards', error);
  }

  async getCatalogCard(catalogCardId: string): Promise<CatalogCard | null> {
    const { data, error } = await this.db
      .from('catalog_cards')
      .select()
      .eq('id', catalogCardId)
      .maybeSingle();
    if (error) fail('getCatalogCard', error);
    return data ? mapCatalogCard(data) : null;
  }

  async getCatalogCards(catalogCardIds: string[]): Promise<CatalogCard[]> {
    if (catalogCardIds.length === 0) return [];
    const { data, error } = await this.db
      .from('catalog_cards')
      .select()
      .in('id', catalogCardIds);
    if (error) fail('getCatalogCards', error);
    return (data ?? []).map(mapCatalogCard);
  }

  // --- prices ---

  async savePriceEstimate(
    estimate: Omit<StoredPriceEstimate, 'id' | 'createdAt'>,
  ): Promise<StoredPriceEstimate> {
    await this.db
      .from('price_estimates')
      .delete()
      .eq('detected_card_id', estimate.detectedCardId);

    const { data, error } = await this.db
      .from('price_estimates')
      .insert({
        detected_card_id: estimate.detectedCardId,
        catalog_card_id: estimate.catalogCardId,
        currency: estimate.currency,
        low_value: estimate.low,
        mid_value: estimate.mid,
        high_value: estimate.high,
        sample_size: estimate.sampleSize,
        source_name: estimate.sourceName,
        source_url: estimate.sourceUrl ?? null,
        source_updated_at: estimate.lastUpdatedAt,
        condition_basis: estimate.conditionBasis,
        confidence: estimate.confidence,
        warnings: estimate.warnings,
        raw_metadata: {},
      })
      .select()
      .single();
    if (error || !data) fail('savePriceEstimate', error);
    return mapPrice(data);
  }

  async listPriceEstimates(sessionId: string): Promise<StoredPriceEstimate[]> {
    const { data: cardRows, error: cardError } = await this.db
      .from('detected_cards')
      .select('id')
      .eq('analysis_session_id', sessionId);
    if (cardError) fail('listPriceEstimates.cards', cardError);
    const ids = (cardRows ?? []).map((row: Row) => row.id as string);
    if (ids.length === 0) return [];

    const { data, error } = await this.db
      .from('price_estimates')
      .select()
      .in('detected_card_id', ids);
    if (error) fail('listPriceEstimates', error);
    return (data ?? []).map(mapPrice);
  }

  // --- collection ---

  async listCollection(userId: string): Promise<CollectionItem[]> {
    const { data, error } = await this.db
      .from('collection_items')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) fail('listCollection', error);
    return (data ?? []).map(mapCollectionItem);
  }

  async addCollectionItem(input: NewCollectionItem): Promise<CollectionItem> {
    const { data: existing } = await this.db
      .from('collection_items')
      .select()
      .eq('user_id', input.userId)
      .eq('catalog_card_id', input.catalogCardId)
      .eq('condition_estimate', input.conditionEstimate)
      .maybeSingle();

    if (existing) {
      const { data, error } = await this.db
        .from('collection_items')
        .update({
          quantity: (existing.quantity ?? 0) + input.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error || !data) fail('addCollectionItem.merge', error);
      return mapCollectionItem(data);
    }

    const { data, error } = await this.db
      .from('collection_items')
      .insert({
        user_id: input.userId,
        catalog_card_id: input.catalogCardId,
        quantity: input.quantity,
        condition_estimate: input.conditionEstimate,
        source_analysis_session_id: input.sourceAnalysisSessionId,
        notes: input.notes,
      })
      .select()
      .single();
    if (error || !data) fail('addCollectionItem', error);
    return mapCollectionItem(data);
  }

  async updateCollectionItem(
    itemId: string,
    userId: string,
    patch: Partial<
      Pick<CollectionItem, 'quantity' | 'notes' | 'conditionEstimate'>
    >,
  ): Promise<CollectionItem> {
    const payload: Row = { updated_at: new Date().toISOString() };
    if (patch.quantity !== undefined) payload.quantity = patch.quantity;
    if (patch.notes !== undefined) payload.notes = patch.notes;
    if (patch.conditionEstimate !== undefined) {
      payload.condition_estimate = patch.conditionEstimate;
    }
    const { data, error } = await this.db
      .from('collection_items')
      .update(payload)
      .eq('id', itemId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) fail('updateCollectionItem', error);
    return mapCollectionItem(data);
  }

  async deleteCollectionItem(itemId: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from('collection_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);
    if (error) fail('deleteCollectionItem', error);
  }

  // --- profiles ---

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.db
      .from('profiles')
      .select()
      .eq('id', userId)
      .maybeSingle();
    if (error) fail('getProfile', error);
    return data
      ? {
          id: data.id,
          displayName: data.display_name ?? null,
          locale: data.locale ?? 'nl',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      : null;
  }

  async upsertProfile(
    profile: Omit<Profile, 'createdAt' | 'updatedAt'>,
  ): Promise<Profile> {
    const { data, error } = await this.db
      .from('profiles')
      .upsert(
        {
          id: profile.id,
          display_name: profile.displayName,
          locale: profile.locale,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select()
      .single();
    if (error || !data) fail('upsertProfile', error);
    return {
      id: data.id,
      displayName: data.display_name ?? null,
      locale: data.locale ?? 'nl',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // --- audit ---

  async recordEvent(event: NewAuditEvent): Promise<AuditEvent> {
    const { data, error } = await this.db
      .from('audit_events')
      .insert({
        user_id: event.userId,
        analysis_session_id: event.analysisSessionId,
        event_type: event.eventType,
        metadata: event.metadata,
      })
      .select()
      .single();
    if (error || !data) fail('recordEvent', error);
    return {
      id: data.id,
      userId: data.user_id ?? null,
      analysisSessionId: data.analysis_session_id ?? null,
      eventType: data.event_type,
      metadata: (data.metadata ?? {}) as Record<string, unknown>,
      createdAt: data.created_at,
    };
  }
}
