/**
 * The device's preferences: one store for the app, not one per document.
 *
 * Theme, language, written or concert pitch, developer mode and whether the
 * keyboard is collapsed belong to the *device* — a reader who switches to
 * written pitch has switched for every score, and one who collapses the
 * keyboard does not expect it back on the next tab. The web app keeps them in
 * its one app store; this app has a store per document, so they live in
 * music_lib's `createDevicePrefsStore` and the composition root
 * (`bindDevicePrefs`) loads them at start-up and writes every change back.
 *
 * Three of them are read by *editing* — note entry inverts the written-pitch
 * lens, the canvas takes the theme — off each document's own store, so the
 * document list mirrors them into every open store (`mirrorDevicePrefs`). The
 * mirror runs one way: a control that changes one of them writes **here**, and
 * writing it to a document store instead would change one tab, persist nothing
 * and be overwritten by the next change made here.
 *
 * They used to be scattered: the theme in a key of its own, the keyboard a
 * `useState(true)` in the layout that forgot itself on every launch (and
 * started collapsed, where the web starts expanded), pitch display per document
 * and unremembered, and the language chosen from the device on every launch.
 *
 * A module singleton rather than a provider, like `getAppServices()`: a
 * component test gets a working, unbound store with the defaults and needs no
 * wrapper, which is exactly what a component that only wants to know the theme
 * should need.
 */
import { useStore } from 'zustand';
import { createDevicePrefsStore } from '@sudobility/music_lib';
import type { DevicePrefsState } from '@sudobility/music_lib';

export const devicePrefs = createDevicePrefsStore();

export function useDevicePrefs<T>(selector: (state: DevicePrefsState) => T): T {
  return useStore(devicePrefs, selector);
}
