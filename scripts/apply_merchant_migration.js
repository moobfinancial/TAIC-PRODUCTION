#!/usr/bin/env node

/**
 * TAIC Merchant Ecosystem Migration Runner
 * 
 * This script safely applies the merchant ecosystem schema extensions
 * with proper error handling, validation, and rollback capabilities.
 * 
 * Created: 2025-07-05
 * Phase: 1, Item 3 - Database Schema Extensions
 * 
 * Usage:
 *   node scripts/apply_merchant_migration.js [--dry-run] [--rollback]
 * 
 * Options:
 *   --dry-run   : Show what would be done without applying changes
 *   --rollback  : Rollback the migration instead of applying it
 *   --force     : Skip confirmation prompts (use with caution)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'moobfinancial',
  user: process.env.DB_USER || 'moobuser',
  password: process.env.DB_PASSWORD || 'userfortaicweb',
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isRollback = args.includes('--rollback');
const isForce = args.includes('--force');

// Migration files
const migrationFile = path.join(__dirname, '..', 'migrations', '20250705000000_merchant_ecosystem_schema_extensions.sql');
const rollbackFile = path.join(__dirname, '..', 'migrations', 'rollback_20250705000000_merchant_ecosystem_schema_extensions.sql');
const testFile = path.join(__dirname, 'test_merchant_schema.sql');

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Ask user for confirmation
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = createReadlineInterface();
    rl.question(question + ' (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Connect to database
 */
async function connectToDatabase() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('✓ Connected to database successfully');
    return client;
  } catch (error) {
    console.error('✗ Failed to connect to database:', error.message);
    throw error;
  }
}

/**
 * Check if migration has already been applied
 */
async function checkMigrationStatus(client) {
  try {
    const result = await client.query(
      "SELECT 1 FROM migrations WHERE name = '20250705000000_merchant_ecosystem_schema_extensions'"
    );
    return result.rows.length > 0;
  } catch (error) {
    // If migrations table doesn't exist, migration hasn't been applied
    if (error.message.includes('relation "migrations" does not exist')) {
      return false;
    }
    throw error;
  }
}

/**
 * Validate database prerequisites
 */
async function validatePrerequisites(client) {
  console.log('\n📋 Validating database prerequisites...');
  
  const checks = [
    {
      name: 'users table exists',
      query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"
    },
    {
      name: 'products table exists',
      query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'products'"
    },
    {
      name: 'orders table exists',
      query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'orders'"
    },
    {
      name: 'users.id is UUID type',
      query: "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id' AND data_type = 'uuid'"
    }
  ];
  
  for (const check of checks) {
    try {
      const result = await client.query(check.query);
      if (result.rows.length > 0) {
        console.log(`  ✓ ${check.name}`);
      } else {
        console.log(`  ✗ ${check.name}`);
        throw new Error(`Prerequisite failed: ${check.name}`);
      }
    } catch (error) {
      console.log(`  ✗ ${check.name} - ${error.message}`);
      throw new Error(`Prerequisite validation failed: ${check.name}`);
    }
  }
  
  console.log('✓ All prerequisites validated');
}

/**
 * Read and execute SQL file
 */
async function executeSqlFile(client, filePath, description) {
  console.log(`\n📄 ${description}...`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN - SQL that would be executed:');
    console.log('----------------------------------------');
    console.log(sql.substring(0, 500) + (sql.length > 500 ? '...\n[truncated]' : ''));
    console.log('----------------------------------------');
    return;
  }
  
  try {
    await client.query(sql);
    console.log(`✓ ${description} completed successfully`);
  } catch (error) {
    console.error(`✗ ${description} failed:`, error.message);
    throw error;
  }
}

/**
 * Create database backup (logical)
 */
async function createBackup() {
  if (isDryRun) {
    console.log('🔍 DRY RUN - Would create database backup');
    return;
  }
  
  console.log('\n💾 Creating database backup...');
  const { execSync } = require('child_process');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `backup_before_merchant_migration_${timestamp}.sql`;
  
  try {
    execSync(`pg_dump -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} > ${backupFile}`, {
      env: { ...process.env, PGPASSWORD: config.password }
    });
    console.log(`✓ Database backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.log('⚠️  Backup creation failed, but continuing with migration...');
    console.log('   Make sure you have a recent backup before proceeding!');
    return null;
  }
}

/**
 * Run post-migration tests
 */
async function runTests(client) {
  console.log('\n🧪 Running post-migration tests...');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN - Would run schema validation tests');
    return;
  }
  
  try {
    // Run basic schema validation
    const tables = ['merchant_wallets', 'merchant_transactions', 'merchant_payout_requests'];
    for (const table of tables) {
      const result = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [table]
      );
      if (result.rows.length === 0) {
        throw new Error(`Table ${table} was not created`);
      }
    }
    
    // Check new columns
    const columns = [
      { table: 'users', column: 'payout_wallet_address' },
      { table: 'products', column: 'merchant_commission_rate' }
    ];
    
    for (const col of columns) {
      const result = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [col.table, col.column]
      );
      if (result.rows.length === 0) {
        throw new Error(`Column ${col.table}.${col.column} was not created`);
      }
    }
    
    console.log('✓ All post-migration tests passed');
  } catch (error) {
    console.error('✗ Post-migration tests failed:', error.message);
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 TAIC Merchant Ecosystem Migration Runner');
  console.log('==========================================');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be applied');
  }
  
  if (isRollback) {
    console.log('⏪ ROLLBACK MODE - Migration will be reversed');
  }
  
  let client;
  
  try {
    // Connect to database
    client = await connectToDatabase();
    
    // Check migration status
    const isApplied = await checkMigrationStatus(client);
    
    if (isRollback) {
      if (!isApplied) {
        console.log('ℹ️  Migration has not been applied, nothing to rollback');
        return;
      }
      
      if (!isForce) {
        const confirmed = await askConfirmation(
          '⚠️  WARNING: This will permanently delete all merchant financial data!\n' +
          'Are you sure you want to rollback the merchant ecosystem migration?'
        );
        if (!confirmed) {
          console.log('❌ Rollback cancelled by user');
          return;
        }
      }
      
      await executeSqlFile(client, rollbackFile, 'Executing rollback migration');
      console.log('\n✅ Migration rollback completed successfully!');
      return;
    }
    
    // Forward migration
    if (isApplied) {
      console.log('ℹ️  Migration has already been applied');
      return;
    }
    
    // Validate prerequisites
    await validatePrerequisites(client);
    
    // Create backup
    const backupFile = await createBackup();
    
    // Confirm migration
    if (!isForce && !isDryRun) {
      console.log('\n📋 Migration Summary:');
      console.log('- Will create 3 new tables: merchant_wallets, merchant_transactions, merchant_payout_requests');
      console.log('- Will add columns to existing users and products tables');
      console.log('- Will create performance indexes and constraints');
      console.log('- Will grant permissions to moobuser role');
      
      if (backupFile) {
        console.log(`- Database backup created: ${backupFile}`);
      }
      
      const confirmed = await askConfirmation('\nProceed with migration?');
      if (!confirmed) {
        console.log('❌ Migration cancelled by user');
        return;
      }
    }
    
    // Execute migration
    await executeSqlFile(client, migrationFile, 'Executing merchant ecosystem migration');
    
    // Run tests
    await runTests(client);
    
    console.log('\n✅ Merchant ecosystem migration completed successfully!');
    console.log('\n📊 New capabilities enabled:');
    console.log('- Merchant crypto wallet management');
    console.log('- Comprehensive transaction tracking');
    console.log('- Automated payout request workflow');
    console.log('- Enhanced merchant analytics support');
    console.log('- Performance-optimized financial queries');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check database connection settings');
    console.error('2. Ensure you have sufficient database privileges');
    console.error('3. Verify all prerequisite tables exist');
    console.error('4. Check the migration logs above for specific errors');
    
    if (!isDryRun) {
      console.error('\n⚠️  If the migration partially completed, you may need to:');
      console.error('1. Run the rollback script to clean up');
      console.error('2. Restore from backup if available');
      console.error('3. Contact the development team for assistance');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the migration
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration };
