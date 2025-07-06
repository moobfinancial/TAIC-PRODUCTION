#!/usr/bin/env node

/**
 * Security Migration Runner
 * Runs the comprehensive security and compliance system migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runSecurityMigration() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  });

  let client;
  try {
    client = await pool.connect();
    console.log('Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '20250706180000_comprehensive_security_compliance_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running comprehensive security and compliance system migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Security and compliance system migration completed successfully!');
    
    // Verify the migration by checking if tables exist
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'security_events',
        'compliance_rules',
        'compliance_violations',
        'comprehensive_audit_trail',
        'security_policies',
        'threat_intelligence',
        'data_classification',
        'security_incidents',
        'compliance_reports',
        'user_access_logs'
      )
      ORDER BY table_name;
    `;
    
    const result = await client.query(tableCheckQuery);
    console.log('\n📊 Security tables created:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Check if views exist
    const viewCheckQuery = `
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'security_dashboard_summary',
        'compliance_dashboard_summary',
        'threat_intelligence_summary',
        'recent_security_activity'
      )
      ORDER BY table_name;
    `;
    
    const viewResult = await client.query(viewCheckQuery);
    console.log('\n📈 Security views created:');
    viewResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Check if functions exist
    const functionCheckQuery = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN (
        'calculate_security_score',
        'generate_compliance_report_data'
      )
      ORDER BY routine_name;
    `;
    
    const functionResult = await client.query(functionCheckQuery);
    console.log('\n⚙️ Security functions created:');
    functionResult.rows.forEach(row => {
      console.log(`  ✓ ${row.routine_name}`);
    });
    
    // Test security score calculation
    try {
      const scoreResult = await client.query('SELECT calculate_security_score() as security_score');
      console.log(`\n🛡️ Current security score: ${scoreResult.rows[0].security_score}/100`);
    } catch (error) {
      console.log('\n⚠️ Security score calculation not available (expected in fresh installation)');
    }
    
    console.log('\n🎉 Comprehensive Security and Compliance System is ready!');
    console.log('\nFeatures available:');
    console.log('  • Real-time security event monitoring');
    console.log('  • Automated compliance rule enforcement');
    console.log('  • Comprehensive audit trail logging');
    console.log('  • Threat intelligence tracking');
    console.log('  • Security incident management');
    console.log('  • Regulatory compliance reporting');
    console.log('  • Data classification and protection');
    console.log('  • Security policy management');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nThis is expected if PostgreSQL is not available.');
    console.log('\n📝 To run this migration in production:');
    console.log('1. Ensure PostgreSQL is running and accessible');
    console.log('2. Set DATABASE_URL or POSTGRES_URL environment variable');
    console.log('3. Run: node scripts/run-security-migration.js');
    console.log('4. Or execute the SQL file directly with psql');
    
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  runSecurityMigration().catch(console.error);
}

module.exports = { runSecurityMigration };
