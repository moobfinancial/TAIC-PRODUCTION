import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';

interface TemplateOptions {
  templateType: 'basic' | 'comprehensive' | 'variants-only';
  includeVariants?: boolean;
  includeOptionalFields?: boolean;
  categories?: string[];
  sampleData?: boolean;
}

async function generateTemplate(req: NextRequest, merchantUser: any) {
  try {
    const options: TemplateOptions = await req.json();
    
    // Define column sets based on template type
    const requiredColumns = [
      'product_handle',
      'variant_sku', 
      'variant_stock_quantity'
    ];

    const basicColumns = [
      ...requiredColumns,
      'product_name',
      'product_description',
      'product_base_price',
      'product_category'
    ];

    const comprehensiveColumns = [
      ...basicColumns,
      'product_image_url',
      'variant_specific_price',
      'variant_image_url',
      'variant_attribute_1_name',
      'variant_attribute_1_value',
      'variant_attribute_2_name',
      'variant_attribute_2_value',
      'cashback_percentage',
      'is_active'
    ];

    const variantOnlyColumns = [
      'product_handle',
      'variant_sku',
      'variant_stock_quantity',
      'variant_specific_price',
      'variant_image_url',
      'variant_attribute_1_name',
      'variant_attribute_1_value',
      'variant_attribute_2_name',
      'variant_attribute_2_value'
    ];

    // Select columns based on template type
    let columns: string[];
    switch (options.templateType) {
      case 'basic':
        columns = basicColumns;
        break;
      case 'variants-only':
        columns = variantOnlyColumns;
        break;
      case 'comprehensive':
      default:
        columns = comprehensiveColumns;
        break;
    }

    // Add optional fields if requested
    if (options.includeOptionalFields && options.templateType !== 'comprehensive') {
      const optionalFields = [
        'product_image_url',
        'cashback_percentage',
        'is_active'
      ];
      columns = [...columns, ...optionalFields.filter(field => !columns.includes(field))];
    }

    // Generate CSV content
    let csvContent = columns.join(',') + '\n';

    // Add sample data if requested
    if (options.sampleData) {
      const sampleRows = [
        {
          product_handle: 'wireless-bluetooth-headphones',
          product_name: 'Premium Wireless Bluetooth Headphones',
          product_description: 'High-quality wireless headphones with noise cancellation and 30-hour battery life',
          product_category: 'Electronics',
          product_base_price: '99.99',
          product_image_url: 'https://example.com/images/headphones-main.jpg',
          variant_sku: 'WBH-001-BLACK',
          variant_stock_quantity: '50',
          variant_specific_price: '',
          variant_image_url: 'https://example.com/images/headphones-black.jpg',
          variant_attribute_1_name: 'Color',
          variant_attribute_1_value: 'Black',
          variant_attribute_2_name: 'Size',
          variant_attribute_2_value: 'Standard',
          cashback_percentage: '5.0',
          is_active: 'TRUE'
        },
        {
          product_handle: 'wireless-bluetooth-headphones',
          product_name: '',
          product_description: '',
          product_category: '',
          product_base_price: '',
          product_image_url: '',
          variant_sku: 'WBH-001-WHITE',
          variant_stock_quantity: '30',
          variant_specific_price: '104.99',
          variant_image_url: 'https://example.com/images/headphones-white.jpg',
          variant_attribute_1_name: 'Color',
          variant_attribute_1_value: 'White',
          variant_attribute_2_name: 'Size',
          variant_attribute_2_value: 'Standard',
          cashback_percentage: '',
          is_active: 'TRUE'
        },
        {
          product_handle: 'smart-fitness-tracker',
          product_name: 'Smart Fitness Tracker Watch',
          product_description: 'Advanced fitness tracking with heart rate monitor, GPS, and smartphone integration',
          product_category: 'Electronics',
          product_base_price: '149.99',
          product_image_url: 'https://example.com/images/fitness-tracker-main.jpg',
          variant_sku: 'SFT-002-BLUE',
          variant_stock_quantity: '75',
          variant_specific_price: '',
          variant_image_url: 'https://example.com/images/fitness-tracker-blue.jpg',
          variant_attribute_1_name: 'Color',
          variant_attribute_1_value: 'Blue',
          variant_attribute_2_name: 'Band Size',
          variant_attribute_2_value: 'Medium',
          cashback_percentage: '3.5',
          is_active: 'TRUE'
        }
      ];

      for (const row of sampleRows) {
        const rowData = columns.map(column => {
          const value = row[column as keyof typeof row] || '';
          // Escape commas and quotes in CSV
          if (value.includes(',') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += rowData.join(',') + '\n';
      }
    }

    // Create response with CSV file
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="taic-product-template-${options.templateType}.csv"`,
        'Cache-Control': 'no-cache'
      }
    });

    return response;

  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}

export const POST = withMerchantAuth(generateTemplate);
