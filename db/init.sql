-- OAM Portal: Database Initialization Script (MySQL/PostgreSQL)

-- 1. Users Metadata Table
-- Stores portal-specific extensions for users managed by Keycloak
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Granular Permissions Table
-- Maps permission strings (e.g., 'node:read', 'gtp:config:rules') to users
CREATE TABLE IF NOT EXISTS user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    permission VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY (user_id, permission)
);

-- 3. Tenant Access Table
-- Maps authorized tenants (e.g., 'acme', 'globex') to users
CREATE TABLE IF NOT EXISTS user_tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    tenant_id VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY (user_id, tenant_id)
);

-- 4. Network Nodes (Example Product Data)
-- Stores configurations for the default 'Network Nodes' module
CREATE TABLE IF NOT EXISTS network_nodes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    tenant_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    last_action CHAR(1) DEFAULT 'I' COMMENT 'I=Insert, U=Update, D=Delete'
);

-- 5. Audit Trail Table
-- Capture all user activity for security and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    screen VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    details TEXT,
    status VARCHAR(50) NOT NULL
);

-- Initial Data (Optional - Seed Admin)
-- INSERT INTO users (id, username, name, email, role) VALUES ('1', 'admin', 'Dev Admin', 'admin@example.com', 'admin');
-- INSERT INTO user_permissions (user_id, permission) VALUES ('1', 'user:manage'), ('1', 'dashboard:read'), ('1', 'node:read');

-- 6. API Keys Table
-- Manages platform-level developer keys for programmatic access per tenant
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    prefix VARCHAR(20) NOT NULL COMMENT 'Used for UI display (e.g. key_...)',
    api_key_hash VARCHAR(255) NOT NULL UNIQUE COMMENT 'Hashed value for security',
    tenant_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(50) COMMENT 'User who created the key',
    status VARCHAR(20) DEFAULT 'active' COMMENT 'active, revoked',
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
