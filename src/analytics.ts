/**
 * Analytics wrapper functions.
 *
 * Delegates to the FirebaseAnalyticsService obtained from DI: native Firebase
 * Analytics on iOS and Android, GA4's Measurement Protocol on macOS and
 * Windows (`src/di/desktopAnalytics.ts`). Every call is safe to invoke even
 * when analytics is unavailable (a desktop with no GA4 stream configured, or
 * before services are initialized) — it is then a no-op.
 */

import type { FirebaseAnalyticsService } from '@sudobility/di_rn';
import { getAnalytics } from '@/di/initializeServices';

/**
 * Every platform's `initializeServices` answers `FirebaseAnalyticsService |
 * null`: native Firebase Analytics on iOS and Android, GA4's Measurement
 * Protocol on macOS and Windows (null while unconfigured). TypeScript checks
 * against the base file alone, so the type is stated here.
 */
function analytics(): FirebaseAnalyticsService | null {
  return getAnalytics() as FirebaseAnalyticsService | null;
}

/** Track a screen view. Call once in a useEffect on mount. */
export function trackScreenView(
  screenName: string,
  screenClass?: string,
): void {
  analytics()?.trackScreenView(screenName, screenClass);
}

/** Track a generic analytics event. */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  analytics()?.trackEvent(eventName, params);
}

/** Track a button click. */
export function trackButtonClick(
  buttonName: string,
  params?: Record<string, unknown>,
): void {
  analytics()?.trackButtonClick(buttonName, params);
}

/** Track an error. */
export function trackError(errorMessage: string, errorCode?: string): void {
  analytics()?.trackError(errorMessage, errorCode);
}

/** Tie analytics to the signed-in account. Not cleared on sign-out. */
export function trackUserId(userId: string): void {
  analytics()?.setUserId(userId);
}
