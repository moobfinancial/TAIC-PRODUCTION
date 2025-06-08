import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { z } from 'zod';
import { validateAdminApiKey } from '../../../../../lib/adminAuth'; // Adjusted path

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';


const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const BulkStatusUpdateInputSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1, "At least one product ID is required."),
  approvalStatus: z.enum(['approved', 'rejected']).optional(),
  isActive: z.boolean().optional(),
}).refine(data => data.approvalStatus !== undefined || data.isActive !== undefined, {
  message: "At least one of 'approvalStatus' or 'isActive' must be provided for the update.",
});

interface UpdateResult {
  platform_product_id: number;
  status: 'success' | 'error';
  message?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  if (!authResult.valid) {
    return NextResponse.json({ success: false, message: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }

  let validatedData: z.infer<typeof BulkStatusUpdateInputSchema>;
  try {
    const body = await request.json();
    const validationResult = BulkStatusUpdateInputSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    validatedData = validationResult.data;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { productIds, approvalStatus, isActive: payloadIsActive } = validatedData;
  const updateResults: UpdateResult[] = [];
  let successfullyUpdatedCount = 0;
  let failedUpdateCount = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const platformProductId of productIds) {
      const setClauses: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;
      let finalIsActive = payloadIsActive;

      if (approvalStatus) {
        setClauses.push(`approval_status = $${paramIndex++}`);
        queryParams.push(approvalStatus);
        if (approvalStatus === 'approved' && (payloadIsActive === undefined || payloadIsActive === true)) {
          finalIsActive = true;
        } else if (approvalStatus === 'rejected' && (payloadIsActive === undefined || payloadIsActive === false)) {
          finalIsActive = false;
        }
      }

      if (finalIsActive !== undefined) {
        // Check if this clause is already added to avoid duplicates if approvalStatus also dictates isActive
        if (!setClauses.some(clause => clause.startsWith('is_active'))) {
             setClauses.push(`is_active = $${paramIndex++}`);
             queryParams.push(finalIsActive);
        } else {
            // find the existing is_active clause and update its parameter if necessary
            // This logic can be complex; simpler to ensure finalIsActive is determined once
            // For now, the logic above means finalIsActive is the one to use.
            // If approvalStatus set it, and payloadIsActive is different, payloadIsActive wins if it was defined.
            // Let's re-evaluate: if payloadIsActive is defined, it takes precedence.
            if(payloadIsActive !== undefined) finalIsActive = payloadIsActive;

            let isActiveClauseExists = false;
            for(let i=0; i<setClauses.length; i++) {
                if(setClauses[i].startsWith('is_active =')) {
                    queryParams[i] = finalIsActive; // Update existing param
                    isActiveClauseExists = true;
                    break;
                }
            }
            if(!isActiveClauseExists) {
                 setClauses.push(`is_active = $${paramIndex++}`);
                 queryParams.push(finalIsActive);
            }
        }
      }

      if (setClauses.length === 0) {
        // Should be caught by Zod, but as a safeguard for individual product logic
        updateResults.push({ platform_product_id: platformProductId, status: 'error', message: 'No update parameters determined for this product.' });
        failedUpdateCount++;
        continue;
      }

      setClauses.push(`updated_at = NOW()`);
      queryParams.push(platformProductId); // For WHERE clause

      const updateQuery = `
        UPDATE cj_products
        SET ${setClauses.join(', ')}
        WHERE platform_product_id = $${paramIndex};
      `;

      try {
        const result = await client.query(updateQuery, queryParams);
        if (result.rowCount > 0) {
          updateResults.push({ platform_product_id: platformProductId, status: 'success' });
          successfullyUpdatedCount++;
        } else {
          updateResults.push({ platform_product_id: platformProductId, status: 'error', message: 'Product not found.' });
          failedUpdateCount++;
        }
      } catch (individualError: any) {
        updateResults.push({ platform_product_id: platformProductId, status: 'error', message: individualError.message });
        failedUpdateCount++;
      }
    }

    if (failedUpdateCount > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        message: 'Bulk update failed due to errors with some products. No changes were applied.',
        results: updateResults,
        successfullyUpdatedCount,
        failedUpdateCount
      }, { status: 422 });
    } else {
      await client.query('COMMIT');
      return NextResponse.json({
        success: true,
        message: 'Bulk product status update completed successfully.',
        results: updateResults,
        successfullyUpdatedCount,
        failedUpdateCount
      });
    }

  } catch (error: any) {
    await client.query('ROLLBACK').catch(rbError => console.error('Rollback error during bulk update:', rbError));
    console.error('[CJ Bulk Update Status] Error:', error);
    return NextResponse.json({ error: 'Failed to bulk update product statuses.', details: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
