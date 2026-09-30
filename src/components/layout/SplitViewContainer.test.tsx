/**
 * The detail of a split view, held to the web's measure.
 *
 * The web's master/detail layout caps the detail's content at 1024 and
 * centres it past that; a desktop window is wide enough for it to matter, and
 * a line of text the width of one is not a line anybody reads. The list is
 * not capped: it has a width of its own.
 */
import { Platform, StyleSheet, Text } from 'react-native';
import { renderWithApp } from '@/test/render';
import {
  DETAIL_MAX_WIDTH,
  DETAIL_PADDING,
} from '@/components/layout/EmbeddedScreen';
import {
  PHONE_PRIMARY_PANEL_WIDTH,
  PRIMARY_PANEL_WIDTH,
  SplitPanel,
} from './SplitViewContainer';

describe('SplitPanel', () => {
  it('caps what the detail holds at the web’s width, and centres it', () => {
    const view = renderWithApp(
      <SplitPanel secondary title="Chosen">
        <Text>detail</Text>
      </SplitPanel>,
    );
    const content = view.getByTestId('split-detail-content');
    expect(StyleSheet.flatten(content.props.style).maxWidth).toBe(1024);
    expect(DETAIL_MAX_WIDTH).toBe(1024);
    expect(content.props.className).toContain('w-full');
    expect(view.getByTestId('split-detail').props.className).toContain(
      'items-center',
    );
    expect(view.getByText('detail')).toBeTruthy();
  });

  it('keeps a titled bar over each panel under the system’s tab bar', () => {
    // A bar with nothing in it over a list is a strip of blank.
    const list = renderWithApp(
      <SplitPanel title="Projects">
        <Text>list</Text>
      </SplitPanel>,
    );
    expect(list.getByText('Projects')).toBeTruthy();
    expect(list.getByText('list')).toBeTruthy();
    const detail = renderWithApp(
      <SplitPanel secondary title="New Project">
        <Text>detail</Text>
      </SplitPanel>,
    );
    expect(detail.getByText('New Project')).toBeTruthy();
  });

  it('draws no bar in a desktop window, and heads the detail instead', () => {
    const os = Platform.OS;
    Platform.OS = 'macos';
    try {
      const list = renderWithApp(
        <SplitPanel title="Projects">
          <Text>list</Text>
        </SplitPanel>,
      );
      expect(list.queryByRole('header')).toBeNull();
      const detail = renderWithApp(
        <SplitPanel secondary title="New Project">
          <Text>detail</Text>
        </SplitPanel>,
      );
      expect(detail.getByText('New Project')).toBeTruthy();
    } finally {
      Platform.OS = os;
    }
  });

  it('leaves the list alone', () => {
    const view = renderWithApp(
      <SplitPanel title="List">
        <Text>list</Text>
      </SplitPanel>,
    );
    expect(view.queryByTestId('split-detail-content')).toBeNull();
    expect(view.getByText('list')).toBeTruthy();
  });

  it('insets the detail as the web does: px-6, pt-6, pb-6', () => {
    expect(DETAIL_PADDING).toBe(24);
  });

  it('gives a phone a narrower list than a tablet or a desktop', () => {
    expect(PHONE_PRIMARY_PANEL_WIDTH).toBe(240);
    expect(PRIMARY_PANEL_WIDTH).toBe(320);
  });
});
