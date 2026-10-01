/**
 * Service initialization — default (desktop: macOS/Windows)
 *
 * Firebase Auth is the JS SDK on every platform, initialised lazily in
 * AuthContext. Desktop links no native Firebase; what it does have is
 * analytics through GA4's Measurement Protocol (`./desktopAnalytics`), behind
 * the same `getAnalytics()` the iOS and Android files answer.
 */
import type { FirebaseAnalyticsService } from '@sudobility/di_rn';

let servicesInitialized = false;
let analyticsService: FirebaseAnalyticsService | null = null;

export async function initializeAllServices(): Promise<FirebaseAnalyticsService | null> {
  if (!servicesInitialized) {
    // Loaded here, not imported above: `src/analytics.ts` imports this file,
    // and a static import would pull AsyncStorage and di_rn into everything
    // that tracks an event, tests included.
    const { createDesktopAnalytics } = await import('./desktopAnalytics');
    analyticsService = createDesktopAnalytics();
    servicesInitialized = true;
  }
  return analyticsService;
}

/** This desktop's analytics, once services are initialized; null if unconfigured. */
export function getAnalytics(): FirebaseAnalyticsService | null {
  return analyticsService;
}
