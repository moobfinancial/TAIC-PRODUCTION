import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { SearchPage } from '@/pages/SearchPage';
import { useSearchProducts } from '@/api/products';

// Mock the API
jest.mock('@/api/products', () => ({
  useSearchProducts: jest.fn(),
}));

const mockProducts = [
  {
    id: '1',
    name: 'Wireless Headphones',
    price: 99.99,
    imageUrl: '/images/headphones.jpg',
    rating: 4.5,
    reviewCount: 128,
  },
  {
    id: '2',
    name: 'Bluetooth Speaker',
    price: 79.99,
    imageUrl: '/images/speaker.jpg',
    rating: 4.2,
    reviewCount: 86,
  },
];

describe('Search Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderSearchPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SearchPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock the search hook
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: { items: mockProducts, total: 2, page: 1, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('renders search input and filters', () => {
    renderSearchPage();
    
    // Check if search input is rendered
    expect(screen.getByPlaceholderText('Search for products...')).toBeInTheDocument();
    
    // Check if filter buttons are rendered
    expect(screen.getByText('All Categories')).toBeInTheDocument();
    expect(screen.getByText('Price Range')).toBeInTheDocument();
    expect(screen.getByText('Sort By')).toBeInTheDocument();
  });

  it('displays search results', async () => {
    renderSearchPage();
    
    // Check if products are displayed
    expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
    expect(screen.getByText('Bluetooth Speaker')).toBeInTheDocument();
    
    // Check if prices are displayed
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByText('$79.99')).toBeInTheDocument();
    
    // Check if ratings are displayed
    expect(screen.getByText('4.5 (128)')).toBeInTheDocument();
    expect(screen.getByText('4.2 (86)')).toBeInTheDocument();
  });

  it('allows searching for products', async () => {
    const mockRefetch = jest.fn();
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: { items: mockProducts, total: 2 },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    
    renderSearchPage();
    
    // Type in search input
    const searchInput = screen.getByPlaceholderText('Search for products...');
    fireEvent.change(searchInput, { target: { value: 'headphones' } });
    
    // Submit the search
    fireEvent.submit(screen.getByRole('search'));
    
    // Check if refetch was called with the search query
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('filters products by category', async () => {
    const mockRefetch = jest.fn();
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: { items: [mockProducts[0]], total: 1 }, // Only return headphones
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    
    renderSearchPage();
    
    // Open category filter
    fireEvent.click(screen.getByText('All Categories'));
    
    // Select Electronics category
    fireEvent.click(screen.getByLabelText('Electronics'));
    
    // Check if refetch was called with category filter
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledWith({
        category: 'electronics',
      });
    });
    
    // Check if only filtered products are shown
    expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
    expect(screen.queryByText('Bluetooth Speaker')).not.toBeInTheDocument();
  });

  it('sorts products', async () => {
    const mockRefetch = jest.fn();
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: { 
        items: [...mockProducts].sort((a, b) => b.price - a.price), // Sort by price desc
        total: 2 
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    
    renderSearchPage();
    
    // Open sort dropdown
    fireEvent.click(screen.getByText('Sort By'));
    
    // Select Price: High to Low
    fireEvent.click(screen.getByText('Price: High to Low'));
    
    // Check if refetch was called with sort parameters
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledWith({
        sortBy: 'price',
        sortOrder: 'desc',
      });
    });
    
    // Check if products are sorted correctly
    const prices = screen.getAllByText(/\$\d+\.\d{2}/);
    expect(prices[0].textContent).toBe('$99.99');
    expect(prices[1].textContent).toBe('$79.99');
  });

  it('shows loading state', () => {
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    
    renderSearchPage();
    
    // Check if loading skeleton is shown
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('handles no results', () => {
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    
    renderSearchPage();
    
    // Check if no results message is shown
    expect(screen.getByText('No products found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filter to find what you\'re looking for.')).toBeInTheDocument();
  });

  it('handles errors', () => {
    const errorMessage = 'Failed to load products';
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: errorMessage },
      refetch: jest.fn(),
    });
    
    renderSearchPage();
    
    // Check if error message is shown
    expect(screen.getByText('Error loading products')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    
    // Check if retry button is shown
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    
    // Test retry functionality
    const mockRefetch = jest.fn();
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: errorMessage },
      refetch: mockRefetch,
    });
    
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('navigates to product detail page', () => {
    renderSearchPage();
    
    // Click on a product
    fireEvent.click(screen.getByText('Wireless Headphones'));
    
    // Check if navigation occurred (in a real test, this would be verified with React Router's test utilities)
    // This is a simplified example
    expect(window.location.pathname).toBe('/products/1');
  });

  it('updates URL when search parameters change', async () => {
    renderSearchPage();
    
    // Type in search input
    const searchInput = screen.getByPlaceholderText('Search for products...');
    fireEvent.change(searchInput, { target: { value: 'speaker' } });
    
    // Submit the search
    fireEvent.submit(screen.getByRole('search'));
    
    // Check if URL was updated
    await waitFor(() => {
      expect(window.location.search).toContain('q=speaker');
    });
    
    // Test category filter
    fireEvent.click(screen.getByText('All Categories'));
    fireEvent.click(screen.getByLabelText('Electronics'));
    
    // Check if URL was updated with category
    await waitFor(() => {
      expect(window.location.search).toContain('category=electronics');
    });
  });

  it('applies price range filter', async () => {
    const mockRefetch = jest.fn();
    (useSearchProducts as jest.Mock).mockReturnValue({
      data: { items: [mockProducts[1]], total: 1 }, // Only speaker in this price range
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    
    renderSearchPage();
    
    // Open price range filter
    fireEvent.click(screen.getByText('Price Range'));
    
    // Set price range
    const minPriceInput = screen.getByLabelText('Min Price');
    const maxPriceInput = screen.getByLabelText('Max Price');
    
    fireEvent.change(minPriceInput, { target: { value: '50' } });
    fireEvent.change(maxPriceInput, { target: { value: '100' } });
    
    // Apply filter
    fireEvent.click(screen.getByText('Apply'));
    
    // Check if refetch was called with price range
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledWith({
        minPrice: 50,
        maxPrice: 100,
      });
    });
    
    // Check if only products in price range are shown
    expect(screen.queryByText('Wireless Headphones')).not.toBeInTheDocument();
    expect(screen.getByText('Bluetooth Speaker')).toBeInTheDocument();
  });
});
