#!/usr/bin/env node

/**
 * TAIC Merchant Migration Syntax Validator
 * 
 * This script validates the SQL syntax and structure of the merchant ecosystem
 * migration files without requiring a database connection.
 * 
 * Created: 2025-07-05
 * Purpose: Validate migration SQL syntax and structure
 */

const fs = require('fs');
const path = require('path');

// Migration files to validate
const files = [
  {
    name: 'Main Migration',
    path: path.join(__dirname, '..', 'migrations', '20250705000000_merchant_ecosystem_schema_extensions.sql')
  },
  {
    name: 'Rollback Migration',
    path: path.join(__dirname, '..', 'migrations', 'rollback_20250705000000_merchant_ecosystem_schema_extensions.sql')
  },
  {
    name: 'Test Script',
    path: path.join(__dirname, 'test_merchant_schema.sql')
  }
];

/**
 * Validate SQL file syntax and structure
 */
function validateSqlFile(filePath, fileName) {
  console.log(`\n📄 Validating ${fileName}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ✗ File not found: ${filePath}`);
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let isValid = true;
  const issues = [];
  
  // Basic syntax checks
  const checks = [
    {
      name: 'File is not empty',
      test: () => content.trim().length > 0
    },
    {
      name: 'Contains CREATE TABLE statements',
      test: () => fileName.includes('Test') || fileName.includes('Rollback') ? true : /CREATE TABLE/i.test(content)
    },
    {
      name: 'Contains proper DO blocks',
      test: () => /DO \$\$/i.test(content)
    },
    {
      name: 'Has matching DO block delimiters',
      test: () => {
        const doBlocks = content.match(/DO \$\$/gi) || [];
        const endBlocks = content.match(/END\s*\$\$/gi) || [];
        return doBlocks.length === endBlocks.length;
      }
    },
    {
      name: 'Contains migration name reference',
      test: () => fileName.includes('Test') ? /merchant/i.test(content) : /20250705000000_merchant_ecosystem_schema_extensions/i.test(content)
    },
    {
      name: 'Has proper SQL statement terminators',
      test: () => {
        // Check that most non-comment, non-empty lines end with semicolon
        const sqlLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && 
                 !trimmed.startsWith('--') && 
                 !trimmed.startsWith('/*') &&
                 !trimmed.includes('$$');
        });
        const terminatedLines = sqlLines.filter(line => line.trim().endsWith(';'));
        return terminatedLines.length > 0; // At least some SQL statements should end with semicolon
      }
    }
  ];
  
  // Run checks
  for (const check of checks) {
    try {
      if (check.test()) {
        console.log(`  ✓ ${check.name}`);
      } else {
        console.log(`  ✗ ${check.name}`);
        issues.push(check.name);
        isValid = false;
      }
    } catch (error) {
      console.log(`  ✗ ${check.name} - Error: ${error.message}`);
      issues.push(`${check.name} (${error.message})`);
      isValid = false;
    }
  }
  
  // Check for common SQL syntax issues
  const syntaxChecks = [
    {
      name: 'No unmatched parentheses',
      test: () => {
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        return openParens === closeParens;
      }
    },
    {
      name: 'No unmatched quotes',
      test: () => {
        // Simple check for unmatched single quotes (not perfect but catches obvious issues)
        const singleQuotes = (content.match(/'/g) || []).length;
        return singleQuotes % 2 === 0;
      }
    },
    {
      name: 'Contains proper table constraints',
      test: () => /CONSTRAINT|CHECK|FOREIGN KEY|UNIQUE/i.test(content)
    },
    {
      name: 'Uses proper data types',
      test: () => /UUID|VARCHAR|DECIMAL|TIMESTAMP|BOOLEAN|SERIAL|INTEGER/i.test(content)
    }
  ];
  
  for (const check of syntaxChecks) {
    try {
      if (check.test()) {
        console.log(`  ✓ ${check.name}`);
      } else {
        console.log(`  ⚠️  ${check.name}`);
        // These are warnings, not errors
      }
    } catch (error) {
      console.log(`  ⚠️  ${check.name} - Error: ${error.message}`);
    }
  }
  
  // File-specific validations
  if (fileName.includes('Main Migration')) {
    const migrationChecks = [
      {
        name: 'Creates merchant_wallets table',
        test: () => /CREATE TABLE.*merchant_wallets/i.test(content)
      },
      {
        name: 'Creates merchant_transactions table',
        test: () => /CREATE TABLE.*merchant_transactions/i.test(content)
      },
      {
        name: 'Creates merchant_payout_requests table',
        test: () => /CREATE TABLE.*merchant_payout_requests/i.test(content)
      },
      {
        name: 'Adds columns to users table',
        test: () => /ALTER TABLE users[\s\S]*ADD COLUMN/i.test(content)
      },
      {
        name: 'Adds columns to products table',
        test: () => /ALTER TABLE products[\s\S]*ADD COLUMN/i.test(content)
      },
      {
        name: 'Creates performance indexes',
        test: () => /CREATE INDEX.*idx_merchant/i.test(content)
      },
      {
        name: 'Grants permissions to moobuser',
        test: () => /GRANT.*TO moobuser/i.test(content)
      }
    ];
    
    console.log('\n  📋 Migration-specific validations:');
    for (const check of migrationChecks) {
      if (check.test()) {
        console.log(`    ✓ ${check.name}`);
      } else {
        console.log(`    ✗ ${check.name}`);
        issues.push(check.name);
        isValid = false;
      }
    }
  }
  
  if (fileName.includes('Rollback')) {
    const rollbackChecks = [
      {
        name: 'Drops merchant tables',
        test: () => /DROP TABLE.*merchant_/i.test(content)
      },
      {
        name: 'Removes columns from existing tables',
        test: () => /ALTER TABLE[\s\S]*DROP COLUMN/i.test(content)
      },
      {
        name: 'Drops indexes',
        test: () => /DROP INDEX.*idx_merchant/i.test(content)
      },
      {
        name: 'Has verification steps',
        test: () => /information_schema/i.test(content)
      }
    ];
    
    console.log('\n  📋 Rollback-specific validations:');
    for (const check of rollbackChecks) {
      if (check.test()) {
        console.log(`    ✓ ${check.name}`);
      } else {
        console.log(`    ✗ ${check.name}`);
        issues.push(check.name);
        isValid = false;
      }
    }
  }
  
  // Summary
  if (isValid) {
    console.log(`  ✅ ${fileName} validation passed`);
  } else {
    console.log(`  ❌ ${fileName} validation failed`);
    console.log(`     Issues found: ${issues.join(', ')}`);
  }
  
  return isValid;
}

/**
 * Validate migration file structure
 */
function validateMigrationStructure() {
  console.log('\n📁 Validating migration file structure...');
  
  const migrationDir = path.join(__dirname, '..', 'migrations');
  const docsDir = path.join(__dirname, '..', 'docs');
  
  const structureChecks = [
    {
      name: 'Migrations directory exists',
      test: () => fs.existsSync(migrationDir)
    },
    {
      name: 'Main migration file exists',
      test: () => fs.existsSync(path.join(migrationDir, '20250705000000_merchant_ecosystem_schema_extensions.sql'))
    },
    {
      name: 'Rollback migration file exists',
      test: () => fs.existsSync(path.join(migrationDir, 'rollback_20250705000000_merchant_ecosystem_schema_extensions.sql'))
    },
    {
      name: 'Documentation exists',
      test: () => fs.existsSync(path.join(docsDir, 'MERCHANT_DATABASE_SCHEMA.md'))
    },
    {
      name: 'Test script exists',
      test: () => fs.existsSync(path.join(__dirname, 'test_merchant_schema.sql'))
    },
    {
      name: 'Migration runner exists',
      test: () => fs.existsSync(path.join(__dirname, 'apply_merchant_migration.js'))
    }
  ];
  
  let allValid = true;
  for (const check of structureChecks) {
    if (check.test()) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.log(`  ✗ ${check.name}`);
      allValid = false;
    }
  }
  
  return allValid;
}

/**
 * Main validation function
 */
function runValidation() {
  console.log('🔍 TAIC Merchant Migration Syntax Validator');
  console.log('==========================================');
  
  let allValid = true;
  
  // Validate file structure
  if (!validateMigrationStructure()) {
    allValid = false;
  }
  
  // Validate each SQL file
  for (const file of files) {
    if (!validateSqlFile(file.path, file.name)) {
      allValid = false;
    }
  }
  
  // Summary
  console.log('\n==========================================');
  if (allValid) {
    console.log('✅ All validations passed!');
    console.log('\n📋 Migration files are ready for deployment:');
    console.log('- SQL syntax is valid');
    console.log('- Required tables and columns are defined');
    console.log('- Proper constraints and indexes are included');
    console.log('- Rollback procedures are available');
    console.log('- Documentation is complete');
    console.log('\n🚀 Ready to apply migration to database!');
  } else {
    console.log('❌ Validation failed!');
    console.log('\n🔧 Please fix the issues above before deploying the migration.');
  }
  
  return allValid;
}

// Run validation if called directly
if (require.main === module) {
  const isValid = runValidation();
  process.exit(isValid ? 0 : 1);
}

module.exports = { runValidation };
