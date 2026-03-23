-- Create table for Pending Approval Inventory Adjustments
-- This table stores pending approval inventory adjustment records
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS pending_approval_inventory_adjustments CASCADE;

-- Create the pending approval inventory adjustments table
CREATE TABLE IF NOT EXISTS pending_approval_inventory_adjustments (
    id SERIAL PRIMARY KEY,
    location TEXT,
    account TEXT,
    created_by TEXT,
    status TEXT,
    date_created TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_adj_location ON pending_approval_inventory_adjustments(location);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_adj_status ON pending_approval_inventory_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_adj_date_created ON pending_approval_inventory_adjustments(date_created);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_adj_created_by ON pending_approval_inventory_adjustments(created_by);
CREATE INDEX IF NOT EXISTS idx_pending_approval_inv_adj_account ON pending_approval_inventory_adjustments(account);

-- Add comments for documentation
COMMENT ON TABLE pending_approval_inventory_adjustments IS 'Stores pending approval inventory adjustment records';
COMMENT ON COLUMN pending_approval_inventory_adjustments.location IS 'Location of the inventory adjustment';
COMMENT ON COLUMN pending_approval_inventory_adjustments.account IS 'Account associated with the adjustment';
COMMENT ON COLUMN pending_approval_inventory_adjustments.created_by IS 'User who created the adjustment';
COMMENT ON COLUMN pending_approval_inventory_adjustments.status IS 'Status of the adjustment (e.g., Pending Approval)';
COMMENT ON COLUMN pending_approval_inventory_adjustments.date_created IS 'Date when the adjustment was created';

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pending_approval_inv_adj_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_pending_approval_inv_adj_updated_at ON pending_approval_inventory_adjustments;
CREATE TRIGGER trigger_update_pending_approval_inv_adj_updated_at
    BEFORE UPDATE ON pending_approval_inventory_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_approval_inv_adj_updated_at();

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'pending_approval_inventory_adjustments'
ORDER BY ordinal_position;

