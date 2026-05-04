-- Example: Registering a new product (Telecom KPI)
-- Save this in your product's /sql directory and run it during deployment

-- 1. Create a Category (if it doesn't exist)
INSERT IGNORE INTO portal_categories (id, title, icon_name) VALUES 
('TelecomKPI', 'KPI Reports', 'BarChartOutlined');

-- 2. Register Modules (Pages)
INSERT IGNORE INTO portal_modules (id, title, path, category_id, permission, schema_url) VALUES 
('kpi-summary', 'Summary Dashboard', '/kpi/summary', 'TelecomKPI', 'kpi:read', '/schemas/kpi-report-v2.json'),
('kpi-nodes', 'Node Config', '/kpi/nodes', 'TelecomKPI', 'node:manage', '/schemas/node-config.json');
