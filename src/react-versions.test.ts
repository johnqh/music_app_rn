/**
 * React and every React Native renderer must agree on an exact version.
 *
 * Each React Native ships a renderer bundle **compiled against one exact React
 * version** and asserts it the moment the bundle loads. When they disagree the
 * app dies on its first screen with "Incompatible React versions", and the way
 * it presents is worse than the error: `react-native` and `react-native-macos`
 * pin different Reacts, so macOS runs perfectly while iOS and Android cannot
 * start — which reads like an iOS bug rather than a version one.
 *
 * Running Fabric does not avoid it. `RendererImplementation.findNodeHandle`
 * requires the **Paper** shim unconditionally, with no Fabric branch, so
 * anything reaching it — `Animated` with the native driver, for one — loads
 * Paper and trips the assert.
 *
 * This shipped once. It had already surfaced as a jest failure and was stubbed
 * around as "test-only" on the reasoning that Fabric carries no assert; the
 * test was the bug reporting itself. Hence a check that reads the versions
 * rather than an argument about them.
 */
import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

/** The literal each renderer bundle asserts against `React.version`. */
function rendererReactVersion(file: string): string | null {
  const match = /"(\d+\.\d+\.\d+)" !== isomorphicReactPackageVersion/.exec(
    readFileSync(file, 'utf8'),
  );
  return match?.[1] ?? null;
}

describe('React versions', () => {
  it('match across react and every installed renderer', () => {
    const react = (
      JSON.parse(readFileSync('node_modules/react/package.json', 'utf8')) as {
        version: string;
      }
    ).version;

    const renderers = globSync(
      'node_modules/react-native*/Libraries/Renderer/implementations/ReactNativeRenderer-dev.js',
    );
    // If this is empty the check has silently stopped checking anything.
    expect(renderers.length).toBeGreaterThan(0);

    const disagreeing = renderers
      .map(file => ({ file, wants: rendererReactVersion(file) }))
      .filter(r => r.wants !== null && r.wants !== react)
      .map(r => `${r.file} wants ${r.wants}, react is ${react}`);

    expect(disagreeing).toEqual([]);
  });
});
