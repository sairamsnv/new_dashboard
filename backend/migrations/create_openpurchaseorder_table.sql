-- Create OpenPurchaseOrder table
-- This table stores open purchase orders
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS dashboard_openpurchaseorder CASCADE;

-- Create the OpenPurchaseOrder table
CREATE TABLE IF NOT EXISTS dashboard_openpurchaseorder (
    id BIGSERIAL PRIMARY KEY,
    "tranId" TEXT UNIQUE NOT NULL,
    "createdFrom" TEXT,
    location TEXT NOT NULL,
    vendor TEXT NOT NULL,
    "tranDate" DATE NOT NULL,
    memo TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_openpurchaseorder_tranid ON dashboard_openpurchaseorder("tranId");
CREATE INDEX IF NOT EXISTS idx_openpurchaseorder_vendor ON dashboard_openpurchaseorder(vendor);
CREATE INDEX IF NOT EXISTS idx_openpurchaseorder_location ON dashboard_openpurchaseorder(location);
CREATE INDEX IF NOT EXISTS idx_openpurchaseorder_trandate ON dashboard_openpurchaseorder("tranDate");

-- Add comments for documentation
COMMENT ON TABLE dashboard_openpurchaseorder IS 'Stores open purchase orders';
COMMENT ON COLUMN dashboard_openpurchaseorder."tranId" IS 'Transaction ID (unique identifier)';
COMMENT ON COLUMN dashboard_openpurchaseorder."createdFrom" IS 'Source document that created this order';
COMMENT ON COLUMN dashboard_openpurchaseorder.location IS 'Location of the purchase order';
COMMENT ON COLUMN dashboard_openpurchaseorder.vendor IS 'Vendor/supplier name';
COMMENT ON COLUMN dashboard_openpurchaseorder."tranDate" IS 'Transaction date';
COMMENT ON COLUMN dashboard_openpurchaseorder.memo IS 'Memo/notes for the order';

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'dashboard_openpurchaseorder'
ORDER BY ordinal_position;

