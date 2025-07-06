interface ValidationError {
  row: number;
  type: string;
  message: string;
  field?: string;
  value?: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  rowCount: number;
}

export class CSVValidator {
  private requiredHeaders = [
    'product_handle',
    'variant_sku',
    'variant_stock_quantity'
  ];

  private optionalHeaders = [
    'product_name',
    'product_description',
    'product_category',
    'product_base_price',
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

  private validCategories = [
    'Electronics',
    'Clothing',
    'Home & Garden',
    'Sports & Outdoors',
    'Health & Beauty',
    'Books & Media',
    'Toys & Games',
    'Automotive',
    'Food & Beverages',
    'Office Supplies'
  ];

  async validateFile(file: File): Promise<ValidationResult> {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length === 0) {
        return {
          isValid: false,
          errors: [{
            row: 0,
            type: 'EMPTY_FILE',
            message: 'CSV file is empty',
            severity: 'error'
          }],
          warnings: [],
          rowCount: 0
        };
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const errors: ValidationError[] = [];

      // Header validation
      const missingHeaders = this.requiredHeaders.filter(
        header => !headers.includes(header)
      );

      if (missingHeaders.length > 0) {
        errors.push({
          row: 0,
          type: 'MISSING_HEADERS',
          message: `Missing required headers: ${missingHeaders.join(', ')}`,
          severity: 'error'
        });
      }

      // Check for unknown headers
      const unknownHeaders = headers.filter(
        header => !this.requiredHeaders.includes(header) && 
                 !this.optionalHeaders.includes(header) &&
                 header !== ''
      );

      if (unknownHeaders.length > 0) {
        errors.push({
          row: 0,
          type: 'UNKNOWN_HEADERS',
          message: `Unknown headers found: ${unknownHeaders.join(', ')}. These will be ignored.`,
          severity: 'warning'
        });
      }

      // Row validation
      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCSVRow(lines[i]);
        const rowErrors = this.validateRow(row, headers, i + 1);
        errors.push(...rowErrors);
      }

      const errorCount = errors.filter(e => e.severity === 'error').length;
      const warningCount = errors.filter(e => e.severity === 'warning').length;

      return {
        isValid: errorCount === 0,
        errors,
        warnings: errors.filter(e => e.severity === 'warning'),
        rowCount: lines.length - 1
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          row: 0,
          type: 'PARSE_ERROR',
          message: `Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }],
        warnings: [],
        rowCount: 0
      };
    }
  }

  private parseCSVRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private validateRow(row: string[], headers: string[], rowNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const rowData: Record<string, string> = {};

    // Create row data object
    headers.forEach((header, index) => {
      rowData[header] = row[index] || '';
    });

    // Product handle validation
    if (!rowData.product_handle?.trim()) {
      errors.push({
        row: rowNumber,
        type: 'MISSING_PRODUCT_HANDLE',
        message: 'Product handle is required',
        field: 'product_handle',
        severity: 'error'
      });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(rowData.product_handle)) {
      errors.push({
        row: rowNumber,
        type: 'INVALID_PRODUCT_HANDLE',
        message: 'Product handle can only contain letters, numbers, hyphens, and underscores',
        field: 'product_handle',
        value: rowData.product_handle,
        severity: 'error'
      });
    }

    // Variant SKU validation
    if (!rowData.variant_sku?.trim()) {
      errors.push({
        row: rowNumber,
        type: 'MISSING_VARIANT_SKU',
        message: 'Variant SKU is required',
        field: 'variant_sku',
        severity: 'error'
      });
    }

    // Stock quantity validation
    if (!rowData.variant_stock_quantity?.trim()) {
      errors.push({
        row: rowNumber,
        type: 'MISSING_STOCK_QUANTITY',
        message: 'Variant stock quantity is required',
        field: 'variant_stock_quantity',
        severity: 'error'
      });
    } else {
      const stock = parseInt(rowData.variant_stock_quantity);
      if (isNaN(stock) || stock < 0) {
        errors.push({
          row: rowNumber,
          type: 'INVALID_STOCK_QUANTITY',
          message: 'Stock quantity must be a non-negative integer',
          field: 'variant_stock_quantity',
          value: rowData.variant_stock_quantity,
          severity: 'error'
        });
      }
    }

    // Price validation (if provided)
    if (rowData.product_base_price?.trim()) {
      const price = parseFloat(rowData.product_base_price);
      if (isNaN(price) || price < 0) {
        errors.push({
          row: rowNumber,
          type: 'INVALID_PRICE',
          message: 'Product base price must be a positive number',
          field: 'product_base_price',
          value: rowData.product_base_price,
          severity: 'error'
        });
      }
    }

    // Variant specific price validation (if provided)
    if (rowData.variant_specific_price?.trim()) {
      const variantPrice = parseFloat(rowData.variant_specific_price);
      if (isNaN(variantPrice) || variantPrice < 0) {
        errors.push({
          row: rowNumber,
          type: 'INVALID_VARIANT_PRICE',
          message: 'Variant specific price must be a positive number',
          field: 'variant_specific_price',
          value: rowData.variant_specific_price,
          severity: 'error'
        });
      }
    }

    // Category validation (if provided)
    if (rowData.product_category?.trim()) {
      if (!this.validCategories.includes(rowData.product_category)) {
        errors.push({
          row: rowNumber,
          type: 'INVALID_CATEGORY',
          message: `Invalid category. Valid categories: ${this.validCategories.join(', ')}`,
          field: 'product_category',
          value: rowData.product_category,
          severity: 'warning'
        });
      }
    }

    // Cashback percentage validation (if provided)
    if (rowData.cashback_percentage?.trim()) {
      const cashback = parseFloat(rowData.cashback_percentage);
      if (isNaN(cashback) || cashback < 0 || cashback > 99.99) {
        errors.push({
          row: rowNumber,
          type: 'INVALID_CASHBACK',
          message: 'Cashback percentage must be between 0 and 99.99',
          field: 'cashback_percentage',
          value: rowData.cashback_percentage,
          severity: 'error'
        });
      }
    }

    // URL validation (if provided)
    if (rowData.product_image_url?.trim()) {
      if (!this.isValidUrl(rowData.product_image_url)) {
        errors.push({
          row: rowNumber,
          type: 'INVALID_IMAGE_URL',
          message: 'Product image URL is not valid',
          field: 'product_image_url',
          value: rowData.product_image_url,
          severity: 'warning'
        });
      }
    }

    if (rowData.variant_image_url?.trim()) {
      if (!this.isValidUrl(rowData.variant_image_url)) {
        errors.push({
          row: rowNumber,
          type: 'INVALID_VARIANT_IMAGE_URL',
          message: 'Variant image URL is not valid',
          field: 'variant_image_url',
          value: rowData.variant_image_url,
          severity: 'warning'
        });
      }
    }

    // Boolean field validation
    if (rowData.is_active?.trim()) {
      const isActiveValue = rowData.is_active.toUpperCase();
      if (!['TRUE', 'FALSE', '1', '0', 'YES', 'NO'].includes(isActiveValue)) {
        errors.push({
          row: rowNumber,
          type: 'INVALID_BOOLEAN',
          message: 'is_active must be TRUE/FALSE, 1/0, or YES/NO',
          field: 'is_active',
          value: rowData.is_active,
          severity: 'error'
        });
      }
    }

    // Product name validation (if provided)
    if (rowData.product_name?.trim()) {
      if (rowData.product_name.length > 255) {
        errors.push({
          row: rowNumber,
          type: 'PRODUCT_NAME_TOO_LONG',
          message: 'Product name must be 255 characters or less',
          field: 'product_name',
          severity: 'error'
        });
      }
    }

    // Description validation (if provided)
    if (rowData.product_description?.trim()) {
      if (rowData.product_description.length > 5000) {
        errors.push({
          row: rowNumber,
          type: 'DESCRIPTION_TOO_LONG',
          message: 'Product description must be 5000 characters or less',
          field: 'product_description',
          severity: 'warning'
        });
      }
    }

    return errors;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Get validation summary for display
  getValidationSummary(errors: ValidationError[]): {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    criticalIssues: string[];
  } {
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;
    const infoCount = errors.filter(e => e.severity === 'info').length;

    const criticalIssues = errors
      .filter(e => e.severity === 'error')
      .map(e => e.type)
      .filter((type, index, array) => array.indexOf(type) === index)
      .slice(0, 5);

    return {
      errorCount,
      warningCount,
      infoCount,
      criticalIssues
    };
  }
}
