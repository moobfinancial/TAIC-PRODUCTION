// Simple script to test the categories API endpoint

const fetchCategories = async (apiKey) => {
  try {
    // Use the API key passed as argument
    const adminApiKey = apiKey || '';
    
    console.log('Attempting to fetch categories with API key present:', !!adminApiKey);
    
    const response = await fetch('http://localhost:9002/api/admin/categories?hierarchical=false', {
      headers: {
        'X-Admin-API-Key': adminApiKey
      }
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('Error response:', await response.text());
      return;
    }
    
    const data = await response.json();
    console.log('Categories fetched successfully:');
    console.log(JSON.stringify(data, null, 2));
    console.log('Total categories:', Array.isArray(data) ? data.length : 'Not an array');
  } catch (error) {
    console.error('Error fetching categories:', error);
  }
};

// Get API key from command line argument
const apiKey = process.argv[2];

if (!apiKey) {
  console.log('Please provide an API key as a command line argument:');
  console.log('node test-categories-api.js YOUR_API_KEY');
  process.exit(1);
}

fetchCategories(apiKey);
