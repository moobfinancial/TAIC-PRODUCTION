import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartProvider, useCart } from '@/contexts/CartContext';
import userEvent from '@testing-library/user-event';

// Mock product data
const mockProduct = {
  id: '1',
  name: 'Test Product',
  price: 99.99,
  image: '/test-image.jpg',
  stock: 10,
};

// Test component that uses the cart
const TestComponent = () => {
  const { addToCart, cartItems, removeFromCart, updateQuantity } = useCart();
  
  return (
    <div>
      <button onClick={() => addToCart(mockProduct)}>Add to Cart</button>
      <button onClick={() => removeFromCart(mockProduct.id)}>Remove from Cart</button>
      <button onClick={() => updateQuantity(mockProduct.id, 2)}>Update Quantity</button>
      <div data-testid="cart-count">{cartItems.length} items</div>
      {cartItems.map(item => (
        <div key={item.id} data-testid="cart-item">
          {item.name} - {item.quantity}
        </div>
      ))}
    </div>
  );
};

describe('Cart Integration', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    queryClient = new QueryClient();
    // Clear localStorage between tests
    window.localStorage.clear();
  });

  const renderCart = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <TestComponent />
        </CartProvider>
      </QueryClientProvider>
    );
  };

  it('should add item to cart', async () => {
    const user = userEvent.setup();
    renderCart();
    
    await user.click(screen.getByText('Add to Cart'));
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1 items');
    expect(screen.getByTestId('cart-item')).toHaveTextContent('Test Product - 1');
  });

  it('should update item quantity', async () => {
    const user = userEvent.setup();
    renderCart();
    
    await user.click(screen.getByText('Add to Cart'));
    await user.click(screen.getByText('Update Quantity'));
    
    expect(screen.getByTestId('cart-item')).toHaveTextContent('Test Product - 2');
  });

  it('should remove item from cart', async () => {
    const user = userEvent.setup();
    renderCart();
    
    await user.click(screen.getByText('Add to Cart'));
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1 items');
    
    await user.click(screen.getByText('Remove from Cart'));
    expect(screen.queryByTestId('cart-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0 items');
  });
});
