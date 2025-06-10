import { getSupplierAccessToken } from './supplierAuth';
import { setTimeout } from 'timers/promises'; // For async delay // Assuming this path and function name are correct

// Interfaces for raw CJ API category structure
export interface RawCjApiL3Category {
  categoryId: string;
  categoryName: string;
}

export interface RawCjApiL2Category {
  categorySecondName: string;
  categorySecondList?: RawCjApiL3Category[];
}

export interface RawCjApiL1Category {
  categoryFirstName: string;
  categoryFirstList?: RawCjApiL2Category[];
}

// Interface for Transformed CJ Category (can be renamed to SupplierCategory later)
export interface CjCategory {
  id: string; // This will be CJ's categoryId for L3, or a generated one for L1/L2
  name: string;
  children?: CjCategory[];
}

// Transformation function (moved from cj-browse/page.tsx or cj-categories-route)
export function transformCjApiDataToCjCategories(rawCategories: RawCjApiL1Category[]): CjCategory[] {
  if (!rawCategories || !Array.isArray(rawCategories)) {
    console.warn("transformCjApiDataToCjCategories: Received invalid rawCategories data", rawCategories);
    return [];
  }

  const mapL3 = (l3Cat: RawCjApiL3Category): CjCategory => ({
    id: l3Cat.categoryId,
    name: l3Cat.categoryName,
  });

  const mapL2 = (l2Cat: RawCjApiL2Category, l1Index: number, l2Index: number): CjCategory => {
    const children = (l2Cat.categorySecondList || []).map(mapL3);
    // Generate a unique ID for L2 categories
    const l2Id = `cj-l2-${l1Index}-${l2Index}-${l2Cat.categorySecondName.replace(/[^a-zA-Z0-9-_]/g, '') || 'unknown'}`;
    return {
      id: l2Id,
      name: l2Cat.categorySecondName,
      children: children.length > 0 ? children : undefined,
    };
  };

  return rawCategories.map((l1Cat, l1Index) => {
    const children = (l1Cat.categoryFirstList || []).map((l2Cat, l2Index) => mapL2(l2Cat, l1Index, l2Index));
    // Generate a unique ID for L1 categories
    const l1Id = `cj-l1-${l1Index}-${l1Cat.categoryFirstName.replace(/[^a-zA-Z0-9-_]/g, '') || 'unknown'}`;
    return {
      id: l1Id,
      name: l1Cat.categoryFirstName,
      children: children.length > 0 ? children : undefined,
    };
  });
}


const CJ_CATEGORY_API_URL = 'https://developers.cjdropshipping.com/api2.0/v1/product/getCategory';

// --- BEGIN CACHING LOGIC ---
interface CategoryCache {
  categories: CjCategory[];
  expiresAt: number;
}

let categoryCache: CategoryCache | null = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour
const RETRY_DELAY_MS = 2000; // 2 seconds for retry
// --- END CACHING LOGIC ---

// New helper function to fetch and transform categories
export async function fetchAndTransformCjCategories(retryAttempt = 0): Promise<CjCategory[]> {
  // --- BEGIN CACHE CHECK ---
  if (categoryCache && categoryCache.expiresAt > Date.now()) {
    console.log('[cjUtils] Returning categories from cache.');
    return categoryCache.categories;
  }
  // --- END CACHE CHECK ---
  let supplierAccessToken;
  try {
    supplierAccessToken = await getSupplierAccessToken();
  } catch (error: any) {
    console.error('[cjUtils] Failed to get Supplier access token:', error.message);
    throw new Error('Failed to authenticate with Supplier API for categories. ' + error.message);
  }

  try {
    console.log(`[cjUtils] Calling Supplier Category API (CJ): ${CJ_CATEGORY_API_URL}` + (retryAttempt > 0 ? ` (Retry attempt ${retryAttempt})` : ''));
    const response = await fetch(CJ_CATEGORY_API_URL, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': supplierAccessToken, // Header key is CJ specific
        'Content-Type': 'application/json',
      },
    });

    const supplierData = await response.json();

    if (!response.ok || supplierData.result !== true || String(supplierData.code) !== "200") {
      const errorMessage = `Supplier API (CJ) category request failed: ${supplierData.message || response.statusText} (Status: ${response.status}, Code: ${supplierData.code})`;
      console.error(`[cjUtils] ${errorMessage}`, supplierData);

      // Check for rate limit error (CJ specific code or message might be needed for more accuracy)
      // CJ's "Too much request, QPS limit is 1 time/1second" often comes with response.status 429 or a specific supplierData.code
      if ((response.status === 429 || (supplierData.message && supplierData.message.toLowerCase().includes("too much request"))) && retryAttempt < 1) {
        console.log(`[cjUtils] Rate limit hit. Retrying after ${RETRY_DELAY_MS}ms...`);
        await setTimeout(RETRY_DELAY_MS); // Use setTimeout from 'timers/promises'
        return fetchAndTransformCjCategories(retryAttempt + 1); // Recursive call for retry
      }
      throw new Error(errorMessage);
    }

    const rawCategories = supplierData.data || [];
    const transformedCategories = transformCjApiDataToCjCategories(rawCategories as RawCjApiL1Category[]);

    // --- BEGIN CACHE UPDATE ---
    categoryCache = {
      categories: transformedCategories,
      expiresAt: Date.now() + CACHE_DURATION_MS,
    };
    console.log('[cjUtils] Categories fetched from API and cached.');
    // --- END CACHE UPDATE ---

    return transformedCategories;

  } catch (error: any) {
    // If it's an error from a retry, or not a rate limit error, re-throw
    if (retryAttempt > 0 || !(error.message && error.message.toLowerCase().includes("too much request"))) {
        console.error(`[cjUtils] Exception while fetching categories from Supplier (CJ)${retryAttempt > 0 ? ` on retry ${retryAttempt}` : ''}:`, error);
        throw new Error(`Failed to fetch and transform categories from Supplier API (CJ). Details: ${error.message}`);
    }
    // This part should ideally be caught by the specific rate limit check above,
    // but as a fallback for other forms of the rate limit message:
    if (retryAttempt < 1) {
        console.log(`[cjUtils] Rate limit likely hit (general catch). Retrying after ${RETRY_DELAY_MS}ms...`);
        await setTimeout(RETRY_DELAY_MS);
        return fetchAndTransformCjCategories(retryAttempt + 1);
    }
    // If all retries fail or it's not a recognized rate limit error
    console.error(`[cjUtils] Final exception after retries or non-retryable error for categories from Supplier (CJ):`, error);
    throw new Error('Failed to fetch and transform categories from Supplier API (CJ) after retries. Details: ' + error.message);
  }
}
