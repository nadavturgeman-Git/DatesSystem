# Test Scenarios Execution Instructions

## Prerequisites

1. **Database Connection**: Ensure your `.env` file contains:
   ```
   DATABASE_URL=your_postgres_connection_string
   ```

2. **Database Setup**: Make sure your database is set up with:
   - At least one warehouse named "Baqaa Warehouse" (freezing type)
   - At least one warehouse with "Jerusalem" in the name (cooling type)
   - At least one active product
   - At least one admin user
   - At least one distributor user
   - At least one team leader user (optional, for Scenario 3)

## Running the Tests

### Option 1: Using npm script
```bash
npm run test:scenarios
```

### Option 2: Using tsx directly
```bash
npx tsx test-scenarios.ts
```

## What the Tests Do

The test script will:

1. **Scenario 1**: Test FIFO inventory accuracy
   - Creates 3 pallets with different entry dates
   - Places an order for 1.5 pallets
   - Verifies available stock decreases but physical stock doesn't
   - Generates loading sheet and verifies FIFO selection
   - Approves loading and verifies physical stock decreases

2. **Scenario 2**: Test Cash & Paybox hybrid model
   - Creates a distributor with Cash_Paybox employment model
   - Places an order and verifies Paybox link is displayed
   - Marks order as paid and verifies status updates

3. **Scenario 3**: Test aggregated commission logic
   - Creates a sales cycle
   - Creates 3 orders of 20kg each (total 60kg)
   - Verifies commission is calculated at 17% tier (not 15% per order)
   - Verifies team leader commission at 5%

4. **Scenario 4**: Test logistics & notifications
   - Creates an order below 50kg threshold
   - Verifies 50kg rule alert is generated
   - Marks stock as received and verifies notifications

5. **Scenario 5**: Test freshness alerts
   - Creates a fresh fruit pallet in Jerusalem warehouse (10 days old)
   - Verifies spoilage warning alert is generated

## Test Report

After execution, a detailed report will be:
- Displayed in the console
- Written to `test-report.md` in the project root

## Cleanup

The test script creates test data with prefixes:
- Pallets: `TEST-PLT-*`, `TEST-FRESH-*`
- Orders: `TEST-ORD-*`
- Sales Cycles: `Test Cycle *`

You may want to clean up this test data after running the tests.

## Troubleshooting

### Database Connection Error
- Verify `DATABASE_URL` is set correctly in `.env`
- Ensure database is accessible

### Missing Data Error
- Ensure required test data exists (warehouses, products, users)
- Check that warehouse names match exactly: "Baqaa Warehouse" and "Jerusalem Warehouse" (or similar)

### Permission Errors
- Ensure database user has INSERT, UPDATE, SELECT permissions
- Check RLS policies if using Supabase
