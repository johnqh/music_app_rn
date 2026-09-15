/**
 * New Project against the server, when the server says no.
 *
 * The dashboard and the File menu used to await the create with no `catch`, so
 * a refused job was an unhandled rejection and the sheet just stopped
 * spinning. A 402 must raise the paywall; anything else must say what went
 * wrong; and the courtesy gate must follow the web's rule, including standing
 * aside for a site administrator.
 */
import { jest } from '@jest/globals';
import { Pressable, Text } from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { ApiError, InsufficientCreditsError } from '@sudobility/music_client';
import type { NewProjectSubmission } from '@sudobility/music_lib';
import { renderWithApp } from '@/test/render';

const mockCreate = jest.fn<(...args: unknown[]) => Promise<{ id: string }>>();
const mockAuth = { siteAdmin: false };
const mockBalance: { balance: number | null } = { balance: 5 };

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u' },
    siteAdmin: mockAuth.siteAdmin,
    getToken: async () => 'token',
  }),
}));
jest.mock('@/config/server', () => ({ getMusicClient: () => ({}) }));
jest.mock('@/features/credits/useCreditBalance', () => ({
  useCreditBalance: () => ({
    balance: mockBalance.balance,
    loading: false,
    refresh: () => undefined,
  }),
}));
/*
  Only the network half is replaced. `classifyGenerationError` stays real,
  because which refusals open the paywall is exactly what these tests are
  about.
*/
jest.mock('@sudobility/music_client', () => ({
  ...(jest.requireActual('@sudobility/music_client') as object),
  createGeneratedProject: (...args: unknown[]) => mockCreate(...args),
}));

const { ServerProjectCreationFeedback, useServerProjectCreation } =
  require('./useServerProjectCreation') as typeof import('./useServerProjectCreation');

const SUBMISSION = { kind: 'generate', request: {} } as NewProjectSubmission;

function Harness({ onCreated }: { onCreated?: (id: string | null) => void }) {
  const creation = useServerProjectCreation();
  return (
    <>
      <Text>{creation.outOfCredits ? 'gated' : 'open'}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="create"
        onPress={() => void creation.create(SUBMISSION).then(onCreated)}
      />
      <ServerProjectCreationFeedback creation={creation} />
    </>
  );
}

beforeEach(() => {
  mockCreate.mockReset();
  mockAuth.siteAdmin = false;
  mockBalance.balance = 5;
});

describe('useServerProjectCreation', () => {
  it('raises the paywall for a refusal for want of credits', async () => {
    mockCreate.mockRejectedValue(new InsufficientCreditsError());
    const onCreated = jest.fn();
    const view = renderWithApp(<Harness onCreated={onCreated} />);
    fireEvent.press(view.getByLabelText('create'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(null));
    expect(view.getByText('Out of credits')).toBeTruthy();
  });

  it('raises the paywall for a bare 402 as well', async () => {
    // A 402 that reached the caller as a plain ApiError is the same refusal;
    // reporting it as a failure would hide the one remedy there is.
    mockCreate.mockRejectedValue(new ApiError('Payment Required', 402));
    const view = renderWithApp(<Harness />);
    fireEvent.press(view.getByLabelText('create'));
    await waitFor(() => expect(view.getByText('Out of credits')).toBeTruthy());
  });

  it('reports any other refusal with its message', async () => {
    mockCreate.mockRejectedValue(new Error('server unreachable'));
    const view = renderWithApp(<Harness />);
    fireEvent.press(view.getByLabelText('create'));
    await waitFor(() =>
      expect(view.getByText('server unreachable')).toBeTruthy(),
    );
    expect(view.getByText('Failed to create project')).toBeTruthy();
  });

  it('resolves the new project id when it works', async () => {
    mockCreate.mockResolvedValue({ id: 'project-1' });
    const onCreated = jest.fn();
    const view = renderWithApp(<Harness onCreated={onCreated} />);
    fireEvent.press(view.getByLabelText('create'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('project-1'));
  });

  it('gates at a spent balance, but never an administrator or an unknown one', () => {
    mockBalance.balance = 0;
    expect(renderWithApp(<Harness />).getByText('gated')).toBeTruthy();

    mockAuth.siteAdmin = true;
    expect(renderWithApp(<Harness />).getAllByText('open')).toBeTruthy();

    mockAuth.siteAdmin = false;
    mockBalance.balance = null;
    expect(renderWithApp(<Harness />).getAllByText('open')).toBeTruthy();
  });
});
