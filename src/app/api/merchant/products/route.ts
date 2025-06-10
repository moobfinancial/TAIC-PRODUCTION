import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { z } from 'zod';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { v4 as uuidv4 } from 'uuid';

// Schema for creating a new product (fields mapped to 'products' table)
const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  imageUrl: z.string().min(1, 'Image URL is required'),
  // platform_category_id will be derived from this
  categoryId: z.string().optional().nullable(), 
  // Fields like basePrice, additionalImages, stockQuantity, cashbackConfig are not in the 'products' table yet.
  // The 'isActive' field from input is ignored; new products are set to is_active=false, approval_status='pending'.
});

// GET handler to list merchant's products from the 'products' table
async function getProducts(req: NextRequest, merchantUser: any) { // Renamed user to merchantUser
  try {
    // Get query parameters for pagination
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Get products for this merchant from the 'products' table
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, 
              p.platform_category_id, c.name as category_name, 
              p.approval_status, p.is_active, p.created_at, p.updated_at
       FROM products p
       LEFT JOIN categories c ON p.platform_category_id = c.id
       WHERE p.merchant_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [merchantUser.id, limit, offset]
    );
    
    // Get total count for pagination from the 'products' table
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM products WHERE merchant_id = $1',
      [merchantUser.id]
    );
    
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);
    
    // Format the response
    const productsResponse = result.rows.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price),
      imageUrl: product.image_url,
      platformCategoryId: product.platform_category_id,
      categoryName: product.category_name, // from the JOIN
      approvalStatus: product.approval_status,
      isActive: product.is_active,
      createdAt: product.created_at,
      updatedAt: product.updated_at
      // Fields like basePrice, additionalImages, stockQuantity, cashbackConfig are not in this response as they are not in 'products' table yet
    }));
    
    return NextResponse.json({
      products: productsResponse, // Use the new variable name
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
async function createProduct(req: NextRequest, merchantUser: any) { // Renamed user to merchantUser for clarity
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
      imageUrl,
      categoryId
      // basePrice, additionalImages, stockQuantity, cashbackConfig, isActive are handled differently or not used for 'products' table
    } = validationResult.data;
    
    const newProductId = uuidv4();
    const platformCategoryId = categoryId ? parseInt(categoryId, 10) : null;

    const result = await pool.query(
      `INSERT INTO products (
        id,
        name,
        description,
        price,
        image_url,
        platform_category_id,
        merchant_id,
        approval_status,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, description, price, approval_status, is_active, created_at`,
      [
        newProductId,
        name,
        description,
        price,
        imageUrl,
        platformCategoryId,
        merchantUser.id, // Use merchantUser.id here
        'pending',       // Default approval_status
        false            // Default is_active
      ]
    );
    
    const newProduct = result.rows[0];
    
    return NextResponse.json({
      id: newProduct.id,
      name: newProduct.name,
      description: newProduct.description,
      price: parseFloat(newProduct.price),
      approvalStatus: newProduct.approval_status,
      isActive: newProduct.is_active,
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
