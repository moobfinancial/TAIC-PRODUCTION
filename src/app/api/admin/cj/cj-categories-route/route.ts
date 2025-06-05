import { NextRequest, NextResponse } from 'next/server';
import { getCjAccessToken } from '../../../../../lib/cjAuth'; // Adjusted path

// --- Interfaces for the Transformed Data (consistent structure for frontend/caching) ---
interface TransformedCjCategory {
  id: string; // Unique ID for the category
  name: string; // Display name for the category
  children?: TransformedCjCategory[];
}

// --- Interfaces for the Raw CJ API Response Structure ---
interface RawCjCategoryLeaf {
  categoryId: string;
  categoryName: string;
  // categoryNameEn?: string; // If available from API at this level
}

interface RawCjCategoryNodeL2 {
  categorySecondId: string;
  categorySecondName: string;
  categorySecondList?: RawCjCategoryLeaf[];
}

interface RawCjCategoryNodeL1 {
  categoryFirstId: string;
  categoryFirstName: string;
  categoryFirstList?: RawCjCategoryNodeL2[];
}

// Interface for the overall CJ API response envelope
interface CjApiResponse {
  code: number;
  result: boolean;
  message: string;
  data: RawCjCategoryNodeL1[] | null; // Raw data from CJ
  requestId?: string;
}

// --- Transformation Function ---
function transformRawCjCategories(rawCategories: RawCjCategoryNodeL1[] | null): TransformedCjCategory[] {
  if (!rawCategories) return [];
  return rawCategories.map((level1Node): TransformedCjCategory => {
    return {
      id: level1Node.categoryFirstId,
      name: level1Node.categoryFirstName, // Assuming categoryFirstName is the desired name
      children: level1Node.categoryFirstList ? level1Node.categoryFirstList.map((level2Node): TransformedCjCategory => {
        return {
          id: level2Node.categorySecondId,
          name: level2Node.categorySecondName, // Assuming categorySecondName is the desired name
          children: level2Node.categorySecondList ? level2Node.categorySecondList.map((leafNode): TransformedCjCategory => {
            return {
              id: leafNode.categoryId,
              name: leafNode.categoryName, // Assuming categoryName is the desired name
              // No children for leaf nodes
            };
          }) : undefined,
        };
      }) : undefined,
    };
  });
}

// --- Cache variables and helper ---
let cachedTransformedCategoriesData: TransformedCjCategory[] | null = null;
let categoriesCacheExpiry: Date | null = null;
let categoryFetchPromise: Promise<TransformedCjCategory[]> | null = null;

const CATEGORIES_CACHE_DURATION_MS: number = 1 * 60 * 60 * 1000; // 1 hour cache duration

async function fetchAndCacheCategories(): Promise<TransformedCjCategory[]> {
  console.log('[CJ Categories API] Cache miss or stale. Fetching fresh categories from CJ API.');
  let cjToken: string;
  try {
    cjToken = await getCjAccessToken();
  } catch (error: any) {
    console.error('[CJ Categories API] Error getting CJ access token during cache refresh:', error.message);
    const authError: any = new Error(`Failed to authenticate with CJ Dropshipping: ${error.message}`);
    // Attempt to get a status from the original error, or default
    authError.status = error.status || 500; 
    throw authError;
  }

  const cjCategoriesUrl = 'https://developers.cjdropshipping.com/api2.0/v1/product/getCategory';

  try {
    const response = await fetch(cjCategoriesUrl, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': cjToken,
        'Content-Type': 'application/json',
      },
    });

    const responseStatus = response.status;
    const responseStatusText = response.statusText;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CJ Categories API] CJ API request failed during cache refresh: ${responseStatus} ${responseStatusText}`, errorText);
      const apiError: any = new Error(`Failed to fetch categories from CJ Dropshipping: CJ API Error: ${responseStatus} ${errorText}`);
      apiError.status = responseStatus;
      throw apiError;
    }

    const cjData: CjApiResponse = await response.json();

    if (!cjData.result || !cjData.data) {
      console.error('[CJ Categories API] CJ API returned non-successful result or no raw data during cache refresh:', cjData);
      const processError: any = new Error(`Failed to process categories from CJ Dropshipping: ${cjData.message || 'CJ API indicated failure or no data'}`);
      processError.status = cjData.code === 429 ? 429 : 502; // Use 429 if CJ sends it, else 502 for Bad Gateway
      throw processError;
    }

    // Transform the raw data
    const transformedCategories = transformRawCjCategories(cjData.data);

    cachedTransformedCategoriesData = transformedCategories;
    categoriesCacheExpiry = new Date(Date.now() + CATEGORIES_CACHE_DURATION_MS);
    console.log(`[CJ Categories API] Raw categories fetched and transformed. Transformed data cached successfully. Expiry: ${categoriesCacheExpiry.toISOString()}`);
    return cachedTransformedCategoriesData;

  } catch (error: any) {
    // Log if not already a well-formed error with status, or re-log for clarity
    if (!error.status) {
        console.error('[CJ Categories API] Unknown error during fetch/process in cache refresh:', error);
    }
    // Ensure status is propagated or set
    if (!error.status && error.name === 'FetchError') { // node-fetch specific error
        error.status = 503; // Service Unavailable for network issues
    } else if (!error.status) {
        error.status = 500; // Default internal server error for other unknown errors
    }
    throw error; // Re-throw the error with status attached
  }
}
// END: Added cache variables and helper

export async function GET(request: NextRequest) {
  // Admin API Key Validation
  const adminApiKey = request.headers.get('X-Admin-API-Key');
  if (adminApiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized: Invalid Admin API Key' }, { status: 401 });
  }

  // Cache check
  if (cachedTransformedCategoriesData && categoriesCacheExpiry && categoriesCacheExpiry > new Date()) {
    console.log('[CJ Categories API] Serving transformed categories from cache.');
    return NextResponse.json(cachedTransformedCategoriesData);
  }

  // If a fetch is already in progress, await its result
  if (categoryFetchPromise) {
    console.log('[CJ Categories API] A fetch is already in progress, awaiting its completion.');
    try {
      const data = await categoryFetchPromise;
      return NextResponse.json(data);
    } catch (error: any) {
      console.error('[CJ Categories API] Existing fetch promise failed:', error.message);
      return NextResponse.json(
        { error: 'Failed to fetch categories (ongoing operation error)', details: error.message },
        { status: error.status || 500 } // Use status from error if available
      );
    }
  }

  // No active fetch, and cache is invalid/stale, so initiate a new fetch
  console.log('[CJ Categories API] Initiating new category fetch process.');
  categoryFetchPromise = fetchAndCacheCategories();

  try {
    const data = await categoryFetchPromise;
    return NextResponse.json(data);
  } catch (error: any) {
    // The error is already logged in fetchAndCacheCategories or the block above
    return NextResponse.json(
      { error: 'Failed to fetch categories from CJ Dropshipping', details: error.message },
      { status: error.status || 500 } // Use status from error if available
    );
  } finally {
    // Clear the promise regardless of outcome so subsequent requests can try again
    // if this one failed, or to allow cache expiry to trigger a new fetch next time.
    categoryFetchPromise = null;
  }

}
