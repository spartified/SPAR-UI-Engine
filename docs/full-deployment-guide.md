# OAM Portal: Complete Production Deployment Guide (AWS)

This guide provides step-by-step instructions for deploying the OAM Portal and its dependencies in a production-grade environment on AWS using Docker and ECS.

## 1. System Architecture & Dependencies

The portal relies on several key architectural components:
*   **Networking**: VPC with Public (ALB) and Private (Apps/DB) subnets.
*   **Identity (Keycloak)**: Handles RBAC and OIDC authentication.
*   **Database (RDS)**: Persistent storage for users, configs, and Keycloak data.
*   **Monitoring (Grafana)**: Optional component embedded via iframe for analytics.
*   **Application (Next.js)**: The core metadata-driven portal.

---

## 1.1 Assumptions

*   **MySQL Database**: This guide primarily assumes a **MySQL 8.0+** instance is already provisioned and reachable. 
*   **Credentials**: You possess the necessary endpoint, database name (e.g., `oam_portal`), and credentials.

---

## 2. Infrastructure Setup (AWS Console/Terraform)

### Step 2.1: Networking
1.  **VPC**: Create a VPC with CIDR `10.0.0.0/16`.
2.  **Subnets**: Create 2 Public subnets and 2 Private subnets across 2 Availability Zones.
3.  **IGW**: Attach an Internet Gateway to the Public subnets.
4.  **NAT Gateway**: Setup a NAT Gateway in the Public subnet to allow Private subnets to reach the internet for image pulls.

### Step 2.2: Security Groups
*   **ALB-SG**: Inbound 80/443 from `0.0.0.0/0`.
*   **App-SG**: Inbound 3000 (Portal) and 8080 (Keycloak) from **ALB-SG**.
*   **DB-SG**: Inbound 5432 (Postgres) from **App-SG**.

---

## 3. Database Deployment (Amazon RDS)

1.  Create a **PostgreSQL 15+ Instance** using the `db-sg`.
2.  Use **Multi-AZ** for production high availability.
3.  Initialize the schema using the provided [`db/init.sql`](file:///home/guest/Desktop/Code/SPAR-UI-Engine/db/init.sql) script:
    ```bash
    # Example using mysql client
    mysql -h <rds-endpoint> -u <user> -p oam_portal < db/init.sql
    ```
    (Repeat for other logical databases if product-specific schemas are required).

---

## 4. Identity Provider Setup (Keycloak)

### Deployment
Deploy Keycloak as an ECS Service using the official `quay.io/keycloak/keycloak` image.

**Key Environment Variables**:
*   `KC_DB`: `mysql`
*   `KC_DB_URL`: `jdbc:mysql://<rds-endpoint>:3306/keycloak`
*   `KC_HOSTNAME`: `auth.yourdomain.com`

### Configuration
1.  Login to the Admin Console.
2.  **Create Realm**: `spartified`.
3.  **Create Client**: `oam-portal`.
    *   **Access Type**: `confidential`.
    *   **Valid Redirect URIs**: `https://portal.yourdomain.com/api/auth/callback/keycloak`.
4.  **Roles/Groups**: Define roles like `admin`, `viewer` and map them to users.

---

## 5. Portal Application Deployment

### Build and Push Image
```bash
# Build
docker build -t oam-portal .

# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <aws-id>.dkr.ecr.<region>.amazonaws.com
docker tag oam-portal <aws-id>.dkr.ecr.<region>.amazonaws.com/oam-portal:prod
docker push <aws-id>.dkr.ecr.<region>.amazonaws.com/oam-portal:prod
```

### ECS Task Configuration
Inject the following secrets from **AWS Secrets Manager**:
*   `CORE_DB_URL`: `mysql://user:pass@<rds-endpoint>:3306/oam_portal`
*   `GTP_PROXY_DB_URL`: `mysql://user:pass@<rds-endpoint>:3306/gtp_proxy`
*   `NEXTAUTH_SECRET`: Random 32+ char string.
*   `KEYCLOAK_SECRET`: Client secret from Step 4.

---

## 6. Upgrading the Portal (Site Upgrade)

To upgrade the portal at your AWS site without downtime, perform a **Rolling Update**:

1.  **Build and Push**: Follow [Step 5](#build-and-push-image) to push the new version to ECR with a new tag (e.g., `:v2`).
2.  **Update Task Definition**: Create a new revision of the ECS Task Definition pointing to the new image tag.
3.  **Update Service**: 
    ```bash
    aws ecs update-service --cluster <cluster-name> --service <service-name> --task-definition <new-task-def-arn> --force-new-deployment
    ```
    AWS will automatically drain old connections and spin up new containers one by one.

---

## 7. Integrating Optional Products

The platform supports hot-installation of new products via metadata.

### How to install a new product:
1.  **Drop Schema**: Put the product's JSON schema in `src/schemas/`.
2.  **Register Module**: Add the module definition to `src/config/modules.ts`.
    ```typescript
    {
       id: 'product-x-config',
       title: 'Product X Setup',
       path: '/configuration/product-x',
       category: 'Configuration',
       permission: 'product:x:manage',
       schema: '/schemas/product-x.json'
    }
    ```
3.  **Add Permission**: Add `product:x:manage` to the "Granular Permissions" list in `src/schemas/users.json`.
4.  **Redeploy**: Perform a rolling update to the ECS Service.

---

## 8. Monitoring (Grafana)

The OAM Portal supports embedding multiple Grafana dashboards. Monitoring links are managed via the `MODULE_REGISTRY` in `src/config/modules.ts`.

### Independent Grafana Setup
Gravity OAM is designed to work with an independent Grafana installation (e.g., hosted on a separate server or managed service).

1.  **Grafana Configuration**:
    *   Set `GF_SECURITY_ALLOW_EMBEDDING=true`.
    *   Enable Anonymous Auth if desired: `GF_AUTH_ANONYMOUS_ENABLED=true`.

2.  **Portal Configuration**:
    Configure the following environment variables in your deployment (e.g., ECS, Docker Compose) to point to your specific Grafana Solo panels:

    ```bash
    NEXT_PUBLIC_GRAFANA_URL_SERVER=https://grafana.example.com/d-solo/server/...
    NEXT_PUBLIC_GRAFANA_URL_DB=https://grafana.example.com/d-solo/db/...
    NEXT_PUBLIC_GRAFANA_URL_APP=https://grafana.example.com/d-solo/app/...
    ```

3.  **UI Navigation**:
    The framework now includes a "Monitoring" section with links for:
    *   **Server Monitoring**
    *   **Database Monitoring**
    *   **Application Metrics**

    Each link dynamically renders an iframe using the URLs specified above.

---

> [!TIP]
> Use **Amazon CloudWatch** for centralized logging of all ECS containers to troubleshoot deployment or permission issues.
