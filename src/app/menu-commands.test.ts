/**
 * The menu bar, on the two platforms that build it natively from this repo:
 * macOS (`AppDelegate.mm` + `Main.storyboard`) and iPadOS
 * (`AppDelegate.swift` + `MoosiacMenuBridge.m`).
 *
 * Two things nothing else in the suite would notice. The menus are meant to be
 * the same menu, and a command added to one and not the other compiles and
 * runs fine — it is simply missing on one device. And an iPad keeps the
 * editor's title bar: `hasMenuBar()` is what hides it, so the iPad's bridge
 * must answer false there or every touch user loses Save, Undo and Settings.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '../..', path), 'utf8');

async function loadWith(bridge: Record<string, unknown> | undefined) {
  vi.resetModules();
  vi.doMock('react-native', () => ({
    NativeModules: { MoosiacMenuBridge: bridge },
    NativeEventEmitter: class {
      addListener() {
        return { remove() {} };
      }
    },
    Platform: { OS: 'ios' },
  }));
  vi.doMock('@/platform/projectsWindow', () => ({ focusMainWindow() {} }));
  return import('./menu-commands');
}

afterEach(() => {
  vi.doUnmock('react-native');
  vi.doUnmock('@/platform/projectsWindow');
});

describe('hasMenuBar', () => {
  it('is false with no bridge (Android, tests)', async () => {
    expect((await loadWith(undefined)).hasMenuBar()).toBe(false);
  });

  it('is true for a bridge that says nothing (macOS, Windows)', async () => {
    expect((await loadWith({})).hasMenuBar()).toBe(true);
  });

  it("is false for the iPad's bridge, read as a property or through getConstants", async () => {
    expect((await loadWith({ replacesTitleBar: false })).hasMenuBar()).toBe(
      false,
    );
    expect(
      (
        await loadWith({ getConstants: () => ({ replacesTitleBar: false }) })
      ).hasMenuBar(),
    ).toBe(false);
  });
});

describe('the macOS and iPad menus', () => {
  it('both post every command JavaScript answers', async () => {
    const { MENU_COMMANDS } = await loadWith(undefined);
    const mac = read('macos/music_app_rn-macOS/AppDelegate.mm');
    const ipad = read('ios/music_app_rn/AppDelegate.swift');
    for (const command of MENU_COMMANDS) {
      expect(mac, `macOS posts ${command}`).toContain(`@"${command}"`);
      expect(ipad, `iPad posts ${command}`).toContain(`post("${command}")`);
    }
  });

  it("the iPad's bridge keeps the title bar", () => {
    expect(read('ios/music_app_rn/MoosiacMenuBridge.m')).toMatch(
      /@"replacesTitleBar"\s*:\s*@NO/,
    );
  });
});
