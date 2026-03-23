-- Create table for Inventory Adjustment Data
-- This table stores inventory adjustment data with nested items
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS inventory_adjustment_items CASCADE;
-- DROP TABLE IF EXISTS inventory_adjustment_data CASCADE;

-- Create the main inventory adjustment data table
CREATE TABLE IF NOT EXISTS inventory_adjustment_data (
    id SERIAL PRIMARY KEY,
    document_number TEXT UNIQUE NOT NULL,  -- e.g., 'IA1263'
    date_created TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the inventory adjustment items table (for the items array)
CREATE TABLE IF NOT EXISTS inventory_adjustment_items (
    id SERIAL PRIMARY KEY,
    inventory_adjustment_id INTEGER NOT NULL REFERENCES inventory_adjustment_data(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    quantity TEXT,  -- Stored as TEXT to match API format (e.g., '1')
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inv_adj_data_document_number ON inventory_adjustment_data(document_number);
CREATE INDEX IF NOT EXISTS idx_inv_adj_data_date_created ON inventory_adjustment_data(date_created);
CREATE INDEX IF NOT EXISTS idx_inv_adj_data_created_by ON inventory_adjustment_data(created_by);
CREATE INDEX IF NOT EXISTS idx_inv_adj_items_adjustment_id ON inventory_adjustment_items(inventory_adjustment_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_items_item ON inventory_adjustment_items(item);

-- Add comments for documentation
COMMENT ON TABLE inventory_adjustment_data IS 'Stores inventory adjustment data records';
COMMENT ON TABLE inventory_adjustment_items IS 'Stores items associated with inventory adjustments (one-to-many relationship)';
COMMENT ON COLUMN inventory_adjustment_data.document_number IS 'Unique document number for the inventory adjustment (e.g., IA1263)';
COMMENT ON COLUMN inventory_adjustment_data.date_created IS 'Date when the adjustment was created';
COMMENT ON COLUMN inventory_adjustment_data.created_by IS 'User who created the adjustment';
COMMENT ON COLUMN inventory_adjustment_items.item IS 'Item name in the adjustment';
COMMENT ON COLUMN inventory_adjustment_items.quantity IS 'Quantity for the item';

-- Create functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inv_adj_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_inv_adj_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_inv_adj_data_updated_at ON inventory_adjustment_data;
CREATE TRIGGER trigger_update_inv_adj_data_updated_at
    BEFORE UPDATE ON inventory_adjustment_data
    FOR EACH ROW
    EXECUTE FUNCTION update_inv_adj_data_updated_at();

DROP TRIGGER IF EXISTS trigger_update_inv_adj_items_updated_at ON inventory_adjustment_items;
CREATE TRIGGER trigger_update_inv_adj_items_updated_at
    BEFORE UPDATE ON inventory_adjustment_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inv_adj_items_updated_at();

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name IN ('inventory_adjustment_data', 'inventory_adjustment_items')
ORDER BY table_name, ordinal_position;

