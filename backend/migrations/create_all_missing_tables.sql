-- Create all missing WMS Dashboard tables
-- This script creates all tables that should exist based on Django models
-- Schema: public (WMS Dashboard)

-- 1. Supplier table
CREATE TABLE IF NOT EXISTS dashboard_supplier (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- 2. Customer table
CREATE TABLE IF NOT EXISTS dashboard_customer (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- 3. OpenPurchaseOrder table
CREATE TABLE IF NOT EXISTS dashboard_openpurchaseorder (
    id BIGSERIAL PRIMARY KEY,
    "tranId" TEXT UNIQUE NOT NULL,
    "createdFrom" TEXT,
    location TEXT NOT NULL,
    vendor TEXT NOT NULL,
    "tranDate" DATE NOT NULL,
    memo TEXT
);

-- 4. OpenSalesOrder table
CREATE TABLE IF NOT EXISTS dashboard_opensalesorder (
    id BIGSERIAL PRIMARY KEY,
    "tranId" TEXT UNIQUE NOT NULL,
    location TEXT NOT NULL,
    customer TEXT NOT NULL,
    related_purchase TEXT,
    "dateCreated" DATE NOT NULL,
    "shipDate" DATE NOT NULL,
    memo TEXT,
    "shipMethod" TEXT
);

-- 5. PackedOrPickedOrder table
CREATE TABLE IF NOT EXISTS dashboard_packedorpickedorder (
    id BIGSERIAL PRIMARY KEY,
    "createdFrom" TEXT,
    "documentNumber" TEXT NOT NULL,
    customer TEXT NOT NULL,
    packer TEXT,
    picker TEXT,
    location TEXT NOT NULL,
    "shipDate" DATE NOT NULL,
    "dateCreated" TIMESTAMP WITH TIME ZONE NOT NULL,
    "packedTime" TEXT
);

-- 6. TotalOrdersReceived table
CREATE TABLE IF NOT EXISTS dashboard_totalordersreceived (
    id BIGSERIAL PRIMARY KEY,
    supplier TEXT NOT NULL,
    "createdFrom" TEXT NOT NULL,
    "createdDate" DATE NOT NULL,
    "tranId" TEXT UNIQUE NOT NULL,
    "receivedBy" TEXT NOT NULL,
    location TEXT NOT NULL,
    "purchaseCreated" DATE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_openpurchaseorder_tranid ON dashboard_openpurchaseorder("tranId");
CREATE INDEX IF NOT EXISTS idx_opensalesorder_tranid ON dashboard_opensalesorder("tranId");
CREATE INDEX IF NOT EXISTS idx_packedorpickedorder_documentnumber ON dashboard_packedorpickedorder("documentNumber");
CREATE INDEX IF NOT EXISTS idx_totalordersreceived_tranid ON dashboard_totalordersreceived("tranId");

-- Verify tables were created
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
    AND table_name LIKE 'dashboard_%'
ORDER BY table_name;






