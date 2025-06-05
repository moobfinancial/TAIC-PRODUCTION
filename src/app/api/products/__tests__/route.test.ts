// Imports for the test file
import { GET } from '../route'; // Adjust path as necessary
import { NextRequest } from 'next/server'; // Actual NextRequest for creating requests
import { NextResponse } from 'next/server'; // Will be mocked
import { Pool } from 'pg'; // This will now import from src/__mocks__/pg.js

// Mock next/server's NextResponse
jest.mock('next/server', () => {
  const originalModule = jest.requireActual('next/server');
  return {
    ...originalModule, // Keep other exports like NextRequest
    NextResponse: {
      json: jest.fn((body, init) => {
        // Simple mock: return an object that simulates a Response-like object
        // enough for .json() and .status to be checked in tests.
        return {
          json: async () => body, // Make it async like the real one
          status: init?.status || 200,
          headers: new Map(init?.headers), // Simulate headers
        };
      }),
    },
  };
});

// Access the mock functions from the manually mocked Pool
// These types are for better intellisense in the test file.
const mockQuery = Pool.mockQuery as jest.Mock;
const mockConnect = Pool.mockConnect as jest.Mock; // This is Pool().connect
const mockRelease = Pool.mockRelease as jest.Mock;

// No jest.mock('pg', ...) call is needed here.

describe('/api/products GET endpoint', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockQuery.mockReset();
    mockConnect.mockReset(); // Reset the connect mock (which is Pool.mockConnect)
    mockRelease.mockReset();

    // Default behavior for mocks
    mockQuery.mockResolvedValue({ rows: [] }); // Default query to return empty rows

    // Restore the default implementation for mockConnect after reset,
    // as defined in the manual mock.
    mockConnect.mockImplementation(async () => ({
      query: mockQuery,
      release: mockRelease,
    }));
  });

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/products');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  it('should return an empty array if no products match', async () => {
    const request = createMockRequest({ searchQuery: 'nonexistent' });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should return products matching searchQuery', async () => {
    const mockProducts = [
      { id: '1', name: 'Test Laptop', description: 'A great laptop', price: '1200.00', image_url: 'url1', category: 'Electronics', data_ai_hint: 'laptop' },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockProducts });

    const request = createMockRequest({ searchQuery: 'Laptop' });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ ...mockProducts[0], price: 1200.00, description: 'A great laptop', image_url: 'url1', category: 'Electronics', data_ai_hint: 'laptop' }]);
    expect(mockQuery.mock.calls[0][0]).toContain('ILIKE');
    expect(mockQuery.mock.calls[0][1]).toContain('%Laptop%');
  });

  it('should filter by category', async () => {
    const request = createMockRequest({ category: 'Electronics' });
    await GET(request);

    expect(mockQuery).toHaveBeenCalled();
    expect(mockQuery.mock.calls[0][0]).toContain('category ILIKE');
    expect(mockQuery.mock.calls[0][1]).toContain('%Electronics%');
  });

  it('should filter by minPrice and maxPrice', async () => {
    const request = createMockRequest({ minPrice: '100', maxPrice: '500' });
    await GET(request);

    expect(mockQuery).toHaveBeenCalled();
    const queryText = mockQuery.mock.calls[0][0];
    const queryValues = mockQuery.mock.calls[0][1];
    expect(queryText).toContain('price >= $');
    expect(queryText).toContain('price <= $');
    expect(queryValues).toEqual(expect.arrayContaining([100, 500]));
  });

  it('should use default limit and offset if not provided', async () => {
    const request = createMockRequest({});
    await GET(request);

    expect(mockQuery).toHaveBeenCalled();
    const queryText = mockQuery.mock.calls[0][0];
    const queryValues = mockQuery.mock.calls[0][1];
    expect(queryText).toContain('LIMIT $1 OFFSET $2'); // Assuming no other params, indices are 1 and 2
    expect(queryValues).toEqual(expect.arrayContaining([10, 0]));
  });

  it('should use provided limit and offset', async () => {
    const request = createMockRequest({ limit: '5', offset: '10' });
    await GET(request);

    expect(mockQuery).toHaveBeenCalled();
    const queryText = mockQuery.mock.calls[0][0];
    const queryValues = mockQuery.mock.calls[0][1];
    expect(queryText).toContain('LIMIT $');
    expect(queryText).toContain('OFFSET $');
    expect(queryValues).toEqual(expect.arrayContaining([5, 10]));
  });

  it('should handle invalid query parameters', async () => {
    const request = createMockRequest({ limit: 'abc' }); // Invalid limit
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid query parameters');
    expect(body.details.fieldErrors.limit).toBeDefined();
  });

  it('should handle database query errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB Error'));
    const request = createMockRequest({ searchQuery: 'test' });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
    expect(body.details).toBe('DB Error');
  });

  it('should correctly parse float price from string db value', async () => {
    const mockProductsDb = [
      { id: '1', name: 'Product A', price: '29.99', image_url: null, category: null, data_ai_hint: null, description: null },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockProductsDb });
    const request = createMockRequest({});
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body[0].price).toBe(29.99);
    expect(typeof body[0].price).toBe('number');
  });

  // Test with multiple filters
  it('should filter by searchQuery and category and price range', async () => {
    const request = createMockRequest({
      searchQuery: 'gadget',
      category: 'Tech',
      minPrice: '50',
      maxPrice: '150'
    });
    await GET(request);

    expect(mockQuery).toHaveBeenCalled();
    const queryText = mockQuery.mock.calls[0][0];
    const queryValues = mockQuery.mock.calls[0][1];

    expect(queryText).toContain('ILIKE $1'); // searchQuery
    expect(queryText).toContain('category ILIKE $2'); // category
    expect(queryText).toContain('price >= $3'); // minPrice
    expect(queryText).toContain('price <= $4'); // maxPrice

    expect(queryValues).toEqual(expect.arrayContaining([
      '%gadget%',
      '%Tech%',
      50,
      150
    ]));
  });
});
