import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StripePaymentFormWrapper from '../StripePaymentForm'; // The wrapper component

// Mock Stripe hooks and components
const mockStripe = {
  confirmCardPayment: jest.fn(),
};
const mockElements = {
  getElement: jest.fn(),
};
const mockCardElement = {
  destroy: jest.fn(), // Mock if CardElement's cleanup is ever called directly in tests
};

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, // Pass children through
  CardElement: () => <div data-testid="card-element" />, // Mocked CardElement component
  useStripe: () => mockStripe,
  useElements: () => mockElements,
}));

// Mock loadStripe from @stripe/stripe-js
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn().mockResolvedValue({
    // Mock any methods you might call on the stripe object returned by loadStripe, if any
    // For example, if StripePaymentForm directly used methods from the main stripe object
  }),
}));


global.fetch = jest.fn(); // Mock global fetch

describe('StripePaymentFormWrapper', () => {
  const mockOnPaymentSuccess = jest.fn();
  const mockOnPaymentError = jest.fn();
  const mockOnCancel = jest.fn();
  const totalAmount = 100; // Assuming TAIC, will be 10000 cents for USD

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mock getElement to return our mockCardElement
    mockElements.getElement.mockReturnValue(mockCardElement);
    // Reset fetch mock for each test
    (global.fetch as jest.Mock).mockReset();
  });

  it('renders the card element and pay button', () => {
    render(
      <StripePaymentFormWrapper
        onPaymentSuccess={mockOnPaymentSuccess}
        onPaymentError={mockOnPaymentError}
        onCancel={mockOnCancel}
        totalAmount={totalAmount}
        currency="USD"
      />
    );
    expect(screen.getByText('Card Details')).toBeInTheDocument();
    expect(screen.getByTestId('card-element')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Pay ${totalAmount.toLocaleString()} USD` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls create-payment-intent and stripe.confirmCardPayment on submit, then onPaymentSuccess', async () => {
    // Mock successful API responses
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ clientSecret: 'test_client_secret', orderId: '123' }),
    });
    mockStripe.confirmCardPayment.mockResolvedValueOnce({
      paymentIntent: { id: 'pi_123', status: 'succeeded' },
      error: null,
    });

    render(
      <StripePaymentFormWrapper
        onPaymentSuccess={mockOnPaymentSuccess}
        onPaymentError={mockOnPaymentError}
        onCancel={mockOnCancel}
        totalAmount={totalAmount}
        currency="USD"
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: `Pay ${totalAmount.toLocaleString()} USD` }));

    // Wait for create-payment-intent call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_PAYMENT_API_URL || 'http://localhost:5000'}/create-payment-intent`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: totalAmount * 100, currency: 'USD' }), // amount in cents
        })
      );
    });

    // Wait for confirmCardPayment call
    await waitFor(() => {
      expect(mockStripe.confirmCardPayment).toHaveBeenCalledWith(
        'test_client_secret',
        expect.objectContaining({
          payment_method: { card: mockCardElement },
        })
      );
    });

    // Wait for success callback
    await waitFor(() => {
      expect(mockOnPaymentSuccess).toHaveBeenCalledWith('pi_123');
    });
    expect(mockOnPaymentError).not.toHaveBeenCalled();
  });

  it('handles create-payment-intent API failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'API Error Intent' }),
    });

    render(
      <StripePaymentFormWrapper
        onPaymentSuccess={mockOnPaymentSuccess}
        onPaymentError={mockOnPaymentError}
        onCancel={mockOnCancel}
        totalAmount={totalAmount}
        currency="USD"
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: `Pay ${totalAmount.toLocaleString()} USD` }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockOnPaymentError).toHaveBeenCalledWith('API Error Intent');
    });
    expect(mockStripe.confirmCardPayment).not.toHaveBeenCalled();
    expect(mockOnPaymentSuccess).not.toHaveBeenCalled();
  });

  it('handles stripe.confirmCardPayment failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ clientSecret: 'test_client_secret' }),
    });
    mockStripe.confirmCardPayment.mockResolvedValueOnce({
      error: { message: 'Stripe Card Error' },
    });

    render(
      <StripePaymentFormWrapper
        onPaymentSuccess={mockOnPaymentSuccess}
        onPaymentError={mockOnPaymentError}
        onCancel={mockOnCancel}
        totalAmount={totalAmount}
        currency="USD"
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: `Pay ${totalAmount.toLocaleString()} USD` }));

    await waitFor(() => {
      expect(mockStripe.confirmCardPayment).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockOnPaymentError).toHaveBeenCalledWith('Stripe Card Error');
    });
    expect(mockOnPaymentSuccess).not.toHaveBeenCalled();
  });

  it('disables pay button while loading', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ clientSecret: 'test_client_secret' }),
      }), 100)) // delay to keep it in loading state
    );
     mockStripe.confirmCardPayment.mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({
        paymentIntent: { id: 'pi_123', status: 'succeeded' },
      }), 100))
    );

    render(
      <StripePaymentFormWrapper
        onPaymentSuccess={mockOnPaymentSuccess}
        onPaymentError={mockOnPaymentError}
        onCancel={mockOnCancel}
        totalAmount={totalAmount}
        currency="USD"
      />
    );

    const payButton = screen.getByRole('button', { name: `Pay ${totalAmount.toLocaleString()} USD` });
    fireEvent.submit(payButton);

    await waitFor(() => {
        expect(payButton).toBeDisabled();
        expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    // Wait for all async operations to complete to avoid state update after unmount
    await waitFor(() => expect(mockOnPaymentSuccess).toHaveBeenCalledTimes(1));
    expect(payButton).not.toBeDisabled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <StripePaymentFormWrapper
        onPaymentSuccess={mockOnPaymentSuccess}
        onPaymentError={mockOnPaymentError}
        onCancel={mockOnCancel}
        totalAmount={totalAmount}
        currency="USD"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('shows an error if stripe or elements are not loaded', async () => {
    // Temporarily set useStripe or useElements to return null
    const actualStripeJs = jest.requireActual('@stripe/react-stripe-js');
    const useStripeSpy = jest.spyOn(actualStripeJs, 'useStripe').mockReturnValueOnce(null);
    const useElementsSpy = jest.spyOn(actualStripeJs, 'useElements').mockReturnValueOnce(null); // Also mock useElements

    render(
      <StripePaymentFormWrapper
        onPaymentSuccess={mockOnPaymentSuccess}
        onPaymentError={mockOnPaymentError}
        onCancel={mockOnCancel}
        totalAmount={totalAmount}
        currency="USD"
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: `Pay ${totalAmount.toLocaleString()} USD` }));

    await waitFor(() => {
      expect(screen.getByText('Stripe.js has not loaded yet. Please wait a moment and try again.')).toBeInTheDocument();
    });
    expect(mockOnPaymentError).toHaveBeenCalledWith('Stripe.js has not loaded yet. Please wait a moment and try again.');

    // Restore
    useStripeSpy.mockRestore();
    useElementsSpy.mockRestore();
  });

});
