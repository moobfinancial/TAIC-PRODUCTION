import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { z } from 'zod';
import { withMerchantAuth } from '@/lib/merchantAuth';

// Schema for updating a product
const updateProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(255).optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').optional(),
  price: z.number().positive('Price must be positive').optional(),
  basePrice: z.number().positive('Base price must be positive').optional(),
  // Accept any non-empty string for imageUrl (including local paths starting with /uploads/)
  imageUrl: z.string().min(1, 'Image URL is required').optional(),
  additionalImages: z.array(z.string().url()).optional(), // Ensuring URLs if array is provided
  // categoryId from form is string, allow empty/null for 'no category', parse to int in backend if not null
  categoryId: z.string().optional().nullable(),
  stockQuantity: z.number().int().nonnegative('Stock quantity must be a non-negative integer').optional(),
  cashbackConfig: z.object({
    type: z.enum(['percentage', 'fixed']),
    value: z.number().positive(),
  }).optional(),
  isActive: z.boolean().optional(),
});

// GET handler to fetch a specific product
async function getProduct(req: NextRequest, user: any, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;
    
    // Check if product exists and belongs to this merchant
    const result = await pool.query(
      `SELECT p.*, c.name as category_name
       FROM merchant_products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.merchant_id = $2`,
      [productId, user.id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    const product = result.rows[0];
    
    // Format the response
    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT handler to update a specific product
async function updateProduct(req: NextRequest, user: any, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;
    
    // Check if product exists and belongs to this merchant
    const checkResult = await pool.query(
      'SELECT id FROM merchant_products WHERE id = $1 AND merchant_id = $2',
      [productId, user.id]
    );
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Product not found or you do not have permission to update it' },
        { status: 404 }
      );
    }
    
    // Parse request body
    const body = await req.json();
    
    // Validate input
    const validationResult = updateProductSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    // Extract validated data
    const data = validationResult.data;
    
    // Build the SET clause and values array for the SQL query
    const updates: string[] = [];
    const values = [productId, user.id];
    let valueIndex = 3;
    
    if (data.name !== undefined) {
      updates.push(`name = $${valueIndex++}`);
      values.push(data.name);
    }
    
    if (data.description !== undefined) {
      updates.push(`description = $${valueIndex++}`);
      values.push(data.description);
    }
    
    if (data.price !== undefined) {
      updates.push(`price = $${valueIndex++}`);
      values.push(data.price.toString()); // Convert to string for PostgreSQL
    }
    
    if (data.basePrice !== undefined) {
      updates.push(`base_price = $${valueIndex++}`);
      values.push(data.basePrice.toString()); // Convert to string for PostgreSQL
    }
    
    if (data.imageUrl !== undefined) {
      updates.push(`image_url = $${valueIndex++}`);
      values.push(data.imageUrl);
    }
    
    if (data.additionalImages !== undefined) {
      updates.push(`additional_images = $${valueIndex++}`);
      values.push(data.additionalImages);
    }
    
    // Handle categoryId - explicitly set to NULL if null/empty
    if (data.categoryId !== undefined) {
      if (data.categoryId === null || data.categoryId === '') {
        updates.push(`category_id = NULL`);
      } else {
        updates.push(`category_id = $${valueIndex++}`);
        values.push(data.categoryId);
      }
    }
    
    if (data.stockQuantity !== undefined) {
      updates.push(`stock_quantity = $${valueIndex++}`);
      values.push(data.stockQuantity.toString()); // Convert to string for PostgreSQL
    }
    
    // Handle cashbackConfig - explicitly set to NULL if null
    if (data.cashbackConfig !== undefined) {
      if (data.cashbackConfig === null) {
        updates.push(`cashback_config = NULL`);
      } else {
        updates.push(`cashback_config = $${valueIndex++}`);
        values.push(JSON.stringify(data.cashbackConfig)); // Convert object to JSON string
      }
    }
    
    if (data.isActive !== undefined) {
      updates.push(`is_active = $${valueIndex++}`);
      values.push(data.isActive.toString()); // Convert to string for PostgreSQL
    }
    
    // If no fields to update, return early
    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }
    
    // Execute the update query
    const updateQuery = `
      UPDATE merchant_products
      SET ${updates.join(', ')}
      WHERE id = $1 AND merchant_id = $2
      RETURNING id, name, description, price, updated_at
    `;
    
    console.log('Update query:', updateQuery);
    console.log('Update values:', values);
    
    try {
      const result = await pool.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        console.error('No rows returned after update');
        return NextResponse.json(
          { error: 'Failed to update product - no rows returned' },
          { status: 500 }
        );
      }
      
      const updatedProduct = result.rows[0];
      
      return NextResponse.json({
        id: updatedProduct.id,
        name: updatedProduct.name,
        description: updatedProduct.description,
        price: parseFloat(updatedProduct.price),
        updatedAt: updatedProduct.updated_at,
        message: 'Product updated successfully'
      });
    } catch (dbError: unknown) {
      console.error('Database error during product update:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      return NextResponse.json(
        { error: 'Database error during product update', details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update product', 
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    );
  }
}

// DELETE handler to remove a specific product
async function deleteProduct(req: NextRequest, user: any, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;
    
    // Check if product exists and belongs to this merchant
    const checkResult = await pool.query(
      'SELECT id FROM merchant_products WHERE id = $1 AND merchant_id = $2',
      [productId, user.id]
    );
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Product not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }
    
    // Delete the product
    await pool.query(
      'DELETE FROM merchant_products WHERE id = $1',
      [productId]
    );
    
    return NextResponse.json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}

// Export the handlers with merchant authentication
export const GET = withMerchantAuth((req: NextRequest, user: any, context: any) => {
  // Extract product ID from the URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const productId = pathParts[pathParts.length - 1];
  
  // Create a params object if it doesn't exist in the context
  const params = { id: productId };
  return getProduct(req, user, { params });
});

export const PUT = withMerchantAuth((req: NextRequest, user: any, context: any) => {
  // Extract product ID from the URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const productId = pathParts[pathParts.length - 1];
  
  // Create a params object if it doesn't exist in the context
  const params = { id: productId };
  return updateProduct(req, user, { params });
});

export const DELETE = withMerchantAuth((req: NextRequest, user: any, context: any) => {
  // Extract product ID from the URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const productId = pathParts[pathParts.length - 1];
  
  // Create a params object if it doesn't exist in the context
  const params = { id: productId };
  return deleteProduct(req, user, { params });
});
