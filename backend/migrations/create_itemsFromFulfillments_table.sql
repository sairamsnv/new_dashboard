-- Create table for Items From Fulfillments
-- This table stores fulfillment item records
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS items_from_fulfillments CASCADE;

-- Create the items from fulfillments table
CREATE TABLE IF NOT EXISTS items_from_fulfillments (
    id SERIAL PRIMARY KEY,
    date_created TIMESTAMP WITH TIME ZONE,
    document_number TEXT,
    item TEXT,
    quantity TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_items_fulfillments_document_number ON items_from_fulfillments(document_number);
CREATE INDEX IF NOT EXISTS idx_items_fulfillments_item ON items_from_fulfillments(item);
CREATE INDEX IF NOT EXISTS idx_items_fulfillments_date_created ON items_from_fulfillments(date_created);

