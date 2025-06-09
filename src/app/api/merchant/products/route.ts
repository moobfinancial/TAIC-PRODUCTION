import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { z } from 'zod';
import { withMerchantAuth } from '@/lib/merchantAuth';

// Schema for creating a new product
const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  basePrice: z.number().positive('Base price must be positive').optional(),
  imageUrl: z.string().min(1, 'Image URL is required'), // Allow relative paths too if needed, or keep .url() if only absolute
  additionalImages: z.array(z.string().url()).optional(),
  // categoryId from form is string, allow empty for 'no category', parse to int in backend if not null
  categoryId: z.string().optional().nullable(),
  stockQuantity: z.number().int().nonnegative('Stock quantity must be a non-negative integer'),
  cashbackConfig: z.object({
    type: z.enum(['percentage', 'fixed']),
    value: z.number().positive(),
  }).optional(),
  isActive: z.boolean().optional(),
});

// GET handler to list merchant's products
async function getProducts(req: NextRequest, user: any) {
  try {
    // Get query parameters for pagination
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Get products for this merchant
    const result = await pool.query(
      `SELECT p.*, c.name as category_name
       FROM merchant_products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.merchant_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );
    
    // Get total count for pagination
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM merchant_products WHERE merchant_id = $1',
      [user.id]
    );
    
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);
    
    // Format the response
    const products = result.rows.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price),
      basePrice: product.base_price ? parseFloat(product.base_price) : undefined,
      imageUrl: product.image_url,
      additionalImages: product.additional_images,
      categoryId: product.category_id,
      categoryName: product.category_name,
      stockQuantity: product.stock_quantity,
      cashbackConfig: product.cashback_config,
      isActive: product.is_active,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    }));
    
    return NextResponse.json({
      products,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching merchant products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST handler to create a new product
async function createProduct(req: NextRequest, user: any) {
  try {
    // Parse request body
    const body = await req.json();
    
    // Validate input
    const validationResult = createProductSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const {
      name,
      description,
      price,
      basePrice,
      imageUrl,
      additionalImages,
      categoryId,
      stockQuantity,
      cashbackConfig,
      isActive = true
    } = validationResult.data;
    
    // Insert the new product
    const result = await pool.query(
      `INSERT INTO merchant_products (
        merchant_id,
        name,
        description,
        price,
        base_price,
        image_url,
        additional_images,
        category_id,
        stock_quantity,
        cashback_config,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, name, description, price, created_at`,
      [
        user.id,
        name,
        description,
        price,
        basePrice || null,
        imageUrl,
        additionalImages ? JSON.stringify(additionalImages) : null,
        categoryId || null,
        stockQuantity,
        cashbackConfig ? JSON.stringify(cashbackConfig) : null,
        isActive
      ]
    );
    
    const newProduct = result.rows[0];
    
    return NextResponse.json({
      id: newProduct.id,
      name: newProduct.name,
      description: newProduct.description,
      price: parseFloat(newProduct.price),
      createdAt: newProduct.created_at
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// Export the handlers with merchant authentication
export const GET = withMerchantAuth(getProducts);
export const POST = withMerchantAuth(createProduct);
