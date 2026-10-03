/**
 * API keys, for the account's own workspace.
 *
 * `entity_client`'s hooks are stood in for, so what is pinned is which
 * workspace the keys are asked of, and that a new key's secret is shown once
 * and put away.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';

const mockEntities = jest.fn<() => unknown>();
const mockKeys = jest.fn<(slug: string | null) => unknown>();
const mockCreate = jest.fn();
const mockRevoke = jest.fn();
let mockCreated: unknown = null;
/** When set, a create waits on this rather than answering at once. */
let mockHold: Promise<void> | null = null;

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));
jest.mock('@/features/account/useAccountClients', () => ({
  useEntityClient: () => ({}),
}));
jest.mock(
  '@sudobility/entity_client',
  () => ({
    useEntities: () => mockEntities(),
    useEntityApiKeys: (_client: unknown, slug: string | null) => mockKeys(slug),
    useCreateApiKey: () => ({
      isPending: false,
      mutateAsync: async (variables: unknown) => {
        mockCreate(variables);
        if (mockHold) await mockHold;
        return mockCreated;
      },
    }),
    useRevokeApiKey: () => ({
      isPending: false,
      mutateAsync: async (variables: unknown) => mockRevoke(variables),
    }),
  }),
  { virtual: true },
);

const { ApiKeysSection } =
  require('./ApiKeysSection') as typeof import('./ApiKeysSection');

const PERSONAL = { entitySlug: 'ada', entityType: 'personal' };
const TEAM = { entitySlug: 'orchestra', entityType: 'organization' };

beforeEach(() => {
  mockEntities.mockReturnValue({ data: [TEAM, PERSONAL], isLoading: false });
  mockKeys.mockReturnValue({ data: [], isLoading: false, error: null });
  mockCreate.mockReset();
  mockRevoke.mockReset();
  mockCreated = { keyName: 'Deploy', key: 'sk_live_secret' };
  mockHold = null;
});

describe('ApiKeysSection', () => {
  it("asks for the personal workspace's keys, wherever it is in the list", () => {
    renderWithApp(<ApiKeysSection />);
    expect(mockKeys).toHaveBeenLastCalledWith('ada');
  });

  it('says so when the account has no workspace yet, and offers no key', () => {
    mockEntities.mockReturnValue({ data: [], isLoading: false });
    const view = renderWithApp(<ApiKeysSection />);
    expect(view.getByText('Your workspace is not available yet.')).toBeTruthy();
    expect(view.queryByLabelText('Create key')).toBeNull();
  });

  it('creates a key under the name given, and shows its secret', async () => {
    const view = renderWithApp(<ApiKeysSection />);
    fireEvent.changeText(view.getByLabelText('Key name'), '  Deploy ');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Create key'));
    });
    expect(mockCreate).toHaveBeenCalledWith({
      entitySlug: 'ada',
      request: { key_name: 'Deploy' },
    });
    expect(view.getByText('sk_live_secret')).toBeTruthy();
    expect(
      view.getByText('Copy this secret now. It cannot be shown again.'),
    ).toBeTruthy();
  });

  it('spins on Create while the key is being made, and makes one', async () => {
    let release = () => {};
    mockHold = new Promise<void>(resolve => {
      release = resolve;
    });
    const view = renderWithApp(<ApiKeysSection />);
    fireEvent.changeText(view.getByLabelText('Key name'), 'Deploy');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Create key'));
    });
    const create = view.getByLabelText('Create key');
    expect(create.props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => {
      fireEvent.press(create);
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
    expect(view.getByText('sk_live_secret')).toBeTruthy();
  });

  it('puts the secret away when asked, for good', async () => {
    const view = renderWithApp(<ApiKeysSection />);
    fireEvent.changeText(view.getByLabelText('Key name'), 'Deploy');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Create key'));
    });
    fireEvent.press(view.getByLabelText('Hide'));
    expect(view.queryByText('sk_live_secret')).toBeNull();
  });

  it('lists each key by its prefix, never its secret, and revokes by name', async () => {
    mockKeys.mockReturnValue({
      data: [
        {
          id: 'k1',
          keyName: 'Deploy',
          keyPrefix: 'sk_live_ab',
          isActive: true,
          lastUsedAt: null,
        },
        {
          id: 'k2',
          keyName: 'Old',
          keyPrefix: 'sk_live_zz',
          isActive: false,
          lastUsedAt: null,
        },
      ],
      isLoading: false,
      error: null,
    });
    const view = renderWithApp(<ApiKeysSection />);
    expect(view.getByText(/sk_live_ab… · Active · Never used/)).toBeTruthy();
    expect(view.getByText(/sk_live_zz… · Revoked/)).toBeTruthy();
    // A revoked key has nothing left to revoke.
    expect(view.queryByLabelText('Revoke Old')).toBeNull();
    await act(async () => {
      fireEvent.press(view.getByLabelText('Revoke Deploy'));
    });
    expect(mockRevoke).toHaveBeenCalledWith({ entitySlug: 'ada', keyId: 'k1' });
  });
});
