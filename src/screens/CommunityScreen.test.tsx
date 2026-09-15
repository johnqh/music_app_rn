/**
 * The community list: the web page's states and titles, from music_types.
 *
 * `communityListState` and `communityItemTitle` are tested upstream; what this
 * pins is that the screen reads them — a blank public title printed an empty
 * row here (`publicName || name` treats spaces as a title), and a failed load
 * was told apart from an empty community only by which string happened to be
 * set.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import type { CommunityItem } from '@sudobility/music_types';
import { renderWithApp } from '@/test/render';
import { CommunityScreen } from './CommunityScreen';

const mockListCommunity = jest.fn<() => Promise<CommunityItem[]>>();

// One client, as the real `getMusicClient` caches one: a fresh object per call
// would re-run the screen's load effect on every render.
jest.mock('@/config/server', () => {
  const client = { listCommunity: () => mockListCommunity() };
  return { getMusicClient: () => client };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

function item(patch: Partial<CommunityItem>): CommunityItem {
  return {
    publicId: 'p1',
    name: 'Snapshot name',
    publicName: 'Public title',
    publisherName: 'Ada',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  } as CommunityItem;
}

async function render() {
  const view = renderWithApp(<CommunityScreen />);
  await act(async () => {});
  return view;
}

describe('CommunityScreen', () => {
  it('titles a row with no public title by its name, not an empty line', async () => {
    mockListCommunity.mockResolvedValue([item({ publicName: '   ' })]);
    const view = await render();
    expect(view.getByText('Snapshot name')).toBeTruthy();
  });

  it('says a search matched nothing, rather than that nothing exists', async () => {
    mockListCommunity.mockResolvedValue([item({})]);
    const view = await render();
    fireEvent.changeText(view.getByLabelText(/search/i), 'zzzz');
    expect(view.queryByText('Public title')).toBeNull();
    expect(view.getByText(/zzzz/)).toBeTruthy();
  });

  it('reports a failed load as a failure', async () => {
    mockListCommunity.mockRejectedValue(new Error('offline'));
    const view = await render();
    expect(view.queryByText('offline')).toBeNull();
    expect(view.getByText(/could not|couldn't|failed/i)).toBeTruthy();
  });
});
