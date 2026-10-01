/**
 * Analytics on the desktops (macOS, Windows) — the same file in sudojo_app_rn,
 * svgr_app_rn and music_app_rn.
 *
 * The phones send through native Firebase Analytics, which has no desktop
 * build, and the Firebase JS SDK's analytics needs a browser. So a desktop
 * sends through GA4's Measurement Protocol to its own Firebase web app's data
 * stream (`GA4_CONFIG`), wrapped in the same `FirebaseAnalyticsService` the
 * phones use: `src/analytics.ts` and every call site are the same on every
 * platform. AsyncStorage keeps the GA client id across launches.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FirebaseAnalyticsService,
  MeasurementProtocolAnalyticsService,
} from '@sudobility/di_rn';
import { GA4_CONFIG } from '@/config/env';

/** This desktop's analytics, or null when the build has no GA4 stream configured. */
export function createDesktopAnalytics(): FirebaseAnalyticsService | null {
  const backend = new MeasurementProtocolAnalyticsService({
    ...GA4_CONFIG,
    storage: AsyncStorage,
  });
  return backend.isSupported()
    ? new FirebaseAnalyticsService(() => backend)
    : null;
}
