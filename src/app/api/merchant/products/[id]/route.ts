import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { z } from 'zod';
import { withMerchantAuth } from '@/lib/merchantAuth';

// Schema for updating a product (fields in 'products' table updatable by merchant)
const updateProductSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().min(10).optional(),
  price: z.number().positive().optional(),
  imageUrl: z.string().min(1).optional(),
  categoryId: z.string().optional().nullable(), // For platform_category_id
  isActive: z.boolean().optional(), // Special handling: only true if approved, false anytime
  // merchant cannot update approval_status directly
  // Fields like basePrice, additionalImages, stockQuantity, cashbackConfig are not in 'products' table yet.
});

// GET handler to fetch a specific product
async function getProduct(req: NextRequest, merchantUser: any, { params }: { params: { id: string } }) { // Renamed user
  try {
    const productId = params.id;
    
    // Check if product exists and belongs to this merchant in 'products' table
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, 
              p.platform_category_id, c.name as category_name, 
              p.approval_status, p.is_active, p.created_at, p.updated_at
       FROM products p
       LEFT JOIN categories c ON p.platform_category_id = c.id
       WHERE p.id = $1 AND p.merchant_id = $2`,
      [productId, merchantUser.id] // Use merchantUser.id
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
      imageUrl: product.image_url,
      platformCategoryId: product.platform_category_id,
      categoryName: product.category_name,
      approvalStatus: product.approval_status,
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
async function updateProduct(req: NextRequest, merchantUser: any, { params }: { params: { id: string } }) { // Renamed user
  try {
    const productId = params.id;
    
    // Check if product exists and belongs to this merchant in 'products' table, and get its current status
    const checkResult = await pool.query(
      'SELECT id, approval_status, is_active FROM products WHERE id = $1 AND merchant_id = $2',
      [productId, merchantUser.id] // Use merchantUser.id from the function parameters
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
    const values = [productId, merchantUser.id];
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
    
    // basePrice is not in the simplified updateProductSchema or products table for now
    // if (data.basePrice !== undefined) {
    //   updates.push(`base_price = $${valueIndex++}`);
    //   values.push(data.basePrice.toString()); // Convert to string for PostgreSQL
    // }
    
    if (data.imageUrl !== undefined) {
      updates.push(`image_url = $${valueIndex++}`);
      values.push(data.imageUrl);
    }
    
    // additionalImages is not in the simplified updateProductSchema or products table for now
    // if (data.additionalImages !== undefined) {
    //   updates.push(`additional_images = $${valueIndex++}`);
    //   values.push(data.additionalImages);
    // }
    
    // Handle categoryId (maps to platform_category_id) - explicitly set to NULL if null/empty
    if (data.categoryId !== undefined) {
      if (data.categoryId === null || data.categoryId === '') {
        updates.push(`platform_category_id = NULL`);
      } else {
        updates.push(`platform_category_id = $${valueIndex++}`);
        // Assuming categoryId is a string that needs to be parsed to integer or is already an integer string
        values.push(parseInt(data.categoryId, 10)); 
      }
    }
    
    // stockQuantity is not in the simplified updateProductSchema or products table for now
    // if (data.stockQuantity !== undefined) {
    //   updates.push(`stock_quantity = $${valueIndex++}`);
    //   values.push(data.stockQuantity.toString()); // Convert to string for PostgreSQL
    // }
    
    // cashbackConfig is not in the simplified updateProductSchema or products table for now
    // if (data.cashbackConfig !== undefined) {
    //   if (data.cashbackConfig === null) {
    //     updates.push(`cashback_config = NULL`);
    //   } else {
    //     updates.push(`cashback_config = $${valueIndex++}`);
    //     values.push(JSON.stringify(data.cashbackConfig)); // Convert object to JSON string
    //   }
    // }
    
    const currentProductStatus = checkResult.rows[0]; // Contains id, approval_status, is_active

    if (data.isActive !== undefined) {
      if (data.isActive === false) {
        updates.push(`is_active = $${valueIndex++}`);
        values.push(false);
      } else { // data.isActive is true
        if (currentProductStatus.approval_status === 'approved') {
          updates.push(`is_active = $${valueIndex++}`);
          values.push(true);
        } else {
          // Merchant trying to activate a non-approved product
          return NextResponse.json(
            { error: 'Product must be approved to be set active.' },
            { status: 403 } // Forbidden
          );
        }
      }
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
      UPDATE products
      SET ${updates.join(', ')}
      WHERE id = $1 AND merchant_id = $2
      RETURNING id, name, description, price, image_url, platform_category_id, approval_status, is_active, updated_at
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
      
      // Format the response based on fields returned from 'products' table
      return NextResponse.json({
        message: 'Product updated successfully',
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          description: updatedProduct.description,
          price: parseFloat(updatedProduct.price),
          imageUrl: updatedProduct.image_url,
          platformCategoryId: updatedProduct.platform_category_id,
          approvalStatus: updatedProduct.approval_status,
          isActive: updatedProduct.is_active,
          updatedAt: updatedProduct.updated_at
        }
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
async function deleteProduct(req: NextRequest, merchantUser: any, { params }: { params: { id: string } }) { // Renamed user
  try {
    const productId = params.id;
    
    // Check if product exists and belongs to this merchant in 'products' table before deleting
    const checkResult = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND merchant_id = $2',
      [productId, merchantUser.id] // Use merchantUser.id
    );
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Product not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }
    
    // Execute the delete query against 'products' table, ensuring merchant ownership again in the DELETE statement
    const deleteResult = await pool.query(
      'DELETE FROM products WHERE id = $1 AND merchant_id = $2 RETURNING id',
      [productId, merchantUser.id] // Use merchantUser.id
    );

    if (deleteResult.rowCount === 0) {
      // This case should ideally be caught by the checkResult above, but as a safeguard:
      return NextResponse.json(
        { error: 'Product not found or you do not have permission to delete it, or it was already deleted.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: `Product with ID ${productId} deleted successfully` });
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
