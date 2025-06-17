import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CartProvider, useCart } from '@/contexts/CartContext';
import { Product } from '@/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the API calls
const mockAddToCart = jest.fn();
const mockRemoveFromCart = jest.fn();
const mockUpdateCartItem = jest.fn();
const mockClearCart = jest.fn();

jest.mock('@/api/cart', () => ({
  useAddToCart: () => ({
    mutate: mockAddToCart,
    isLoading: false,
  }),
  useRemoveFromCart: () => ({
    mutate: mockRemoveFromCart,
    isLoading: false,
  }),
  useUpdateCartItem: () => ({
    mutate: mockUpdateCartItem,
    isLoading: false,
  }),
  useClearCart: () => ({
    mutate: mockClearCart,
    isLoading: false,
  }),
}));

// Test component that uses the cart
const TestComponent = () => {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, cartTotal } = useCart();
  
  return (
    <div>
      <div data-testid="total-items">{totalItems}</div>
      <div data-testid="cart-total">{cartTotal}</div>
      <button onClick={() => addToCart({ id: '1', name: 'Test Product', price: 99.99 } as Product)}>
        Add to Cart
      </button>
      <button onClick={() => removeFromCart('1')}>Remove from Cart</button>
      <button onClick={() => updateQuantity('1', 2)}>Update Quantity</button>
      <button onClick={clearCart}>Clear Cart</button>
      
      <div data-testid="cart-items">
        {cart.items.map((item) => (
          <div key={item.product.id} data-testid={`cart-item-${item.product.id}`}>
            {item.product.name} - {item.quantity}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('CartContext', () => {
  const queryClient = new QueryClient();
  
  const renderCartContext = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <TestComponent />
        </CartProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage between tests
    window.localStorage.clear();
  });

  it('adds item to cart', async () => {
    renderCartContext();
    
    // Initial state
    expect(screen.getByTestId('total-items').textContent).toBe('0');
    
    // Add item to cart
    fireEvent.click(screen.getByText('Add to Cart'));
    
    // Check if the API was called
    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: '1',
          quantity: 1,
        })
      );
    });
    
    // Note: The actual cart update would happen after the API call succeeds
    // In a real test, you would mock the API response and test the UI updates
  });

  it('removes item from cart', async () => {
    // Set initial cart state
    const initialCart = {
      items: [
        { product: { id: '1', name: 'Test Product', price: 99.99 }, quantity: 1 }
      ]
    };
    
    // Mock the cart API response
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'cart') return JSON.stringify(initialCart);
      return null;
    });
    
    renderCartContext();
    
    // Initial state
    expect(screen.getByTestId('total-items').textContent).toBe('1');
    
    // Remove item from cart
    fireEvent.click(screen.getByText('Remove from Cart'));
    
    // Check if the API was called
    await waitFor(() => {
      expect(mockRemoveFromCart).toHaveBeenCalledWith('1');
    });
  });

  it('updates item quantity', async () => {
    // Set initial cart state
    const initialCart = {
      items: [
        { product: { id: '1', name: 'Test Product', price: 99.99 }, quantity: 1 }
      ]
    };
    
    // Mock the cart API response
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'cart') return JSON.stringify(initialCart);
      return null;
    });
    
    renderCartContext();
    
    // Update quantity
    fireEvent.click(screen.getByText('Update Quantity'));
    
    // Check if the API was called
    await waitFor(() => {
      expect(mockUpdateCartItem).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: '1',
          quantity: 2,
        })
      );
    });
  });

  it('clears the cart', async () => {
    // Set initial cart state
    const initialCart = {
      items: [
        { product: { id: '1', name: 'Test Product', price: 99.99 }, quantity: 1 }
      ]
    };
    
    // Mock the cart API response
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'cart') return JSON.stringify(initialCart);
      return null;
    });
    
    renderCartContext();
    
    // Clear cart
    fireEvent.click(screen.getByText('Clear Cart'));
    
    // Check if the API was called
    await waitFor(() => {
      expect(mockClearCart).toHaveBeenCalled();
    });
  });

  it('calculates cart total', () => {
    // Set initial cart state with multiple items
    const initialCart = {
      items: [
        { product: { id: '1', name: 'Product 1', price: 99.99 }, quantity: 2 },
        { product: { id: '2', name: 'Product 2', price: 49.99 }, quantity: 1 }
      ]
    };
    
    // Mock the cart API response
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'cart') return JSON.stringify(initialCart);
      return null;
    });
    
    renderCartContext();
    
    // Check if the total is calculated correctly
    // (99.99 * 2) + 49.99 = 249.97
    expect(screen.getByTestId('cart-total').textContent).toBe('249.97');
    expect(screen.getByTestId('total-items').textContent).toBe('3');
  });

  it('handles out of stock items', async () => {
    // Mock the API to return an error for out of stock
    mockAddToCart.mockImplementationOnce(() => {
      throw new Error('Out of stock');
    });
    
    renderCartContext();
    
    // Add item that's out of stock
    fireEvent.click(screen.getByText('Add to Cart'));
    
    // Check if the error is handled
    await waitFor(() => {
      // In a real test, you would check for an error toast or message
      expect(mockAddToCart).toHaveBeenCalled();
    });
  });
});
