-- Create table for Employee Details
-- This table stores employee information with images
-- Schema: public (WMS Dashboard)

-- Drop table if exists (for fresh start - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS employee_details CASCADE;

-- Create the employee details table
CREATE TABLE IF NOT EXISTS employee_details (
    id SERIAL PRIMARY KEY,
    name TEXT,
    emp_image BYTEA
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employee_details_name ON employee_details(name);

