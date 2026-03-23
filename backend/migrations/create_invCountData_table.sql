-- Create table for Inventory Count Data
-- This table stores inventory count data with nested items
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS inventory_count_items CASCADE;
-- DROP TABLE IF EXISTS inventory_count_data CASCADE;

-- Create the main inventory count data table
CREATE TABLE IF NOT EXISTS inventory_count_data (
    id SERIAL PRIMARY KEY,
    document_number TEXT UNIQUE NOT NULL,  -- e.g., '2'
    status TEXT,  -- e.g., 'Approved'
    date_created TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the inventory count items table (for the items array)
CREATE TABLE IF NOT EXISTS inventory_count_items (
    id SERIAL PRIMARY KEY,
    inventory_count_id INTEGER NOT NULL REFERENCES inventory_count_data(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    bin_number TEXT,  -- e.g., '- None -' or actual bin number
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inv_count_data_document_number ON inventory_count_data(document_number);
CREATE INDEX IF NOT EXISTS idx_inv_count_data_status ON inventory_count_data(status);
CREATE INDEX IF NOT EXISTS idx_inv_count_data_date_created ON inventory_count_data(date_created);
CREATE INDEX IF NOT EXISTS idx_inv_count_data_created_by ON inventory_count_data(created_by);
CREATE INDEX IF NOT EXISTS idx_inv_count_items_count_id ON inventory_count_items(inventory_count_id);
CREATE INDEX IF NOT EXISTS idx_inv_count_items_item ON inventory_count_items(item);
CREATE INDEX IF NOT EXISTS idx_inv_count_items_bin_number ON inventory_count_items(bin_number);

-- Add comments for documentation
COMMENT ON TABLE inventory_count_data IS 'Stores inventory count data records';
COMMENT ON TABLE inventory_count_items IS 'Stores items associated with inventory counts (one-to-many relationship)';
COMMENT ON COLUMN inventory_count_data.document_number IS 'Unique document number for the inventory count (e.g., 2)';
COMMENT ON COLUMN inventory_count_data.status IS 'Status of the inventory count (e.g., Approved)';
COMMENT ON COLUMN inventory_count_data.date_created IS 'Date when the count was created';
COMMENT ON COLUMN inventory_count_data.created_by IS 'User who created the count';
COMMENT ON COLUMN inventory_count_items.item IS 'Item name in the count';
COMMENT ON COLUMN inventory_count_items.bin_number IS 'Bin number for the item (e.g., - None -)';

-- Create functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inv_count_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_inv_count_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_inv_count_data_updated_at ON inventory_count_data;
CREATE TRIGGER trigger_update_inv_count_data_updated_at
    BEFORE UPDATE ON inventory_count_data
    FOR EACH ROW
    EXECUTE FUNCTION update_inv_count_data_updated_at();

DROP TRIGGER IF EXISTS trigger_update_inv_count_items_updated_at ON inventory_count_items;
CREATE TRIGGER trigger_update_inv_count_items_updated_at
    BEFORE UPDATE ON inventory_count_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inv_count_items_updated_at();

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name IN ('inventory_count_data', 'inventory_count_items')
ORDER BY table_name, ordinal_position;

