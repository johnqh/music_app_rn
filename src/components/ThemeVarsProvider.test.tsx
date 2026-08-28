/**
 * The wrapper that makes semantic Tailwind classes resolve to the active theme.
 *
 * NativeWind on native does not switch CSS-variable blocks the way a browser
 * does, so the variables are applied with `vars()` on a wrapping view and
 * swapped by colour scheme. If this picks the wrong set, nothing throws — the
 * whole app simply renders in the other theme, or in browser defaults if the
 * variables are absent entirely.
 *
 * Asserted by **identity** against the exported `lightThemeVars` /
 * `darkThemeVars` rather than by reading variable names out of them: `vars()`
 * returns an opaque object — zero enumerable keys, and the light and dark ones
 * are indistinguishable once stringified — so an assertion on its contents
 * would be asserting nothing. Which of the two objects is applied is the
 * decision this component actually makes.
 */
import { jest } from '@jest/globals';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { darkThemeVars, lightThemeVars } from '@/config/themeVars';

const mockUseTheme = jest.fn(() => ({ resolved: 'light' }));
jest.mock('@/config/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

const { ThemeVarsProvider } =
  require('./ThemeVarsProvider') as typeof import('./ThemeVarsProvider');

/** The style array the wrapping view was given. */
function appliedStyle(resolved: string): unknown[] {
  mockUseTheme.mockReturnValue({ resolved });
  const view = render(
    <ThemeVarsProvider>
      <Text>content</Text>
    </ThemeVarsProvider>,
  );
  const root = view.UNSAFE_root.findAll(
    (node: { type: unknown; props: Record<string, unknown> }) =>
      typeof node.type === 'string' && node.props.style !== undefined,
  )[0];
  return [root!.props.style].flat();
}

describe('ThemeVarsProvider', () => {
  it('applies the dark variables in dark mode', () => {
    expect(appliedStyle('dark')).toContain(darkThemeVars);
  });

  it('applies the light variables in light mode', () => {
    expect(appliedStyle('light')).toContain(lightThemeVars);
  });

  it('applies one set or the other, never both', () => {
    // Both at once would leave the winner to style-array order, which is
    // exactly the kind of thing that works until someone reorders it.
    const dark = appliedStyle('dark');
    expect(dark).not.toContain(lightThemeVars);
  });

  it('renders what it wraps', () => {
    mockUseTheme.mockReturnValue({ resolved: 'light' });
    const view = render(
      <ThemeVarsProvider>
        <Text>content</Text>
      </ThemeVarsProvider>,
    );
    expect(view.getByText('content')).toBeTruthy();
  });
});
