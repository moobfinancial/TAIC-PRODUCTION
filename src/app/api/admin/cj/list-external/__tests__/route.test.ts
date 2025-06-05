import { GET } from '../route'; // Adjust path
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server'; // For mocking

// Mock next/server's NextResponse
jest.mock('next/server', () => {
  const originalModule = jest.requireActual('next/server');
  return {
    ...originalModule,
    NextResponse: {
      json: jest.fn((body, init) => ({
        json: async () => body,
        status: init?.status || 200,
        headers: new Map(init?.headers),
        ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
      })),
    },
  };
});

// Mock global fetch
global.fetch = jest.fn();

describe('/api/admin/cj/list-external', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Clears module cache, useful if route module has global state or memoization
    process.env = { ...originalEnv, CJ_API_KEY: 'test-cj-api-key' };
    (global.fetch as jest.Mock).mockClear();
    (NextResponse.json as jest.Mock).mockClear();
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original environment variables
  });

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/admin/cj/list-external');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  it('should return products from CJ API successfully', async () => {
    const mockCjData = {
      result: true,
      code: "200",
      message: "Success",
      data: { list: [{ pid: '123', productNameEn: 'Test Product' }], total: 1 }
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCjData,
    });

    const request = createMockRequest({ keyword: 'Test', page: '1', limit: '10' });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockCjData.data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://developers.cjdropshipping.com/api2.0/v1/product/list?pageNum=1&pageSize=10&productNameEn=Test'),
      expect.objectContaining({
        headers: {
          'CJ-Access-Token': 'test-cj-api-key',
          'Content-Type': 'application/json', // Ensure this matches what's sent
        }
      })
    );
  });

  it('should handle CJ API error response', async () => {
    const mockCjError = { result: false, code: "400", message: "Bad request" };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, // HTTP response itself is ok, but CJ API reports error in body
      json: async () => mockCjError,
    });

    const request = createMockRequest({ keyword: 'ErrorProne' });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(422); // Unprocessable Entity due to CJ's error
    expect(body.error).toContain('CJ API request failed');
    expect(body.details.message).toBe('Bad request');
  });

  it('should handle fetch network failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

    const request = createMockRequest({ keyword: 'NetworkFail' });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to list products from CJ Dropshipping.');
  });

  it('should return 500 if CJ_API_KEY is not configured', async () => {
    delete process.env.CJ_API_KEY; // Simulate missing API key
    const request = createMockRequest();
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('CJ API key is not configured. Please contact administrator.');
  });

  it('should handle invalid query parameters', async () => {
    const request = createMockRequest({ limit: 'abc' }); // Invalid limit
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid query parameters');
  });
});
