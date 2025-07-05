# TAIC Merchant Ecosystem Database Schema Documentation

## Overview
This document describes the database schema extensions for the TAIC merchant ecosystem, including new tables for merchant wallets, transactions, and payout management, as well as enhancements to existing tables.

## Migration Information
- **Migration File**: `migrations/20250705000000_merchant_ecosystem_schema_extensions.sql`
- **Rollback File**: `migrations/rollback_20250705000000_merchant_ecosystem_schema_extensions.sql`
- **Created**: 2025-07-05
- **Phase**: 1, Item 3 - Database Schema Extensions

## New Tables

### 1. merchant_wallets
Stores merchant crypto wallet addresses and configuration for payouts.

```sql
CREATE TABLE merchant_wallets (
    id SERIAL PRIMARY KEY,
    merchant_id UUID NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    wallet_type VARCHAR(50) NOT NULL DEFAULT 'TAIC_PAYOUT',
    network VARCHAR(50) NOT NULL DEFAULT 'FANTOM',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features**:
- **Foreign Key**: `merchant_id` references `users(id)` with CASCADE delete
- **Unique Constraints**: 
  - `wallet_address` must be unique across all merchants
  - Only one active wallet per merchant per wallet type
- **Supported Networks**: FANTOM, ETHEREUM, BITCOIN, POLYGON, BSC
- **Wallet Types**: TAIC_PAYOUT, ETHEREUM, BITCOIN, OTHER
- **Verification**: Supports wallet verification workflow

**Indexes**:
- `idx_merchant_wallets_merchant_id` - Fast merchant lookup
- `idx_merchant_wallets_wallet_type` - Filter by wallet type
- `idx_merchant_wallets_is_active` - Active wallet queries
- `idx_merchant_wallets_network` - Network-specific queries

### 2. merchant_transactions
Tracks all merchant financial transactions including sales, commissions, payouts, and cashback costs.

```sql
CREATE TABLE merchant_transactions (
    id SERIAL PRIMARY KEY,
    merchant_id UUID NOT NULL,
    order_id INTEGER,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'TAIC',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    description TEXT,
    reference_id VARCHAR(255),
    transaction_hash VARCHAR(255),
    metadata JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Transaction Types**:
- **SALE**: Revenue from product sales (positive amount)
- **COMMISSION**: Platform commission deduction (negative amount)
- **PAYOUT**: Merchant payout (negative amount)
- **CASHBACK_COST**: Customer cashback cost (negative amount)
- **REFUND**: Order refunds (positive/negative based on context)
- **ADJUSTMENT**: Manual adjustments (positive/negative)

**Status Values**:
- **PENDING**: Transaction created but not processed
- **COMPLETED**: Transaction successfully processed
- **FAILED**: Transaction failed to process
- **CANCELLED**: Transaction cancelled
- **PROCESSING**: Transaction currently being processed

**Key Features**:
- **High Precision**: Uses DECIMAL(20, 8) for crypto-accurate amounts
- **Blockchain Integration**: Supports transaction hash tracking
- **Flexible Metadata**: JSONB field for additional transaction data
- **Order Linking**: Optional link to orders table
- **Amount Validation**: Enforces correct sign based on transaction type

**Indexes**:
- `idx_merchant_transactions_merchant_id` - Merchant-specific queries
- `idx_merchant_transactions_type_status` - Composite index for filtering
- `idx_merchant_transactions_created_at` - Time-based queries
- `idx_merchant_transactions_merchant_created` - Merchant timeline queries

### 3. merchant_payout_requests
Manages merchant payout requests and approval workflow.

```sql
CREATE TABLE merchant_payout_requests (
    id SERIAL PRIMARY KEY,
    merchant_id UUID NOT NULL,
    requested_amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'TAIC',
    destination_wallet VARCHAR(255) NOT NULL,
    destination_network VARCHAR(50) NOT NULL DEFAULT 'FANTOM',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    rejection_reason TEXT,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    transaction_hash VARCHAR(255),
    fee_amount DECIMAL(20, 8) DEFAULT 0.00,
    net_amount DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Payout Workflow**:
1. **PENDING**: Merchant submits payout request
2. **APPROVED**: Admin approves the request
3. **PROCESSING**: Payout is being processed
4. **COMPLETED**: Payout successfully sent
5. **REJECTED**: Admin rejects the request
6. **CANCELLED**: Merchant or admin cancels the request

**Key Features**:
- **Admin Approval**: Requires admin approval for payouts
- **Fee Tracking**: Tracks transaction fees and net amounts
- **Audit Trail**: Complete approval and processing timeline
- **Blockchain Integration**: Transaction hash for completed payouts
- **Multi-Network**: Supports different blockchain networks

**Indexes**:
- `idx_merchant_payout_requests_merchant_id` - Merchant payout history
- `idx_merchant_payout_requests_status` - Status-based filtering
- `idx_merchant_payout_requests_approved_by` - Admin activity tracking

## Updated Existing Tables

### users Table Extensions
Added merchant-specific payout configuration columns:

```sql
-- New columns added to users table
ALTER TABLE users 
ADD COLUMN payout_wallet_address VARCHAR(255),
ADD COLUMN payout_schedule VARCHAR(20) DEFAULT 'WEEKLY',
ADD COLUMN minimum_payout_amount DECIMAL(10,2) DEFAULT 50.00;
```

**New Columns**:
- **payout_wallet_address**: Primary wallet for automatic payouts
- **payout_schedule**: DAILY, WEEKLY, or MONTHLY payout frequency
- **minimum_payout_amount**: Minimum amount required for automatic payouts

**Constraints**:
- `payout_schedule` must be one of: DAILY, WEEKLY, MONTHLY
- `minimum_payout_amount` must be >= 0

### products Table Extensions
Added merchant commission and cashback configuration:

```sql
-- New columns added to products table
ALTER TABLE products 
ADD COLUMN merchant_commission_rate DECIMAL(5,2) DEFAULT 5.00,
ADD COLUMN merchant_cashback_cost DECIMAL(10,2) DEFAULT 0.00;
```

**New Columns**:
- **merchant_commission_rate**: Platform commission percentage (0-100%)
- **merchant_cashback_cost**: Cost of customer cashback rewards

**Constraints**:
- `merchant_commission_rate` must be between 0 and 100
- `merchant_cashback_cost` must be >= 0

## Performance Optimizations

### Indexing Strategy
The schema includes comprehensive indexes for optimal query performance:

**Merchant-Specific Queries**:
- Fast lookup of merchant wallets, transactions, and payouts
- Efficient filtering by transaction type and status
- Time-based queries for analytics and reporting

**Admin Queries**:
- Quick access to pending payout requests
- Admin activity tracking and audit trails
- Cross-merchant analytics and reporting

**Financial Calculations**:
- Efficient aggregation of merchant earnings
- Fast calculation of available payout amounts
- Performance-optimized commission and cashback queries

### Data Types
- **DECIMAL(20, 8)**: High-precision financial calculations for crypto amounts
- **DECIMAL(10, 2)**: Standard precision for fiat-equivalent amounts
- **UUID**: Consistent with existing user identification
- **JSONB**: Flexible metadata storage with indexing support
- **TIMESTAMP WITH TIME ZONE**: Proper timezone handling for global operations

## Security Considerations

### Data Integrity
- **Foreign Key Constraints**: Ensure referential integrity
- **Check Constraints**: Validate data ranges and values
- **Unique Constraints**: Prevent duplicate wallet addresses
- **Cascade Deletes**: Proper cleanup when merchants are removed

### Access Control
- **Role-Based Permissions**: Granted to `moobuser` role
- **Sequence Permissions**: Access to auto-increment sequences
- **Admin Separation**: Admin approval workflow for sensitive operations

### Audit Trail
- **Complete Transaction History**: All financial activities tracked
- **Approval Workflow**: Admin actions recorded with timestamps
- **Blockchain Verification**: Transaction hashes for crypto operations
- **Metadata Storage**: Additional context for complex transactions

## Migration Safety

### Backward Compatibility
- **Non-Breaking Changes**: All new columns are nullable or have defaults
- **Existing Data Preserved**: No modifications to existing records
- **Gradual Rollout**: Can be applied without downtime

### Rollback Procedures
- **Complete Rollback Script**: Safe removal of all changes
- **Verification Steps**: Automated checks for successful rollback
- **Data Loss Warning**: Clear warnings about data deletion

### Testing Recommendations
1. **Schema Validation**: Verify all constraints and indexes
2. **Performance Testing**: Test query performance with sample data
3. **Integration Testing**: Verify API compatibility
4. **Rollback Testing**: Test rollback procedures in staging environment

## Usage Examples

### Common Queries

**Get Merchant Financial Summary**:
```sql
SELECT 
    m.merchant_id,
    u.business_name,
    SUM(CASE WHEN transaction_type = 'SALE' THEN amount ELSE 0 END) as total_sales,
    SUM(CASE WHEN transaction_type = 'COMMISSION' THEN amount ELSE 0 END) as total_commissions,
    SUM(CASE WHEN transaction_type = 'PAYOUT' THEN amount ELSE 0 END) as total_payouts,
    SUM(amount) as available_balance
FROM merchant_transactions m
JOIN users u ON m.merchant_id = u.id
WHERE m.status = 'COMPLETED'
GROUP BY m.merchant_id, u.business_name;
```

**Get Pending Payout Requests**:
```sql
SELECT 
    pr.*,
    u.business_name,
    u.email
FROM merchant_payout_requests pr
JOIN users u ON pr.merchant_id = u.id
WHERE pr.status = 'PENDING'
ORDER BY pr.created_at ASC;
```

**Get Merchant Analytics Data**:
```sql
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as transaction_count,
    SUM(CASE WHEN transaction_type = 'SALE' THEN amount ELSE 0 END) as daily_sales
FROM merchant_transactions
WHERE merchant_id = $1 
    AND created_at >= NOW() - INTERVAL '30 days'
    AND status = 'COMPLETED'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date;
```

This schema provides a robust foundation for the TAIC merchant ecosystem with proper financial tracking, payout management, and performance optimization.
