// Database utility functions for Next.js API routes
const { Pool } = require('pg');

// Create a connection pool using the connection string from environment variables
let pool;

try {
  // Use the POSTGRES_URL from environment variables
  const connectionString = process.env.POSTGRES_URL || 'postgresql://moobuser:userfortaicweb@localhost:5432/moobfinancial';
  console.log('Connecting to database with connection string:', connectionString);
  
  pool = new Pool({
    connectionString,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  
  // Test the connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('Database connected successfully at:', res.rows[0].now);
    }
  });
} catch (error) {
  console.error('Failed to initialize database pool:', error);
}

// Function to query products with optional filters
async function getProducts(options = {}) {
  const { query, category, priceMin, priceMax, limit = 10 } = options;
  
  try {
    // First, let's check if there are any products in the CJ products table
    console.log('Checking if there are any products in the CJ products table...');
    const countResult = await pool.query('SELECT COUNT(*) FROM cj_products WHERE approval_status = \'approved\' AND is_active = TRUE');
    const productCount = parseInt(countResult.rows[0].count);
    console.log(`Total approved and active CJ products in database: ${productCount}`);
    
    if (productCount === 0) {
      console.log('No approved CJ products found in the database');
      return [];
    }
    
    // Build a query to get all approved CJ products with category information
    let sqlQuery = `
      SELECT 
        cp.platform_product_id as id, 
        COALESCE(cp.display_name, cp.original_name) as name, 
        COALESCE(cp.display_description, cp.original_description) as description, 
        cp.selling_price as price, 
        cp.image_url, 
        c.name as category
      FROM cj_products cp
      LEFT JOIN categories c ON cp.platform_category_id = c.id
      WHERE cp.approval_status = 'approved' AND cp.is_active = TRUE
      LIMIT $1
    `;
    
    // Execute the simple query
    console.log('Executing query to get all approved CJ products');
    const simpleResult = await pool.query(sqlQuery, [limit]);
    console.log(`Query returned ${simpleResult.rows.length} CJ products`);
    if (simpleResult.rows.length > 0) {
      console.log('First product:', simpleResult.rows[0]);
    }
    
    // If we found products with the simple query, process image URLs and return them
    if (simpleResult.rows.length > 0) {
      // Process the image URLs from JSON strings to actual URLs
      const processedProducts = simpleResult.rows.map(product => {
        try {
          // Parse the image_url JSON string and get the first image as the main image
          if (product.image_url && typeof product.image_url === 'string') {
            const imageUrls = JSON.parse(product.image_url);
            // Use the first image URL as the main image
            product.image_url = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : '';
          }
        } catch (error) {
          console.error(`Error parsing image URL for product ${product.id}:`, error);
          // If parsing fails, keep the original value
        }
        return product;
      });
      
      return processedProducts;
    }
    
    // Otherwise, continue with the filtered query for CJ products
    sqlQuery = `
      SELECT DISTINCT
        cp.platform_product_id as id, 
        COALESCE(cp.display_name, cp.original_name) as name, 
        COALESCE(cp.display_description, cp.original_description) as description, 
        cp.selling_price as price, 
        cp.image_url, 
        c.name as category
      FROM cj_products cp 
      LEFT JOIN categories c ON cp.platform_category_id = c.id
      WHERE cp.approval_status = 'approved' AND cp.is_active = TRUE
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Add search query filter
    if (query) {
      sqlQuery += ` AND (cp.display_name ILIKE $${paramIndex} OR cp.original_name ILIKE $${paramIndex} OR cp.display_description ILIKE $${paramIndex} OR cp.original_description ILIKE $${paramIndex})`;
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    // Add category filter
    if (category) {
      sqlQuery += ` AND c.name ILIKE $${paramIndex}`;
      params.push(`%${category}%`);
      paramIndex++;
    }
    
    // Add price range filters
    if (priceMin !== undefined) {
      sqlQuery += ` AND cp.selling_price >= $${paramIndex}`;
      params.push(priceMin);
      paramIndex++;
    }
    
    if (priceMax !== undefined) {
      sqlQuery += ` AND cp.selling_price <= $${paramIndex}`;
      params.push(priceMax);
      paramIndex++;
    }
    
    // Add limit
    sqlQuery += ` ORDER BY cp.display_name LIMIT $${paramIndex}`;
    params.push(limit);
    
    console.log('Executing SQL query:', sqlQuery);
    console.log('With parameters:', params);
    
    // Execute the query
    const result = await pool.query(sqlQuery, params);
    console.log(`Query returned ${result.rows.length} CJ products`);
    
    // Process the image URLs from JSON strings to actual URLs
    const processedProducts = result.rows.map(product => {
      try {
        // Parse the image_url JSON string and get the first image as the main image
        if (product.image_url && typeof product.image_url === 'string') {
          const imageUrls = JSON.parse(product.image_url);
          // Use the first image URL as the main image
          product.image_url = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : '';
        }
      } catch (error) {
        console.error(`Error parsing image URL for product ${product.id}:`, error);
        // If parsing fails, keep the original value
      }
      return product;
    });
    
    return processedProducts;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Function to get a single product by ID
async function getProductById(id) {
  try {
    console.log(`Getting CJ product with ID: ${id}`);
    
    const result = await pool.query(
      `SELECT 
        cp.platform_product_id as id, 
        COALESCE(cp.display_name, cp.original_name) as name, 
        COALESCE(cp.display_description, cp.original_description) as description, 
        cp.selling_price as price, 
        cp.image_url, 
        c.name as category
      FROM cj_products cp
      LEFT JOIN categories c ON cp.platform_category_id = c.id
      WHERE cp.platform_product_id = $1 AND cp.approval_status = 'approved' AND cp.is_active = TRUE`,
      [id]
    );
    
    if (result.rows.length === 0) {
      console.log(`No product found with ID: ${id}`);
      return null;
    }
    
    // Process the image URL from JSON string to actual URL
    const product = result.rows[0];
    try {
      if (product.image_url && typeof product.image_url === 'string') {
        const imageUrls = JSON.parse(product.image_url);
        // Use the first image URL as the main image
        product.image_url = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : '';
      }
    } catch (error) {
      console.error(`Error parsing image URL for product ${product.id}:`, error);
      // If parsing fails, keep the original value
    }
    
    console.log(`Found product with ID: ${id}:`, product);
    return product;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Export the functions
module.exports = {
  pool,
  getProducts,
  getProductById
};
