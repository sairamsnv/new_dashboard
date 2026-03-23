-- Create table for Pending Approval Inventory Counts
-- This table stores pending approval inventory count data with nested items
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS pending_approval_inventory_count_items CASCADE;
-- DROP TABLE IF EXISTS pending_approval_inventory_counts CASCADE;

-- Create the main pending approval inventory counts table
CREATE TABLE IF NOT EXISTS pending_approval_inventory_counts (
    id SERIAL PRIMARY KEY,
    document_number TEXT UNIQUE NOT NULL,  -- e.g., '80'
    status TEXT,  -- e.g., 'Completed/Pending Approval'
    date_created TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the pending approval inventory count items table (for the items array)
CREATE TABLE IF NOT EXISTS pending_approval_inventory_count_items (
    id SERIAL PRIMARY KEY,
    pending_approval_inventory_count_id INTEGER NOT NULL REFERENCES pending_approval_inventory_counts(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    bin_number TEXT,  -- e.g., '- None -' or actual bin number
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_counts_document_number ON pending_approval_inventory_counts(document_number);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_counts_status ON pending_approval_inventory_counts(status);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_counts_date_created ON pending_approval_inventory_counts(date_created);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_counts_created_by ON pending_approval_inventory_counts(created_by);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_count_items_count_id ON pending_approval_inventory_count_items(pending_approval_inventory_count_id);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_count_items_item ON pending_approval_inventory_count_items(item);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_count_items_bin_number ON pending_approval_inventory_count_items(bin_number);

-- Add comments for documentation
COMMENT ON TABLE pending_approval_inventory_counts IS 'Stores pending approval inventory count data records';
COMMENT ON TABLE pending_approval_inventory_count_items IS 'Stores items associated with pending approval inventory counts (one-to-many relationship)';
COMMENT ON COLUMN pending_approval_inventory_counts.document_number IS 'Unique document number for the pending approval inventory count (e.g., 80)';
COMMENT ON COLUMN pending_approval_inventory_counts.status IS 'Status of the inventory count (e.g., Completed/Pending Approval)';
COMMENT ON COLUMN pending_approval_inventory_counts.date_created IS 'Date when the count was created';
COMMENT ON COLUMN pending_approval_inventory_counts.created_by IS 'User who created the count';
COMMENT ON COLUMN pending_approval_inventory_count_items.item IS 'Item name in the count';
COMMENT ON COLUMN pending_approval_inventory_count_items.bin_number IS 'Bin number for the item (e.g., - None -)';

-- Create functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pending_approval_inv_counts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pending_approval_inv_count_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_pending_approval_inv_counts_updated_at ON pending_approval_inventory_counts;
CREATE TRIGGER trigger_update_pending_approval_inv_counts_updated_at
    BEFORE UPDATE ON pending_approval_inventory_counts
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_approval_inv_counts_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pending_approval_inv_count_items_updated_at ON pending_approval_inventory_count_items;
CREATE TRIGGER trigger_update_pending_approval_inv_count_items_updated_at
    BEFORE UPDATE ON pending_approval_inventory_count_items
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_approval_inv_count_items_updated_at();

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name IN ('pending_approval_inventory_counts', 'pending_approval_inventory_count_items')
ORDER BY table_name, ordinal_position;

