import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CartPage from '../page'; // Adjust path as necessary
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation'; // Corrected import

// --- Mocks ---
jest.mock('@/hooks/useCart', () => ({
  useCart: jest.fn(),
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(),
}));
jest.mock('next/navigation', () => ({ // Corrected mock
  useRouter: jest.fn(),
}));

// Mock StripePaymentFormWrapper
jest.mock('@/components/checkout/StripePaymentForm', () => {
  // Props for the mock: onPaymentSuccess, onPaymentError, onCancel, totalAmount, currency
  return jest.fn(({ onPaymentSuccess, onPaymentError, onCancel, totalAmount, currency }) => (
    <div data-testid="stripe-payment-form-mock">
      <button onClick={() => onPaymentSuccess('pi_mock_success')}>Simulate Stripe Success</button>
      <button onClick={() => onPaymentError('Stripe Error')}>Simulate Stripe Error</button>
      <button onClick={onCancel}>Cancel Stripe</button>
      <p>Total: {totalAmount} {currency}</p>
    </div>
  ));
});

// Mock ShippingAddressForm
jest.mock('@/components/checkout/ShippingAddressForm', () => ({
    ShippingAddressForm: jest.fn(({ onAddressSubmitted }) => (
        <div data-testid="shipping-address-form-mock">
        <button onClick={() => onAddressSubmitted({ city: 'Test City' })}>Submit Address</button>
        </div>
    )),
}));


global.fetch = jest.fn(); // Mock global fetch

// Mock ethers
const mockEthersProvider = {
  send: jest.fn().mockResolvedValue(undefined), // For eth_requestAccounts
  getSigner: jest.fn(),
};
const mockEthersSigner = {
  getAddress: jest.fn(),
};
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'), // Import actual ethers for BrowserProvider if not fully mocking it
  ethers: { // Keep this structure if you intend to mock specific ethers.X exports
    BrowserProvider: jest.fn().mockImplementation(() => mockEthersProvider),
  }
}));


describe('CartPage - Payment Flows', () => {
  let mockCart: any;
  let mockAuth: any;
  let mockToast: any;
  let mockRouterPush: any;

  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();

    mockCart = {
      cartItems: [{ id: '1', name: 'Test Item', price: 100, quantity: 1, imageUrl: '/test.jpg', category: 'Test Cat', dataAiHint: 'hint' }],
      removeFromCart: jest.fn(),
      updateQuantity: jest.fn(),
      getCartTotal: jest.fn().mockReturnValue(100),
      clearCart: jest.fn(),
      getCartItemCount: jest.fn().mockReturnValue(1),
    };
    mockAuth = {
      user: { id: 'user1', taicBalance: 500, orders: [], paymentMethods: [] }, // Logged-in user by default
      updateUser: jest.fn(),
      userId: 'user1',
    };
    mockToast = {
      toast: jest.fn(),
    };
    mockRouterPush = jest.fn();

    (useCart as jest.Mock).mockReturnValue(mockCart);
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
    (useToast as jest.Mock).mockReturnValue(mockToast);
    (useRouter as jest.Mock).mockReturnValue({ push: mockRouterPush });

    // Setup mock signer for ethers
    mockEthersProvider.getSigner.mockResolvedValue(mockEthersSigner);
    mockEthersSigner.getAddress.mockResolvedValue('0xMockAddress');

    // Mock window.ethereum
    global.window.ethereum = {} as any; // Basic mock for window.ethereum presence
  });

  // --- Helper to proceed to checkout ---
  const proceedToCheckout = async () => {
    render(<CartPage />);
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Checkout/i }));
    await waitFor(() => expect(screen.getByText('Choose Payment Method')).toBeInTheDocument());
  };

  // --- Stripe Payment Tests ---
  describe('Stripe Payment Flow (Logged In User)', () => {
    it('should render StripePaymentForm when Stripe option is chosen and handle success', async () => {
      await proceedToCheckout();
      fireEvent.click(screen.getByRole('button', { name: /Pay with Card \(Stripe\)/i }));

      await waitFor(() => {
        expect(screen.getByTestId('stripe-payment-form-mock')).toBeInTheDocument();
      });

      // Simulate Stripe success from the mock component
      fireEvent.click(screen.getByText('Simulate Stripe Success'));

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Stripe Payment Successful" }));
        // Should proceed to address form
        expect(screen.getByTestId('shipping-address-form-mock')).toBeInTheDocument();
      });
    });

    it('should handle Stripe payment error', async () => {
      await proceedToCheckout();
      fireEvent.click(screen.getByRole('button', { name: /Pay with Card \(Stripe\)/i }));
      await waitFor(() => expect(screen.getByTestId('stripe-payment-form-mock')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Simulate Stripe Error'));

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Stripe Payment Failed", variant: "destructive" }));
        // Should go back to payment selection
        expect(screen.getByText('Choose Payment Method')).toBeInTheDocument();
      });
    });
  });

  // --- Crypto Wallet Payment Tests ---
  describe('Crypto Wallet Payment Flow (Guest User)', () => {
    beforeEach(() => {
      // Simulate guest user for these tests
      (useAuth as jest.Mock).mockReturnValue({ user: null, updateUser: jest.fn(), userId: null });
    });

    const openCryptoConnectDialog = async () => {
        render(<CartPage />);
        fireEvent.click(screen.getByRole('button', { name: /Proceed to Checkout/i }));
        await waitFor(() => expect(screen.getByText('Checkout Options')).toBeInTheDocument()); // Initial dialog for guest
        fireEvent.click(screen.getByRole('button', { name: /Connect Crypto Wallet for TAIC/i }));
        await waitFor(() => expect(screen.getByText('Connect Crypto Wallet')).toBeInTheDocument());
    };

    it('connects to wallet successfully and shows connected address', async () => {
      await openCryptoConnectDialog();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i }));
      });
      await waitFor(() => {
        expect(mockEthersProvider.send).toHaveBeenCalledWith("eth_requestAccounts", []);
        expect(mockEthersSigner.getAddress).toHaveBeenCalled();
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      });
      // The component renders the full address, the toast shows the shortened one.
      // Test should check for the full address in the component's body.
      expect(await screen.findByText('0xMockAddress')).toBeInTheDocument();
    });

    it('handles wallet connection failure', async () => {
        mockEthersProvider.send.mockRejectedValueOnce(new Error('User rejected connection'));
        await openCryptoConnectDialog();
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i }));
        });
        await waitFor(() => {
            expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Wallet Connection Failed" }));
            expect(screen.getByText(/User rejected connection/i)).toBeInTheDocument();
        });
    });

    it('initiates crypto payment after wallet connection and displays details', async () => {
      await openCryptoConnectDialog();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i })); });
      await waitFor(() => expect(screen.getByText('Wallet Connected')).toBeInTheDocument());

      // Mock backend response for /initiate-crypto-payment
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orderId: 'order_crypto_123',
          cryptoTransactionId: 'ctx_123',
          paymentDetails: { deposit_address: 'TAIC_DEPOSIT_TEST', expected_amount: 100, currency: 'TAIC', network: 'SimulatedTAIC' }
        }),
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Proceed to TAIC Payment/i }));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/initiate-crypto-payment'), expect.anything());
        expect(screen.getByText('Complete Your TAIC Payment')).toBeInTheDocument();
        expect(screen.getByText('TAIC_DEPOSIT_TEST')).toBeInTheDocument();
        expect(screen.getByDisplayValue('')).toHaveAttribute('placeholder', '0xYourTransactionHash'); // Tx hash input
      });
    });

    it('confirms crypto payment and proceeds to address form on success', async () => {
      // Setup: Connect wallet and initiate payment
      await openCryptoConnectDialog();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i })); });
      await waitFor(() => expect(screen.getByText('Wallet Connected')).toBeInTheDocument());

      (global.fetch as jest.Mock).mockResolvedValueOnce({ // For initiate
        ok: true,
        json: async () => ({
          orderId: 'order_crypto_123',
          cryptoTransactionId: 'ctx_123',
          paymentDetails: { deposit_address: 'TAIC_DEPOSIT_TEST', expected_amount: 100, currency: 'TAIC', network: 'SimulatedTAIC' }
        }),
      });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Proceed to TAIC Payment/i })); });
      await waitFor(() => expect(screen.getByText('Complete Your TAIC Payment')).toBeInTheDocument());

      // Mock backend response for /confirm-crypto-payment
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Crypto payment confirmed (Simulated).', orderId: 'order_crypto_123', status: 'confirmed' }),
      });

      // Enter transaction hash and confirm
      fireEvent.change(screen.getByPlaceholderText('0xYourTransactionHash'), { target: { value: '0xTestHash123' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Confirm Payment \(Simulated\)/i }));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/confirm-crypto-payment'), expect.anything());
        expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Crypto Payment Confirmed (Simulated)" }));
        expect(screen.getByTestId('shipping-address-form-mock')).toBeInTheDocument(); // Proceeds to address form
      });
    });

     it('handles crypto payment confirmation failure from backend', async () => {
      // Setup through initiation
      await openCryptoConnectDialog();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i })); });
      await waitFor(() => expect(screen.getByText('Wallet Connected')).toBeInTheDocument());
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orderId: 'order_crypto_123',
          cryptoTransactionId: 'ctx_123',
          paymentDetails: { deposit_address: 'TAIC_DEPOSIT_TEST', expected_amount: 100, currency: 'TAIC', network: 'SimulatedTAIC' }
        }),
      });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Proceed to TAIC Payment/i })); });
      await waitFor(() => expect(screen.getByText('Complete Your TAIC Payment')).toBeInTheDocument());

      // Mock backend failure for /confirm-crypto-payment
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Simulated verification failed.' }),
      });

      fireEvent.change(screen.getByPlaceholderText('0xYourTransactionHash'), { target: { value: '0xInvalidHash' } });
       await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Confirm Payment \(Simulated\)/i }));
      });

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Confirmation Failed", description: "Simulated verification failed.", variant: "destructive" }));
        // Stays on the same step to allow re-entry or cancellation
        expect(screen.getByText('Complete Your TAIC Payment')).toBeInTheDocument();
      });
    });
  });
});
