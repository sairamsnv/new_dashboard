-- Add purchaseCreated column to totalOrdersReceived table
-- This script adds a new column to store purchase creation date

-- Add the purchaseCreated column
-- Using DATE type to match the existing createdDate field
ALTER TABLE dashboard_totalordersreceived 
ADD COLUMN IF NOT EXISTS "purchaseCreated" DATE;

-- Alternative: If you want it as TIMESTAMP instead of DATE, use this:
-- ALTER TABLE dashboard_totalordersreceived 
-- ADD COLUMN IF NOT EXISTS "purchaseCreated" TIMESTAMP WITH TIME ZONE;

-- If the table name is different (check your database), use one of these:
-- ALTER TABLE totalordersreceived ADD COLUMN IF NOT EXISTS "purchaseCreated" DATE;
-- ALTER TABLE total_orders_received ADD COLUMN IF NOT EXISTS "purchaseCreated" DATE;

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'dashboard_totalordersreceived'
    AND column_name = 'purchaseCreated';

