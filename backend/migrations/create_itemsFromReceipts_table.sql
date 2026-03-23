-- Create table for Items From Receipts
-- This table stores receipt item records
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS items_from_receipts CASCADE;

-- Create the items from receipts table
CREATE TABLE IF NOT EXISTS items_from_receipts (
    id SERIAL PRIMARY KEY,
    date_created TIMESTAMP WITH TIME ZONE,
    document_number TEXT,
    item TEXT,
    quantity TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_items_receipts_document_number ON items_from_receipts(document_number);
CREATE INDEX IF NOT EXISTS idx_items_receipts_item ON items_from_receipts(item);
CREATE INDEX IF NOT EXISTS idx_items_receipts_date_created ON items_from_receipts(date_created);

