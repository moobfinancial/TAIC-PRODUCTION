import { POST } from '../route'; // Adjust path
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server'; // For mocking
import { Pool } from 'pg'; // Will use the mock from src/__mocks__/pg.js

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

// Mock pg
const { mockQuery, mockConnect, mockRelease } = Pool;

// Mock global fetch
global.fetch = jest.fn();

describe('/api/admin/cj/import-product', () => {
  const originalEnv = process.env;
  const validImportPayload = {
    cjProductId: 'cj123',
    platform_category_id: 1,
    selling_price: 99.99,
    display_name: 'Awesome CJ Product',
    display_description: 'A very cool product from CJ.',
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, CJ_API_KEY: 'test-cj-api-key' };
    (global.fetch as jest.Mock).mockClear();
    (NextResponse.json as jest.Mock).mockClear();
    mockQuery.mockReset();
    mockConnect.mockReset().mockImplementation(async () => ({ // Ensure connect mock is restored
      query: mockQuery,
      release: mockRelease,
    }));
    mockRelease.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (body: any) => {
    return new NextRequest('http://localhost/api/admin/cj/import-product', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  it('should successfully import a product', async () => {
    const mockCjProductDetail = {
      productNameEn: 'CJ Test Product Name',
      description: 'CJ Description',
      productImage: 'http://example.com/cj_image.jpg',
      productImages: ['http://example.com/cj_image.jpg', 'http://example.com/cj_image2.jpg'],
      sellPrice: '50.00', // This is cj_base_price
      productSkuList: [{ sku: 'SKU1', variantValue: 'Red' }],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: true, code: "200", data: [mockCjProductDetail] }), // data is an array
    });

    const mockDbInsertResult = { platform_product_id: 101, display_name: validImportPayload.display_name };
    mockQuery.mockResolvedValueOnce({ rows: [mockDbInsertResult] });

    const request = createMockRequest(validImportPayload);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.message).toBe('Product imported successfully.');
    expect(body.platformProduct).toEqual(mockDbInsertResult);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${validImportPayload.cjProductId}`,
      expect.anything()
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cj_products'),
      expect.arrayContaining([
        validImportPayload.cjProductId,
        mockCjProductDetail, // cj_product_data_json
        validImportPayload.display_name,
        validImportPayload.display_description,
        validImportPayload.platform_category_id,
        validImportPayload.selling_price,
        50.00, // cj_base_price (parsed from sellPrice)
        mockCjProductDetail.productImage, // image_url
        JSON.stringify(['http://example.com/cj_image2.jpg']), // additional_image_urls_json
        JSON.stringify(mockCjProductDetail.productSkuList), // variants_json
        false, // is_active
        'CJ'   // source
      ])
    );
  });

  it('should return 400 for invalid input data', async () => {
    const request = createMockRequest({ cjProductId: '123' }); // Missing required fields
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('should handle CJ API returning an error for product details', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, // HTTP ok, but API error in body
      json: async () => ({ result: false, code: "404", message: "Product not found" }),
    });
    const request = createMockRequest(validImportPayload);
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(422); // Or 404 if specific
    expect(body.error).toContain('CJ API request for product details failed or product not found');
  });

  it('should handle product already imported (unique constraint violation)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ // Mock successful CJ fetch
      ok: true,
      json: async () => ({ result: true, code: "200", data: [{ productNameEn: 'Test' }] }),
    });
    mockQuery.mockRejectedValueOnce({ code: '23505' }); // Simulate unique violation

    const request = createMockRequest(validImportPayload);
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toBe('Product already imported.');
  });

  it('should handle non-existent platform_category_id (foreign key violation)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ // Mock successful CJ fetch
      ok: true,
      json: async () => ({ result: true, code: "200", data: [{ productNameEn: 'Test' }] }),
    });
    mockQuery.mockRejectedValueOnce({ code: '23503' }); // Simulate FK violation

    const request = createMockRequest({ ...validImportPayload, platform_category_id: 9999 });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400); // As mapped in route
    expect(body.error).toBe('Invalid platform_category_id.');
  });

   it('should return 500 if CJ_API_KEY is not configured', async () => {
    delete process.env.CJ_API_KEY;
    const request = createMockRequest(validImportPayload);
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe('CJ API key is not configured.');
  });
});
