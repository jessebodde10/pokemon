import { serverConfig } from '@/config/env';
import { logger } from '@/lib/logging/logger';

/**
 * Privacy-friendly analytics.
 *
 * Events carry counts and identifiers we already control - never e-mail
 * addresses, IPs, filenames or photo content. Swapping in a hosted provider
 * means implementing this one interface.
 */

export const ANALYTICS_EVENTS = [
  'analysis_started',
  'image_uploaded',
  'analysis_completed',
  'analysis_failed',
  'card_match_confirmed',
  'card_match_corrected',
  'report_viewed',
  'signup_started',
  'signup_completed',
  'collection_item_added',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null
>;

export interface AnalyticsAdapter {
  readonly name: string;
  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void;
}

class ConsoleAnalyticsAdapter implements AnalyticsAdapter {
  readonly name = 'console';
  track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
    logger.info('analytics', { event, ...properties });
  }
}

class NoopAnalyticsAdapter implements AnalyticsAdapter {
  readonly name = 'noop';
  track(): void {
    // Intentionally empty.
  }
}

let adapter: AnalyticsAdapter | null = null;

export function getAnalytics(): AnalyticsAdapter {
  if (adapter) return adapter;
  adapter =
    serverConfig.analytics.adapter === 'console'
      ? new ConsoleAnalyticsAdapter()
      : new NoopAnalyticsAdapter();
  return adapter;
}

export function setAnalytics(next: AnalyticsAdapter | null): void {
  adapter = next;
}

export function trackEvent(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties,
): void {
  try {
    getAnalytics().track(event, properties);
  } catch (error) {
    // Analytics must never break a user flow.
    logger.warn('Analytics adapter threw', { event, error: String(error) });
  }
}
