// Script to seed initial platform categories
// Usage: node seed-categories.js YOUR_ADMIN_API_KEY

const fetch = require('node-fetch');

const seedCategories = async (apiKey) => {
  try {
    console.log('Starting category seeding process...');
    
    // Function to create a slug from a name
    const createSlug = (name) => {
      return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
        .substring(0, 50);            // Limit length to 50 chars
    };
    
    // Common CJ categories mapped to platform categories
    // These are based on frequently seen CJ categories
    const categoriesToSeed = [
      { name: "Women's Clothing", slug: "womens-clothing", description: "Women's apparel and fashion items" },
      { name: "Men's Clothing", slug: "mens-clothing", description: "Men's apparel and fashion items" },
      { name: "Accessories", slug: "accessories", description: "Fashion accessories for all genders" },
      { name: "Hats & Caps", slug: "hats-caps", description: "Headwear including hats, caps, and other head accessories" },
      { name: "Electronics", slug: "electronics", description: "Electronic devices and accessories" },
      { name: "Home & Garden", slug: "home-garden", description: "Items for home decoration and gardening" },
      { name: "Toys & Games", slug: "toys-games", description: "Entertainment items for children and adults" },
      { name: "Beauty & Health", slug: "beauty-health", description: "Personal care, cosmetics, and health products" },
      { name: "Sports & Outdoors", slug: "sports-outdoors", description: "Equipment and apparel for sports and outdoor activities" },
      { name: "Jewelry", slug: "jewelry", description: "Decorative items worn as personal adornment" },
      { name: "Shoes", slug: "shoes", description: "Footwear for all genders and occasions" },
      { name: "Bags & Luggage", slug: "bags-luggage", description: "Carrying items including handbags, backpacks, and travel luggage" }
    ];
    
    // Add more categories specifically for CJ's common categories
    const additionalCjCategories = [
      { name: "Woman Hats & Caps", description: "Women's headwear including hats and caps" },
      { name: "Rompers", description: "One-piece garments for women" },
      { name: "Dresses", description: "Women's dresses for various occasions" },
      { name: "Phone Accessories", description: "Accessories for mobile phones" },
      { name: "Kitchen Gadgets", description: "Tools and gadgets for kitchen use" }
    ];
    
    // Add slugs to additional categories
    additionalCjCategories.forEach(category => {
      category.slug = createSlug(category.name);
    });
    
    // Combine all categories
    categoriesToSeed.push(...additionalCjCategories);
    
    console.log(`Preparing to seed ${categoriesToSeed.length} categories...`);
    
    // Create each category using the API
    for (const category of categoriesToSeed) {
      console.log(`Creating category: ${category.name}`);
      
      const response = await fetch('http://localhost:9002/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': apiKey
        },
        body: JSON.stringify(category)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create category "${category.name}": ${response.status} ${response.statusText}`);
        console.error(`Error details: ${errorText}`);
        continue;
      }
      
      const result = await response.json();
      console.log(`Successfully created category: ${category.name} with ID: ${result.id || 'unknown'}`);
    }
    
    console.log('Category seeding completed!');
    
    // Now verify the categories were created
    const verifyResponse = await fetch('http://localhost:9002/api/admin/categories?hierarchical=false', {
      headers: {
        'X-Admin-API-Key': apiKey
      }
    });
    
    if (!verifyResponse.ok) {
      console.error('Failed to verify categories:', verifyResponse.status, verifyResponse.statusText);
      return;
    }
    
    const categories = await verifyResponse.json();
    console.log(`Verification: Found ${categories.length} categories in the database.`);
    console.log('Categories:', JSON.stringify(categories, null, 2));
    
  } catch (error) {
    console.error('Error in seeding categories:', error);
  }
};

// Get API key from command line argument
const apiKey = process.argv[2];

if (!apiKey) {
  console.log('Please provide an API key as a command line argument:');
  console.log('node seed-categories.js YOUR_API_KEY');
  process.exit(1);
}

seedCategories(apiKey);
