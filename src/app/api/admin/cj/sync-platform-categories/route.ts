import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { fetchAndTransformCjCategories, CjCategory } from '../../../../../lib/cjUtils';
import { Pool, PoolClient } from 'pg';

// Force this route to run in Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

interface SyncError {
  categoryName: string;
  parentId?: number | null;
  error: string;
}

async function sync_supplier_category_to_db( // Renamed function
  supplierCategory: CjCategory, // Parameter renamed, type CjCategory is from cjUtils for now
  parentPlatformId: number | null,
  client: PoolClient,
  counts: { addedCount: number; existedCount: number; errorCount: number; },
  errorsList: SyncError[]
): Promise<void> {
  let platformCategoryId: number | null = null;

  try {
    // Check if category already exists with the same name and parent_id
    const checkQuery = `
      SELECT id FROM categories
      WHERE name = $1 AND (parent_category_id = $2 OR ($2 IS NULL AND parent_category_id IS NULL))
    `;
    const checkResult = await client.query(checkQuery, [supplierCategory.name, parentPlatformId]);

    if (checkResult.rows.length > 0) {
      platformCategoryId = checkResult.rows[0].id;
      counts.existedCount++;
      console.log(`[Category Sync] Category '${supplierCategory.name}' (Supplier ID: ${supplierCategory.id}) with parent '${parentPlatformId || 'NULL'}' already exists with Platform ID: ${platformCategoryId}.`);
    } else {
      // Insert new category
      const insertQuery = `
        INSERT INTO categories (name, parent_category_id, description, is_active)
        VALUES ($1, $2, $3, true) RETURNING id;
        -- Assuming new categories from Supplier should be active by default
        -- Description can be enhanced, e.g., 'Synced from Supplier (Supplier ID: ${supplierCategory.id})'
      `;
      const description = `Synced from Supplier (Supplier ID: ${supplierCategory.id}, Name: ${supplierCategory.name})`; // Source ID is still CJ's categoryId
      const insertResult = await client.query(insertQuery, [supplierCategory.name, parentPlatformId, description]);
      platformCategoryId = insertResult.rows[0].id;
      counts.addedCount++;
      console.log(`[Category Sync] Added category '${supplierCategory.name}' (Supplier ID: ${supplierCategory.id}) with new Platform ID: ${platformCategoryId} under parent '${parentPlatformId || 'NULL'}'.`);
    }
  } catch (error: any) {
    console.error(`[Category Sync] Error processing category '${supplierCategory.name}' (Supplier ID: ${supplierCategory.id}): ${error.message}`);
    counts.errorCount++;
    errorsList.push({ categoryName: supplierCategory.name, parentId: parentPlatformId, error: error.message });
    // Do not proceed with children if this category failed to insert/find
    return;
  }

  if (platformCategoryId && supplierCategory.children && supplierCategory.children.length > 0) {
    for (const childSupplierCategory of supplierCategory.children) { // Renamed loop variable
      await sync_supplier_category_to_db(childSupplierCategory, platformCategoryId, client, counts, errorsList); // Recursive call with renamed function
    }
  }
}


export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  if (!authResult.valid) {
    return NextResponse.json({ success: false, message: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }

  let supplierCategories: CjCategory[]; // Renamed variable, type CjCategory is from cjUtils for now
  try {
    supplierCategories = await fetchAndTransformCjCategories();
    if (!supplierCategories || supplierCategories.length === 0) {
      return NextResponse.json({ message: "No categories fetched from Supplier or none transformed.", addedCount: 0, existedCount: 0, errorCount: 0, errorsList: [] }, { status: 200 }); // Updated message
    }
  } catch (fetchError: any) {
    console.error('[Category Sync] Failed to fetch/transform Supplier categories:', fetchError.message); // Updated log
    return NextResponse.json({ error: 'Failed to fetch categories from Supplier API.', details: fetchError.message }, { status: 502 });
  }

  const counts = { addedCount: 0, existedCount: 0, errorCount: 0 };
  const errorsList: SyncError[] = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log(`[Category Sync] Starting sync for ${supplierCategories.length} top-level Supplier categories.`); // Updated log
    for (const topLevelSupplierCategory of supplierCategories) { // Renamed loop variable
      await sync_supplier_category_to_db(topLevelSupplierCategory, null, client, counts, errorsList); // Call renamed function
    }

    if (counts.errorCount > 0) {
      console.warn(`[Category Sync] Found ${counts.errorCount} errors during sync. Rolling back transaction.`);
      await client.query('ROLLBACK');
      return NextResponse.json({
        message: 'Category sync completed with errors. No changes were saved.',
        ...counts,
        errorsList
      }, { status: 422 }); // Unprocessable Entity or 500
    } else {
      await client.query('COMMIT');
      console.log(`[Category Sync] Sync completed successfully. Added: ${counts.addedCount}, Existed: ${counts.existedCount}.`);
      return NextResponse.json({
        message: 'Category sync completed successfully.',
        ...counts
      });
    }
  } catch (error: any) {
    console.error('[Category Sync] Transaction error during category sync:', error.message);
    try {
      await client.query('ROLLBACK');
    } catch (rbError: any) {
      console.error('[Category Sync] Critical: Failed to rollback transaction:', rbError.message);
    }
    return NextResponse.json({ error: 'Failed to sync categories due to a transaction error.', details: error.message, ...counts, errorsList }, { status: 500 });
  } finally {
    client.release();
  }
}
