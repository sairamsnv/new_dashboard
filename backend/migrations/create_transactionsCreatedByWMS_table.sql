-- Create table for Transactions Created By WMS
-- This table stores transactions created by WMS system
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS transactions_created_by_wms CASCADE;

-- Create the transactions created by WMS table
CREATE TABLE IF NOT EXISTS transactions_created_by_wms (
    id SERIAL PRIMARY KEY,
    type TEXT,
    document_number TEXT UNIQUE NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_wms_document_number ON transactions_created_by_wms(document_number);
CREATE INDEX IF NOT EXISTS idx_transactions_wms_type ON transactions_created_by_wms(type);
CREATE INDEX IF NOT EXISTS idx_transactions_wms_date_created ON transactions_created_by_wms(date_created);

