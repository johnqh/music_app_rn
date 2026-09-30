/**
 * Redeeming a coupon, and making one.
 *
 * Both talk to `ConsumablesApiClient`, stood in for here, so what is pinned
 * is what each asks of it and what it says of the answer.
 */
import { jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';

const mockClient = {
  redeemCreditCoupon:
    jest.fn<(code: string) => Promise<{ credits: number; balance: number }>>(),
  listCreditCoupons: jest.fn<() => Promise<unknown[]>>(),
  createCreditCoupon:
    jest.fn<(input: Record<string, unknown>) => Promise<{ code: string }>>(),
};
let mockHasServer = true;

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));
jest.mock('@/features/account/useAccountClients', () => ({
  useConsumablesClient: () => (mockHasServer ? mockClient : null),
}));

const { RedeemCouponForm } =
  require('./RedeemCouponForm') as typeof import('./RedeemCouponForm');
const { ManageCouponsSection } =
  require('./ManageCouponsSection') as typeof import('./ManageCouponsSection');

beforeEach(() => {
  mockHasServer = true;
  mockClient.redeemCreditCoupon.mockReset();
  mockClient.listCreditCoupons.mockReset();
  mockClient.listCreditCoupons.mockResolvedValue([]);
  mockClient.createCreditCoupon.mockReset();
});

describe('RedeemCouponForm', () => {
  it('has nothing to redeem until a code is typed', () => {
    const view = renderWithApp(<RedeemCouponForm />);
    fireEvent.press(view.getByLabelText('Redeem'));
    expect(mockClient.redeemCreditCoupon).not.toHaveBeenCalled();
  });

  it('redeems the code without the spaces around it, and says what it was worth', async () => {
    mockClient.redeemCreditCoupon.mockResolvedValue({
      credits: 50,
      balance: 150,
    });
    const view = renderWithApp(<RedeemCouponForm />);
    fireEvent.changeText(view.getByLabelText('Coupon code'), '  SPRING50 ');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Redeem'));
    });
    expect(mockClient.redeemCreditCoupon).toHaveBeenCalledWith('SPRING50');
    expect(
      view.getByText('50 credits added. Your balance is 150.'),
    ).toBeTruthy();
    // Spent, so it is not left in the field to be sent again.
    expect(view.getByLabelText('Coupon code').props.value).toBe('');
  });

  it('says so when the coupon is refused, and keeps the code to correct', async () => {
    mockClient.redeemCreditCoupon.mockRejectedValue(new Error('expired'));
    const view = renderWithApp(<RedeemCouponForm />);
    fireEvent.changeText(view.getByLabelText('Coupon code'), 'OLD');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Redeem'));
    });
    expect(view.getByText('That coupon could not be redeemed.')).toBeTruthy();
    expect(view.getByLabelText('Coupon code').props.value).toBe('OLD');
  });

  it('tells whoever shows the balance to ask again, once one is spent', async () => {
    mockClient.redeemCreditCoupon.mockResolvedValue({
      credits: 50,
      balance: 150,
    });
    const onRedeemed = jest.fn();
    const view = renderWithApp(<RedeemCouponForm onRedeemed={onRedeemed} />);
    fireEvent.changeText(view.getByLabelText('Coupon code'), 'SPRING50');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Redeem'));
    });
    expect(onRedeemed).toHaveBeenCalledTimes(1);
  });

  it('does not say the balance changed when the coupon was refused', async () => {
    mockClient.redeemCreditCoupon.mockRejectedValue(new Error('expired'));
    const onRedeemed = jest.fn();
    const view = renderWithApp(<RedeemCouponForm onRedeemed={onRedeemed} />);
    fireEvent.changeText(view.getByLabelText('Coupon code'), 'OLD');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Redeem'));
    });
    expect(onRedeemed).not.toHaveBeenCalled();
  });

  it('draws nothing where there is no server, which the screen has already said', () => {
    mockHasServer = false;
    const view = renderWithApp(<RedeemCouponForm />);
    expect(view.queryByLabelText('Coupon code')).toBeNull();
    expect(view.queryByText(/needs a server connection/i)).toBeNull();
  });
});

describe('ManageCouponsSection', () => {
  it('lists the coupons there are, with what became of each', async () => {
    mockClient.listCreditCoupons.mockResolvedValue([
      {
        code: 'SPRING50',
        credits: 50,
        expiresAt: '2030-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        email: 'ada@example.com',
        history: [{ credits: 50, redeemedAt: '2026-02-01T00:00:00.000Z' }],
      },
    ]);
    const view = renderWithApp(<ManageCouponsSection />);
    await waitFor(() => expect(view.getByText('SPRING50')).toBeTruthy());
    expect(view.getByText(/Redeemed 1 times/)).toBeTruthy();
    expect(view.getByText(/ada@example\.com/)).toBeTruthy();
  });

  it('says there are none, rather than showing nothing', async () => {
    const view = renderWithApp(<ManageCouponsSection />);
    await waitFor(() => expect(view.getByText('No coupons yet.')).toBeTruthy());
  });

  it('will not create a coupon worth nothing, or with no date', async () => {
    const view = renderWithApp(<ManageCouponsSection />);
    await waitFor(() => expect(view.getByText('No coupons yet.')).toBeTruthy());
    fireEvent.changeText(view.getByLabelText('Credits'), '0');
    fireEvent.changeText(view.getByLabelText('Expiry date'), '2030-01-01');
    fireEvent.press(view.getByLabelText('Create coupon'));
    fireEvent.changeText(view.getByLabelText('Credits'), '50');
    fireEvent.changeText(view.getByLabelText('Expiry date'), 'next week');
    fireEvent.press(view.getByLabelText('Create coupon'));
    expect(mockClient.createCreditCoupon).not.toHaveBeenCalled();
  });

  it('creates one for anybody when no email is given, and lists again', async () => {
    mockClient.createCreditCoupon.mockResolvedValue({ code: 'NEW100' });
    const view = renderWithApp(<ManageCouponsSection />);
    await waitFor(() => expect(view.getByText('No coupons yet.')).toBeTruthy());
    fireEvent.changeText(view.getByLabelText('Credits'), '100');
    fireEvent.changeText(view.getByLabelText('Expiry date'), '2030-06-05');
    await act(async () => {
      fireEvent.press(view.getByLabelText('Create coupon'));
    });
    const sent = mockClient.createCreditCoupon.mock.calls[0]![0];
    expect(sent.credits).toBe(100);
    expect(sent.email).toBeNull();
    // The whole of the day named, in whatever zone this runs in.
    expect(new Date(sent.expires_at as string).getTime()).toBe(
      new Date('2030-06-05T23:59:59').getTime(),
    );
    expect(view.getByText('Created NEW100')).toBeTruthy();
    expect(mockClient.listCreditCoupons).toHaveBeenCalledTimes(2);
  });

  it('says so when the server refuses, as it does anybody who is not an administrator', async () => {
    mockClient.listCreditCoupons.mockRejectedValue(new Error('forbidden'));
    const view = renderWithApp(<ManageCouponsSection />);
    await waitFor(() =>
      expect(
        view.getByText('Could not load this. Try again later.'),
      ).toBeTruthy(),
    );
    expect(view.queryByText('No coupons yet.')).toBeNull();
  });
});
