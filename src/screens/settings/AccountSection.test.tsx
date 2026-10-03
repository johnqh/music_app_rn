/**
 * The account section: the way in when signed out, and once signed in the
 * nickname and picture.
 *
 * What is pinned is what reaches the server — a trimmed name, null for a name
 * taken away, the picture the picker prepared — and that the section says so
 * when it does not get there.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';

const mockUser = jest.fn<() => unknown>();
const mockProfile = jest.fn<() => unknown>();
const mockUpdate = jest.fn();
const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockPick = jest.fn<() => Promise<unknown>>();
let mockFails = false;
/** When set, every write waits on this rather than answering at once. */
let mockHold: Promise<void> | null = null;

function mockMutation(spy: (variables: unknown) => void) {
  return {
    isPending: false,
    mutateAsync: async (variables: unknown) => {
      spy(variables);
      if (mockHold) await mockHold;
      if (mockFails) throw new Error('refused');
    },
  };
}

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser(), signOut: async () => {} }),
}));
jest.mock('@/config/useServerContext', () => ({
  useServerContext: () => ({ userId: 'u1' }),
}));
jest.mock('@/config/server', () => ({
  getMusicClient: () => ({
    avatarUrl: (id: string) => `https://api.test/avatars/${id}`,
  }),
}));
jest.mock('@sudobility/music_client', () => ({
  useProfile: () => ({ data: mockProfile(), isLoading: false }),
  useUpdateProfile: () => mockMutation(mockUpdate),
  useUploadAvatar: () => mockMutation(mockUpload),
  useDeleteAvatar: () => mockMutation(mockRemove),
}));
jest.mock('@/features/account/useAvatarPicker', () => ({
  useAvatarPicker: () => ({ supported: true, pick: () => mockPick() }),
}));
jest.mock('@/features/account/SignInPage', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native') as typeof import('react-native');
  return { SignInPage: () => <Text>sign-in page</Text> };
});

const { AccountSection } =
  require('./AccountSection') as typeof import('./AccountSection');

const PICTURE = {
  uri: 'file:///cache/avatar.jpg',
  name: 'avatar.jpg',
  type: 'image/jpeg',
};

beforeEach(() => {
  mockUser.mockReturnValue({ uid: 'u1', email: 'ada@example.com' });
  mockProfile.mockReturnValue({ nickname: 'Ada', avatarId: null });
  mockUpdate.mockReset();
  mockUpload.mockReset();
  mockRemove.mockReset();
  mockPick.mockReset();
  mockFails = false;
  mockHold = null;
});

describe('AccountSection', () => {
  it('is the sign-in page when nobody is signed in', () => {
    // A pane somebody goes to in order to sign in: the page, not a modal.
    mockUser.mockReturnValue(null);
    const view = renderWithApp(<AccountSection />);
    expect(view.getByText('sign-in page')).toBeTruthy();
    expect(view.queryByLabelText('Nickname')).toBeNull();
  });

  it('says who is signed in, and offers the way out', () => {
    const view = renderWithApp(<AccountSection />);
    expect(view.getByText('ada@example.com')).toBeTruthy();
    expect(view.getByText('Sign out')).toBeTruthy();
  });

  it('shows the nickname the server holds, with nothing to save yet', () => {
    const view = renderWithApp(<AccountSection />);
    expect(view.getByLabelText('Nickname').props.value).toBe('Ada');
    fireEvent.press(view.getByLabelText('Save'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saves the name without the spaces around it', async () => {
    const view = renderWithApp(<AccountSection />);
    fireEvent.changeText(view.getByLabelText('Nickname'), '  Ada Lovelace  ');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Save'));
    });
    expect(mockUpdate).toHaveBeenCalledWith({ nickname: 'Ada Lovelace' });
  });

  it('spins on Save while the name is being written, and saves it once', async () => {
    let release = () => {};
    mockHold = new Promise<void>(resolve => {
      release = resolve;
    });
    const view = renderWithApp(<AccountSection />);
    fireEvent.changeText(view.getByLabelText('Nickname'), 'Grace');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Save'));
    });
    const save = view.getByLabelText('Save');
    expect(save.props.accessibilityState).toMatchObject({ disabled: true });
    // The picture's controls wait too: one profile write at a time.
    expect(
      view.getByLabelText('Choose picture').props.accessibilityState,
    ).toMatchObject({ disabled: true });
    await act(async () => {
      fireEvent.press(save);
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
    expect(
      view.getByLabelText('Choose picture').props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  it('takes the name away when the field is emptied', async () => {
    // Null, not an empty string: the server refuses a name of nothing, and
    // the publish sheet goes back to offering the last name used.
    const view = renderWithApp(<AccountSection />);
    fireEvent.changeText(view.getByLabelText('Nickname'), '   ');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Save'));
    });
    expect(mockUpdate).toHaveBeenCalledWith({ nickname: null });
  });

  it('uploads the picture the picker prepared', async () => {
    mockPick.mockResolvedValue(PICTURE);
    const view = renderWithApp(<AccountSection />);
    await act(async () => {
      fireEvent.press(view.getByLabelText('Choose picture'));
    });
    expect(mockUpload).toHaveBeenCalledWith({
      file: PICTURE,
      filename: 'avatar.jpg',
    });
  });

  it('uploads nothing when the reader closes the chooser', async () => {
    mockPick.mockResolvedValue(null);
    const view = renderWithApp(<AccountSection />);
    await act(async () => {
      fireEvent.press(view.getByLabelText('Choose picture'));
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(view.queryByText(/could not/i)).toBeNull();
  });

  it('says so when the file cannot be made into a picture', async () => {
    mockPick.mockRejectedValue(new Error('Not an image'));
    const view = renderWithApp(<AccountSection />);
    await act(async () => {
      fireEvent.press(view.getByLabelText('Choose picture'));
    });
    expect(
      view.getByText('That file could not be used as a picture.'),
    ).toBeTruthy();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('shows the picture and offers to remove it, once there is one', async () => {
    mockProfile.mockReturnValue({ nickname: 'Ada', avatarId: 'abc123' });
    const view = renderWithApp(<AccountSection />);
    expect(view.getByLabelText('Profile picture').props.source).toEqual({
      uri: 'https://api.test/avatars/abc123',
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Remove picture'));
    });
    expect(mockRemove).toHaveBeenCalled();
  });

  it('offers no removal where there is nothing to remove', () => {
    const view = renderWithApp(<AccountSection />);
    expect(view.queryByLabelText('Remove picture')).toBeNull();
  });

  it('says so when the server refuses', async () => {
    mockFails = true;
    const view = renderWithApp(<AccountSection />);
    fireEvent.changeText(view.getByLabelText('Nickname'), 'Grace');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Save'));
    });
    expect(view.getByText('Could not save your profile.')).toBeTruthy();
  });
});
