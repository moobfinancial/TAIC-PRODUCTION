import { NextRequest, NextResponse } from 'next/server';
import { getSupplierAccessToken } from '@/lib/supplierAuth'; // Assuming this path is correct

const CJ_PRODUCT_DETAIL_API_URL_BASE = "https://developers.cjdropshipping.com/api2.0/v1/product/query";

export async function GET(request: NextRequest) {
  console.log('CJ Live Product Details API route hit');

  const { searchParams } = request.nextUrl;
  const cjProductId = searchParams.get('pid'); // CJ API uses 'pid' for product ID

  if (!cjProductId) {
    console.error('CJ Product ID (pid) is missing from request parameters');
    return NextResponse.json({ message: 'CJ Product ID (pid) is required' }, { status: 400 });
  }

  console.log(`Fetching live details for CJ Product ID: ${cjProductId}`);

  let accessToken: string;
  try {
    accessToken = await getSupplierAccessToken();
    if (!accessToken) {
      console.error('Failed to retrieve CJ Dropshipping access token.');
      return NextResponse.json({ message: 'Failed to authenticate with supplier API.' }, { status: 500 });
    }
    console.log('CJ Access Token successfully retrieved for product detail fetch.');
  } catch (error) {
    console.error('Error retrieving CJ Dropshipping access token:', error);
    return NextResponse.json({ message: 'Error authenticating with supplier API.', error: (error as Error).message }, { status: 500 });
  }

  const cjApiUrl = `${CJ_PRODUCT_DETAIL_API_URL_BASE}?pid=${cjProductId}`;
  console.log(`Constructed CJ API URL: ${cjApiUrl}`);

  try {
    const response = await fetch(cjApiUrl, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    console.log(`CJ API response status: ${response.status}`);

    if (!response.ok) {
      // Try to parse error body from CJ if possible
      let errorBody = 'Failed to fetch product details from CJ Dropshipping.';
      try {
        const errData = await response.json();
        errorBody = errData.message || errorBody;
        console.error('CJ API Error Response Body:', errData);
      } catch (e) {
        // Ignore if error body is not JSON
        console.error('Could not parse CJ API error response body:', response.statusText);
        errorBody = response.statusText || errorBody;
      }
      return NextResponse.json({ message: errorBody }, { status: response.status });
    }

    const responseData = await response.json();
    console.log('CJ API Response Data (raw):', JSON.stringify(responseData, null, 2));

    // According to CJ documentation for product/query:
    // - `code` should be 200 for success.
    // - `result` should be true for success.
    // - `data` contains the product details, typically an array with one product object.
    if (responseData.result === true && String(responseData.code) === "200") {
      if (responseData.data && Array.isArray(responseData.data) && responseData.data.length > 0) {
        const productData = responseData.data[0]; // Assuming the first element is the desired product
        console.log(`Successfully fetched live details for CJ Product ID: ${cjProductId}`);
        return NextResponse.json(productData, { status: 200 });
      } else if (responseData.data && Array.isArray(responseData.data) && responseData.data.length === 0) {
        console.warn(`CJ Product ID: ${cjProductId} not found (empty data array).`);
        return NextResponse.json({ message: `Product with CJ ID ${cjProductId} not found.` }, { status: 404 });
      } else {
        console.error(`CJ API returned success code but data format is unexpected for CJ Product ID: ${cjProductId}. Data:`, responseData.data);
        return NextResponse.json({ message: 'Unexpected data format from supplier API.' }, { status: 422 }); // Unprocessable Entity
      }
    } else {
      console.error(`CJ API indicated an error for Product ID ${cjProductId}. Code: ${responseData.code}, Message: ${responseData.message}`);
      return NextResponse.json({ message: responseData.message || 'Failed to fetch product details from CJ API due to API-level error.' }, { status: 422 }); // Unprocessable Entity or more specific
    }
  } catch (error) {
    console.error(`An unexpected error occurred while fetching live CJ product details for ID ${cjProductId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred.', error: (error as Error).message }, { status: 500 });
  }
}

// Optional: Add basic error handling for other methods if needed, or rely on Next.js default 405.
export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}
// ... and for PUT, DELETE, PATCH etc. if you want to be explicit.
// By default, Next.js will return 405 for unhandled methods.
