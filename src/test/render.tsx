/**
 * The scaffolding a component test needs, in one place.
 *
 * Two things every rendered component here depends on and neither of which a
 * test should have to remember: i18n (without it every label renders as its own
 * key, so an assertion on visible text checks nothing) and a document to edit.
 * `renderWithApp` provides the first; `testDocument` builds the second.
 */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { PortalHost } from '@sudobility/components-rn';
import { createEmptyScore } from '@sudobility/music_types';
import { createDocument } from '@/documents/document';
import type { MusicDocument } from '@/documents/document';
import { initializeI18n } from '@/i18n';
import {
  appServicesInstalled,
  installTestAppServices,
} from '@/config/initialize';

let started = false;

/** A document over an eight-bar empty score, the app's own new-score shape. */
export function testDocument(
  options: { measures?: number; title?: string } = {},
): MusicDocument {
  return createDocument({
    id: 'test',
    title: options.title ?? 'Test',
    score: createEmptyScore({
      title: options.title ?? 'Test',
      measures: options.measures ?? 8,
    }),
  });
}

/** Renders with i18n started. */
export function renderWithApp(ui: ReactElement) {
  if (!started) {
    // Once per process: i18next is a singleton and re-initialising it mid-run
    // drops the resources every earlier test resolved against.
    initializeI18n(['en']);
    started = true;
  }
  /*
    Stand-ins rather than a real audio engine, and only when a test has not
    installed its own — a caller that injected a recording player must not have
    it replaced here. Guarding on `started` instead broke exactly one test per
    file: the first, which is the only one where this branch ran.
  */
  if (!appServicesInstalled()) installTestAppServices();
  /*
    `PortalHost`, exactly as `App.tsx` mounts it. Anything that opens a sheet
    portals its overlay to the root rather than rendering it in place — so
    without a host here that overlay renders nowhere, and a test asserting on
    it fails while the app works.

    Passed as RTL's `wrapper` rather than wrapped around `ui` by hand: a
    caller's `rerender(<Thing/>)` passes the bare element, which would replace
    the hand-written wrapper and unmount everything under it. `wrapper` is
    re-applied on every rerender, which is what makes it survive.

    The cost is that the tree is no longer empty when a component draws
    nothing — the host itself is always there — so "rendered nothing" is an
    assertion about its children.
  */
  return render(ui, { wrapper: PortalHost });
}
