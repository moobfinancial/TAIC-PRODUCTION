import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // In Next.js App Router, params should be awaited before use
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { error: 'Valid Product ID is required from URL path' },
      { status: 400 }
    );
  }

  console.log(`[API storefront/products/${id}] Request received`);

  let client;
  try {
    client = await pool.connect();
    console.log(`[API storefront/products/${id}] DB client connected`);

    // First, try to find the product in the main products table
    const productQuery = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.platform_category_id,
        c.name as category_name,
        p.merchant_id,
        p.is_active,
        p.approval_status,
        p.default_variant_id,
        COALESCE(pv.price, p.price) as display_price,
        COALESCE(pv.image_url, p.image_url) as display_image_url
      FROM public.products p
      LEFT JOIN public.categories c ON p.platform_category_id = c.id
      LEFT JOIN public.product_variants pv ON p.id = pv.product_id AND pv.id = p.default_variant_id
      WHERE p.id = $1 AND p.is_active = true AND p.approval_status = 'approved'
      LIMIT 1
    `;

    console.log(`[API storefront/products/${id}] Executing productQuery...`);
    let productResult = await client.query(productQuery, [id]);
    console.log(`[API storefront/products/${id}] productQuery executed. Rows: ${productResult.rows.length}`);

    let product = productResult.rows[0];
    let isCJProduct = false;

    // If not found, check cj_products table
    if (!product) {
      console.log(`[API storefront/products/${id}] Product not found in main table, checking cj_products...`);
      
      const cjProductQuery = `
        SELECT 
          cp.platform_product_id as id,
          cp.display_name as name,
          cp.display_description as description,
          cp.platform_category_id,
          c.name as category_name,
          cp.is_active,
          cp.selling_price as display_price,
          cp.image_url as display_image_url,
          cp.variants_json
        FROM public.cj_products cp
        LEFT JOIN public.categories c ON cp.platform_category_id = c.id
        WHERE cp.platform_product_id = $1 
          AND cp.is_active = true
        LIMIT 1
      `;

      const cjProductResult = await client.query(cjProductQuery, [id]);
      if (cjProductResult.rows.length > 0) {
        product = cjProductResult.rows[0];
        isCJProduct = true;
        console.log(`[API storefront/products/${id}] Found in cj_products`);
      }
    }

    if (!product) {
      console.log(`[API storefront/products/${id}] Product not found`);
      return NextResponse.json(
        { error: 'Product not found or not approved' },
        { status: 404 }
      );
    }

    console.log(`[API storefront/products/${id}] Base product found:`, JSON.stringify(product, null, 2));

    let variants = [];
    if (isCJProduct) {
      if (product.variants_json && Array.isArray(product.variants_json)) {
        variants = product.variants_json;
      }
    } else {
      const variantsQuery = `
        SELECT 
          id,
          COALESCE(name_override, 'Default Variant') as name,
          sku,
          price,
          image_url,
          stock_quantity as stock,
          attributes
        FROM public.product_variants
        WHERE product_id = $1
        ORDER BY id
      `;
      const variantsResult = await client.query(variantsQuery, [product.id]);
      variants = variantsResult.rows;
    }

    console.log(`[API storefront/products/${id}] Found ${variants.length} variants`);

    let parsedImageUrls: string[] = [];
    let mainImageUrl: string | undefined = undefined;

    if (isCJProduct && typeof product.display_image_url === 'string') {
      try {
        const images = JSON.parse(product.display_image_url);
        if (Array.isArray(images) && images.length > 0) {
          parsedImageUrls = images.filter((img): img is string => typeof img === 'string' && img.trim() !== '');
          if (parsedImageUrls.length > 0) {
            mainImageUrl = parsedImageUrls[0];
          }
        }
      } catch (e) {
        console.error(`[API storefront/products/${id}] Failed to parse CJ product display_image_url: ${product.display_image_url}`, e);
      }
    } else if (!isCJProduct && typeof product.display_image_url === 'string') {
      mainImageUrl = product.display_image_url;
    }

    const responseProduct = {
      id: String(product.id),
      name: product.name,
      description: product.description || '',
      category: product.category_name || 'Uncategorized',
      imageUrl: mainImageUrl || 'https://placehold.co/600x400',
      price: parseFloat(String(product.display_price)) || 0,
      additionalImages: parsedImageUrls.slice(1),
      variants: variants.map((v: any) => {
        let attributes: Record<string, string> = {};

        if (isCJProduct) {
          // CJ Product Variant Attributes from variantProperty first, then variantKey as fallback
          if (v.variantProperty && typeof v.variantProperty === 'string' && v.variantProperty !== "[]") {
            try {
              const props = JSON.parse(v.variantProperty);
              if (Array.isArray(props)) {
                props.forEach(prop => {
                  if (prop && typeof prop.attrName === 'string' && prop.attrName.trim() !== '' && 
                      (typeof prop.attrValue === 'string' || typeof prop.attrValue === 'number')) {
                    attributes[String(prop.attrName).toLowerCase().trim().replace(/\s+/g, '_')] = String(prop.attrValue);
                  }
                });
              }
            } catch (e) { 
              console.warn(`[API storefront/products/${id}] Failed to parse CJ variantProperty: ${v.variantProperty}. Falling back to variantKey.`, e);
            }
          }
          // Fallback or supplement with variantKey if attributes are still empty or need more info
          // This part is heuristic and depends on the structure of variantKey (e.g. "Color-Size")
          if (Object.keys(attributes).length === 0 && v.variantKey) {
             const keyParts = String(v.variantKey).split('-');
             // Assign based on typical CJ patterns, e.g. Color, Size. These keys are examples.
             if (keyParts.length > 0 && keyParts[0]) attributes['color'] = keyParts[0]; 
             if (keyParts.length > 1 && keyParts[1]) attributes['size'] = keyParts[1];
             if (keyParts.length > 2 && keyParts[2]) attributes['material'] = keyParts[2];
          }
        } else {
          // Non-CJ Product Variant Attributes
          if (v.attributes && typeof v.attributes === 'object') {
            for (const key in v.attributes) {
                if (Object.prototype.hasOwnProperty.call(v.attributes, key)) {
                    attributes[key] = String(v.attributes[key]);
                }
            }
          } else if (typeof v.attributes === 'string') {
            try {
              const parsedAttrs = JSON.parse(v.attributes);
              if (typeof parsedAttrs === 'object' && parsedAttrs !== null) {
                for (const key in parsedAttrs) {
                    if (Object.prototype.hasOwnProperty.call(parsedAttrs, key)) {
                        attributes[key] = String(parsedAttrs[key]);
                    }
                }
              }
            } catch (e) { console.warn(`[API storefront/products/${id}] Failed to parse non-CJ variant attributes: ${v.attributes}`, e); }
          }
        }

        const variantImageUrl = isCJProduct ? v.variantImage : v.image_url;
        const variantPrice = isCJProduct ? v.variantSellPrice : v.price;
        const variantSku = isCJProduct ? v.variantSku : v.sku;
        const variantStock = isCJProduct ? v.inventoryNum : v.stock_quantity;

        return {
          id: String(isCJProduct ? v.vid : v.id),
          name: String(isCJProduct ? (v.variantNameEn || v.variantKey) : (v.name || `Variant ${v.id}`)),
          sku: variantSku ? String(variantSku) : undefined,
          price: variantPrice !== undefined && variantPrice !== null ? parseFloat(String(variantPrice)) : undefined,
          imageUrl: variantImageUrl ? String(variantImageUrl) : undefined,
          stock_quantity: variantStock !== undefined && variantStock !== null ? parseInt(String(variantStock), 10) : undefined,
          attributes: attributes,
        };
      }),
      isCJProduct
    };

    console.log(`[API storefront/products/${id}] Response constructed successfully`);
    // Wrap the product data in a 'product' property to match what the frontend expects
    return NextResponse.json({ product: responseProduct });

  } catch (error: any) {
    console.error(`[API storefront/products/${id}] Error fetching storefront product details:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch product details', details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
      console.log(`[API storefront/products/${id}] DB client released`);
    }
  }
}
