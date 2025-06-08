import { getSupplierAccessToken } from './supplierAuth'; // Assuming this path and function name are correct

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

// New helper function to fetch and transform categories
export async function fetchAndTransformCjCategories(): Promise<CjCategory[]> {
  let supplierAccessToken;
  try {
    supplierAccessToken = await getSupplierAccessToken();
  } catch (error: any) {
    console.error('[cjUtils] Failed to get Supplier access token:', error.message);
    throw new Error('Failed to authenticate with Supplier API for categories. ' + error.message);
  }

  try {
    console.log(`[cjUtils] Calling Supplier Category API (CJ): ${CJ_CATEGORY_API_URL}`);
    const response = await fetch(CJ_CATEGORY_API_URL, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': supplierAccessToken, // Header key is CJ specific
        'Content-Type': 'application/json',
      },
    });

    const supplierData = await response.json();

    if (!response.ok || supplierData.result !== true || String(supplierData.code) !== "200") {
      console.error(`[cjUtils] Supplier API (CJ) category request failed. Status: ${response.status}, Code: ${supplierData.code}, Message: ${supplierData.message}`, supplierData);
      throw new Error(`Supplier API (CJ) category request failed: ${supplierData.message || response.statusText}`);
    }

    const rawCategories = supplierData.data || [];
    return transformCjApiDataToCjCategories(rawCategories as RawCjApiL1Category[]);

  } catch (error: any) {
    console.error('[cjUtils] Exception while fetching categories from Supplier (CJ):', error);
    // Re-throw or handle as appropriate for the caller
    throw new Error('Failed to fetch and transform categories from Supplier API (CJ). Details: ' + error.message);
  }
}
