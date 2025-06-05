import { GET, POST } from '../route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
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

const { mockQuery, mockConnect, mockRelease } = Pool;

describe('/api/admin/categories', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockConnect.mockReset();
    mockRelease.mockReset();
    // Default implementation for connect
    mockConnect.mockImplementation(async () => ({
      query: mockQuery,
      release: mockRelease,
    }));
  });

  // --- GET /api/admin/categories ---
  describe('GET', () => {
    it('should fetch categories as a flat list by default', async () => {
      const mockCategories = [
        { id: 1, name: 'Electronics', description: null, parent_category_id: null },
        { id: 2, name: 'Books', description: 'All kinds of books', parent_category_id: null },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockCategories });

      const request = new NextRequest('http://localhost/api/admin/categories');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockCategories);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ORDER BY name ASC')); // Removed undefined
    });

    it('should fetch categories hierarchically when hierarchical=true', async () => {
      const mockCategoriesFlat = [
        { id: 4, name: 'Books', description: null, parent_category_id: null, created_at: new Date(), updated_at: new Date() }, // Sorted by name
        { id: 1, name: 'Electronics', description: null, parent_category_id: null, created_at: new Date(), updated_at: new Date() },
        { id: 2, name: 'Laptops', description: null, parent_category_id: 1, created_at: new Date(), updated_at: new Date() },
        { id: 3, name: 'Mobile Phones', description: null, parent_category_id: 1, created_at: new Date(), updated_at: new Date() },
      ];
      // Ensure the mock returns rows with all fields selected by the query for buildCategoryTree
      const dbRows = mockCategoriesFlat.map(c => ({...c, children: undefined })); // remove children for db mock
      mockQuery.mockResolvedValueOnce({ rows: dbRows });


      const request = new NextRequest('http://localhost/api/admin/categories?hierarchical=true');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      // Expected output should be sorted: Books, then Electronics (with its children sorted by name if they were not already)
      expect(body).toEqual([
        expect.objectContaining({ id: 4, name: 'Books', parent_category_id: null, children: [] }),
        expect.objectContaining({
          id: 1, name: 'Electronics', parent_category_id: null,
          children: expect.arrayContaining([
            expect.objectContaining({ id: 2, name: 'Laptops', parent_category_id: 1, children: [] }),
            expect.objectContaining({ id: 3, name: 'Mobile Phones', parent_category_id: 1, children: [] }),
          ])
        }),
      ]);
      // Check children length for Electronics to ensure only direct children are included and sorted
      const electronicsCat = body.find((c:any) => c.id === 1);
      expect(electronicsCat.children).toHaveLength(2);
      // Optional: check order of children if important, e.g. Laptops before Mobile Phones
      // This depends on how buildCategoryTree sorts or if the input 'dbRows' is presorted meaningfully beyond just name for parent level.
      // The SQL query `ORDER BY name ASC` applies to the flat list. `buildCategoryTree` itself doesn't re-sort children currently.
      // For simplicity, `arrayContaining` is used for children.
    });

    it('should return empty array if no categories exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const request = new NextRequest('http://localhost/api/admin/categories');
      const response = await GET(request);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toEqual([]);
    });

    it('should handle database errors during GET', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Read Error'));
      const request = new NextRequest('http://localhost/api/admin/categories');
      const response = await GET(request);
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch categories');
    });
  });

  // --- POST /api/admin/categories ---
  describe('POST', () => {
    it('should create a new top-level category successfully', async () => {
      const newCategoryData = { name: 'Apparel', description: 'Clothing items' };
      const mockCreatedCategory = { id: 3, ...newCategoryData, parent_category_id: null };
      mockQuery.mockResolvedValueOnce({ rows: [mockCreatedCategory] });

      const request = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(newCategoryData),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual(mockCreatedCategory);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        [newCategoryData.name, newCategoryData.description || null, null]
      );
    });

    it('should create a new sub-category successfully', async () => {
      const newSubCategoryData = { name: 'Shirts', parent_category_id: 1 };
      const mockCreatedSubCategory = { id: 4, ...newSubCategoryData, description: null };

      // Mock for parent category check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // Mock for INSERT
      mockQuery.mockResolvedValueOnce({ rows: [mockCreatedSubCategory] });

      const request = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(newSubCategoryData),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual(mockCreatedSubCategory);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM categories WHERE id = $1', [1]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        [newSubCategoryData.name, null, newSubCategoryData.parent_category_id]
      );
    });

    it('should return 400 for missing category name', async () => {
      const request = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ description: 'No name' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid input');
    });

    it('should return 400 for invalid parent_category_id (non-existent)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Simulate parent not found
      const request = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sub', parent_category_id: 999 }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toContain('Parent category does not exist');
    });

    it('should return 409 for unique constraint violation (category name exists)', async () => {
      mockQuery.mockRejectedValueOnce({ code: '23505', detail: 'Key (name)=(Electronics) already exists.' });
      const request = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'Electronics' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const body = await response.json();
      expect(response.status).toBe(409);
      expect(body.error).toBe('Category name already exists.');
    });
  });
});
