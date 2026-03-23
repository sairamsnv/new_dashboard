-- Create table for Reorder Items
-- This table stores reorder items information
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS re_order_items CASCADE;

-- Create the reorder items table
CREATE TABLE IF NOT EXISTS re_order_items (
    id SERIAL PRIMARY KEY,
    item_name TEXT,
    description TEXT,
    reorder_point INTEGER,
    quantity_available INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_re_order_items_item_name ON re_order_items(item_name);
CREATE INDEX IF NOT EXISTS idx_re_order_items_reorder_point ON re_order_items(reorder_point);
CREATE INDEX IF NOT EXISTS idx_re_order_items_quantity_available ON re_order_items(quantity_available);

-- Add comments for documentation
COMMENT ON TABLE re_order_items IS 'Stores reorder items information including item name, description, reorder point, and quantity available';
COMMENT ON COLUMN re_order_items.item_name IS 'Name of the item';
COMMENT ON COLUMN re_order_items.description IS 'Description of the item';
COMMENT ON COLUMN re_order_items.reorder_point IS 'Reorder point threshold for the item';
COMMENT ON COLUMN re_order_items.quantity_available IS 'Current quantity available';

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_re_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_re_order_items_updated_at ON re_order_items;
CREATE TRIGGER trigger_update_re_order_items_updated_at
    BEFORE UPDATE ON re_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_re_order_items_updated_at();

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 're_order_items'
ORDER BY ordinal_position;

