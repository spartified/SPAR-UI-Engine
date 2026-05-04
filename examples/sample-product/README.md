# Sample Product Reference

This directory contains legacy and sample modules that serve as guidance for developers building new products on the SPAR-UI-Engine framework.

## Contents

- **Telecom KPI**: A sample report module demonstrating multi-statistic layouts and filtered data fetching.
  - Schema: `schemas/kpi-report-v2.json`
  - Page: `pages/kpi/`
- **Node Configuration**: A legacy configuration schema for network node management.
  - Schema: `schemas/node-config.json`

## How to Register a New Product

Since the platform moved to a **Dynamic Module Registry**, you no longer need to edit the UI source code to add a product. Follow these steps:

### 1. Database Registration
Create a SQL script in your product repository to register your pages. You must insert your module metadata into the `portal_modules` table in the `CORE` database.

**Example SQL (`register_sample.sql`):**
```sql
-- Create a category
INSERT IGNORE INTO portal_categories (id, title, icon_name) VALUES 
('MyProduct', 'My Product Name', 'DashboardOutlined');

-- Register a page
INSERT IGNORE INTO portal_modules (id, title, path, category_id, permission, db_pool) VALUES 
('my-dashboard', 'Dashboard', '/my-product/dashboard', 'MyProduct', 'my:read', 'MY_DB');
```

### 2. UI Code Placement
Copy your React pages into the SPAR-UI-Engine:
- **Pages**: Place them in `src/app/(authenticated)/[your-product-name]/`
- **Schemas**: Place JSON schemas in `src/schemas/`
- **API**: Place custom API routes in `src/app/api/[your-product-name]/`

### 3. Permissions
Ensure the `permission` string you register (e.g., `my:read`) is assigned to the users in the `user_permissions` table (or via Keycloak roles if using RBAC sync).

---
*Note: For a fully decoupled pod architecture, see the "Independent Pod Deployment" guide in `/docs`.*
