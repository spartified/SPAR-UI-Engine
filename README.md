This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Developer Guide

### 1. How to Add a New Configuration Screen

The Config Framework is metadata-driven. To add a new screen with a table and form:

1.  **Define the Schema**:
    *   Create a new JSON file in `src/schemas/`.
    *   Example: `network-config.json`
    ```json
    {
      "title": "Network Settings",
      "endpoint": "/api/network",
      "fields": [
        { "name": "hostname", "label": "Hostname", "type": "text", "required": true },
        { "name": "port", "label": "Port", "type": "number" },
        { "name": "enabled", "label": "Enabled", "type": "checkbox" }
      ]
    }
    ```

2.  **Create the Page**:
    *   Create a new folder in `src/app/(authenticated)/configuration/`: e.g., `network/`.
    *   Create `page.tsx` inside it.
    *   Import the `ConfigEngine` and your schema.
    ```tsx
    import { ConfigEngine } from "@/components/Engines/ConfigEngine";
    import schema from "@/schemas/network-config.json";

    export default function NetworkPage() {
        return <ConfigEngine schema={schema} />;
    }
    ```

3.  **Update Navigation**:
    *   Open `src/components/Shell/AppShell.tsx`.
    *   Add your new route to the `menuItems` array.

### 2. How to Add a New Report

Similarly, reports are driven by schema:

1.  **Define the Report Schema**:
    *   Create a JSON file in `src/schemas/`, e.g., `traffic-report.json`.
    *   Define chart type, axes, and series data (or API endpoint).

2.  **Create the Page**:
    *   Create a folder in `src/app/(authenticated)/reports/`.
    *   Create `page.tsx` using `ReportEngine`.
    ```tsx
    import { ReportEngine } from "@/components/Engines/ReportEngine";
    import schema from "@/schemas/traffic-report.json";

    export default function TrafficReportPage() {
        return <ReportEngine schema={schema} />;
    }
    ```

### 3. How to Edit the Dashboard

The dashboard is a standard React page located at `src/app/(authenticated)/dashboard/page.tsx`.

*   To add widgets: Import components from `antd` or your own components.
*   To change layout: Use `Grid` system (`Row`, `Col`) or Flexbox.
*   To add charts: Import `ReactECharts` or use `ReportEngine` with a specific schema.

### 4. How to Change the Logo

1.  **Add Your Image**:
    *   Place your image file (e.g., `my-logo.png`) in the `public/` folder.
    *   *Note*: To use a local image, simply place the file in `public/`.

2.  **Update Configuration**:
    *   Open `src/branding.config.ts`.
    *   Update the `logo` property to point to your file path (relative to `public/`):
    ```ts
    export const brandingConfig = {
      // ...
      logo: "/my-logo.png", // The leading slash refers to the public folder
      // ...
    };
    ```

---

## Keycloak Integration

The SPAR UI Engine uses Keycloak for authentication and authorization.

### 1. Environment Variables

Configure the following variables in your `.env.local` or `docker-compose.yml`:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `AUTH_MODE` | Set to `keycloak` to enable Keycloak. | `keycloak` |
| `NEXTAUTH_URL` | The base URL of your application (must match the browser access URL). | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | A secret for NextAuth session encryption. | `your-random-secret` |
| `KEYCLOAK_ID` | The Client ID configured in Keycloak. | `nextjs-app` |
| `KEYCLOAK_SECRET` | The Client Secret from Keycloak. | `your-client-secret` |
| `KEYCLOAK_ISSUER` | Must match Keycloak's public issuer URL (include `/auth` if applicable). | `http://localhost:8080/auth/realms/spartified` |

### 2. Role & Permission Mapping

The engine automatically handles roles and permissions during the Keycloak login flow:
- **Automatic Role Extraction**: Roles are extracted from the `access_token` payload (falling back to the profile/ID token if available).
- **Admin Access**: Users with the `admin` or `ADMIN` role in Keycloak are automatically granted all available permissions defined in `MODULE_REGISTRY`.
- **Default Access**: All authenticated users receive `dashboard:read` permission by default, ensuring they can access the landing page and see the dashboard in the sidebar.
- **Custom Roles**: Any other roles present in the token are added to the user's permission set.

### 3. Keycloak Setup Requirements

1.  **Create a Realm**: e.g., `spartified`.
2.  **Create a Client**: 
    - **Access Type**: `confidential`.
    - **Valid Redirect URIs**: `http://localhost:3000/api/auth/callback/keycloak`.
3.  **Client Roles**: Create an `admin` role and assign it to your administrative users.
4.  **Hostname Configuration**: Ensure `KC_HOSTNAME` in Keycloak matches the host/IP used in `KEYCLOAK_ISSUER` to avoid OIDC discovery mismatches.

### 4. Troubleshooting: `OAuthSignin` Error

If you see `error=OAuthSignin` in the URL:
- **Discovery Failed**: The portal container cannot reach the `KEYCLOAK_ISSUER`. Ensure the URL is accessible from within the Docker network.
- **Path Mismatch**: Keycloak 17+ defaults to no prefix, but Docker containers often use a relative path like `/auth`. Check if your issuer URL needs `/auth/realms/`.
- **Issuer Mismatch**: The `issuer` URL provided in the configuration must exactly match the `issuer` string returned by Keycloak's `.well-known/openid-configuration` endpoint.

### 5. Applying Changes

When modifying authentication logic or environment variables in Docker, always rebuild the container:
```bash
docker compose up -d --build
```
