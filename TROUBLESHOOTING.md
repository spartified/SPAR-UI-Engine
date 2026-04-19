# Troubleshooting Guide: SPAR-UI-Engine & Keycloak

This guide documents common issues encountered during the production deployment of the SPAR-UI-Engine and its modules (e.g., Orion Portal).

## 1. Keycloak: "HTTPS required" Error
**Symptoms:** 
- Accessing Keycloak via IP and seeing a "We are sorry... HTTPS required" screen.
- Logs show `error=ssl_required`.

**Cause:** 
Keycloak's Master realm defaults to requiring SSL for external IP connections.

**Resolution:** 
Disable the SSL requirement directly in the MySQL database:
```bash
docker exec shared_mysql mysql -u root -p<ROOT_PASS> -e "USE keycloak; UPDATE REALM SET SSL_REQUIRED = 'NONE'; FLUSH PRIVILEGES;"
```
Restart the Keycloak container after running this command.

---

## 2. Keycloak: "Loading the Admin UI" Infinite Hang
**Symptoms:** 
- The page stays stuck on "Loading the Admin UI" after login.
- Occurs when using custom ports (e.g., 8080) and relative paths (e.g., `/auth`).

**Cause:** 
Keycloak Quarkus cannot correctly resolve its own frontend/backend discovery URLs.

**Resolution:** 
Explicitly set the hostname port and disable proxy mode in `docker-compose.prod.yml`:
```yaml
environment:
  - KC_HOSTNAME=your.ip.address
  - KC_HOSTNAME_PORT=8080
  - KC_HOSTNAME_STRICT=false
  - KC_HTTP_ENABLED=true
```

---

## 3. Database: "Access denied" (Docker to Docker)
**Symptoms:** 
- Container logs show `java.sql.SQLException: Access denied for user 'root'@'172.x.x.x'`.

**Cause:** 
MySQL `root` is restricted to `localhost`. Docker containers connect via an internal bridge IP.

**Resolution:** 
Grant permissions to the root user for the wildcard host (`%`):
```bash
docker exec shared_mysql mysql -uroot -p<PASS> -e "CREATE USER IF NOT EXISTS 'root'@'%'; ALTER USER 'root'@'%' IDENTIFIED BY '<PASS>'; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
```
Alternatively, create a dedicated user for Keycloak.

---

## 4. Production Build: "Module not found"
**Symptoms:** 
- Docker build fails during `npm run build` with "Module not found: Can't resolve '@/app/api/...'".

**Cause:** 
Relative paths in injected modules (e.g., SPAR-ORION-Portal) break when copied into the engine's directory structure.

**Resolution:** 
Always use **Absolute Path Aliases** (`@/app/api/...`) instead of relative paths (`../../../api/...`) for platform-wide components like Auth Options.

---

## 5. TypeScript: "Strict" Mode Compilation Errors
**Symptoms:** 
- Build fails with `Property 'result' does not exist on type '...'` or `Type 'undefined' is not assignable to type '...'`.

**Cause:** 
Production builds enforce strict type-checking on database results and environment variables.

**Resolution:** 
Apply strict type-guards and null-checks.
Example:
```typescript
const [rows] = await pool.execute(...) as [any[], any];
if (rows.length > 0) { ... }
```
Avoid indexing into results directly without existence checks.
