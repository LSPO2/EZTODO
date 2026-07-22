-- EZTODO Database Initialization

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial admin user (password: admin123 - change in production!)
-- This is just for development, use proper auth in production
