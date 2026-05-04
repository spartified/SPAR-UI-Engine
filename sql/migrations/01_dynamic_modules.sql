-- Dynamic Module Registry Migration
-- This script creates tables to allow products like Orion and GTPProxy 
-- to register their routes dynamically in the SPAR-UI-Engine.

CREATE TABLE IF NOT EXISTS portal_categories (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    icon_name VARCHAR(50) -- mapping to Ant Design icons
);

CREATE TABLE IF NOT EXISTS portal_modules (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    path VARCHAR(255) NOT NULL,
    category_id VARCHAR(50),
    permission VARCHAR(100),
    schema_url VARCHAR(255),
    db_pool VARCHAR(50),
    external_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES portal_categories(id) ON DELETE SET NULL
);

-- Seed initial Platform Categories
INSERT IGNORE INTO portal_categories (id, title, icon_name) VALUES 
('Reports', 'Reports', 'BarChartOutlined'),
('User Management', 'User Management', 'TeamOutlined'),
('Audit Trail', 'Audit Trail', 'HistoryOutlined'),
('Monitoring', 'Monitoring', 'GlobalOutlined');

-- Seed initial Platform Modules
INSERT IGNORE INTO portal_modules (id, title, path, category_id, permission, schema_url, db_pool) VALUES 
('user-management', 'User Management', '/configuration/users', 'User Management', 'user:manage', '/schemas/users.json', 'CORE'),
('audit-trail', 'Audit Trail', '/admin/audit-trail', 'Audit Trail', 'audit:read', '/schemas/audit-trail.json', 'CORE');
