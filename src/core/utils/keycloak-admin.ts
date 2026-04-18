export class KeycloakAdmin {
    private static getBaseUrl(): string {
        if (process.env.KEYCLOAK_INTERNAL_URL) return process.env.KEYCLOAK_INTERNAL_URL;
        const issuer = process.env.KEYCLOAK_ISSUER;
        if (issuer) {
            // Extract http://host:port/auth from http://host:port/auth/realms/spartified
            return issuer.split('/realms/')[0];
        }
        return 'http://localhost:8080/auth';
    }

    private static realm = 'spartified';

    private static async getAdminToken(): Promise<string> {
        const baseUrl = this.getBaseUrl();
        const params = new URLSearchParams({
            client_id: 'admin-cli',
            username: process.env.KEYCLOAK_ADMIN || 'admin',
            password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
            grant_type: 'password'
        });

        const url = `${baseUrl}/realms/master/protocol/openid-connect/token`;
        console.log(`Keycloak: Fetching admin token from ${url}`);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Keycloak token error", errText);
            throw new Error(`Failed to get Keycloak Admin Token: ${errText}`);
        }

        const data = await res.json();
        console.log("Keycloak: Admin token received successfully");
        return data.access_token;
    }

    public static async createUser(email: string, firstName: string, lastName: string): Promise<string> {
        const baseUrl = this.getBaseUrl();
        const token = await this.getAdminToken();
        const url = `${baseUrl}/admin/realms/${this.realm}/users`;

        const payload = {
            username: email,
            email: email,
            firstName,
            lastName,
            enabled: true,
            emailVerified: true
        };

        console.log(`Keycloak: Creating user ${email} at ${url}`);
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log(`Keycloak: Create user status: ${res.status}`);

        if (res.status === 201) {
            // Fetch the user ID
            const usersRes = await fetch(`${url}?username=${encodeURIComponent(email)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await usersRes.json();

            // Trigger Reset Password Email
            if (users && users.length > 0) {
                const userId = users[0].id;
                console.log(`Keycloak: Triggering UPDATE_PASSWORD email for ${userId}`);
                const emailRes = await fetch(`${url}/${userId}/execute-actions-email`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(["UPDATE_PASSWORD"])
                });

                if (!emailRes.ok) {
                    const errMsg = await emailRes.text();
                    console.error(`Keycloak: Email trigger FAILED for ${email}:`, errMsg);
                    // We don't throw here to avoid failing the whole creation, but we log it clearly
                } else {
                    console.log(`Keycloak: Email invitation sent successfully to ${email}`);
                }
                return userId;
            }
            return "";
        } else if (res.status === 409) {
            // User already exists
            console.log(`Keycloak: User ${email} already exists. Triggering re-invitation.`);
            const usersRes = await fetch(`${url}?username=${encodeURIComponent(email)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await usersRes.json();

            if (users && users.length > 0) {
                const userId = users[0].id;
                await fetch(`${url}/${userId}/execute-actions-email`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(["UPDATE_PASSWORD"])
                });
                return userId;
            }
            return users[0]?.id || "";
        } else {
            console.error("Keycloak user creation error", await res.text());
            throw new Error("Failed to create Keycloak User");
        }
    }

    public static async deleteUser(email: string): Promise<void> {
        const baseUrl = this.getBaseUrl();
        const token = await this.getAdminToken();
        const url = `${baseUrl}/admin/realms/${this.realm}/users`;

        // 1. Find user ID
        const usersRes = await fetch(`${url}?username=${encodeURIComponent(email)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await usersRes.json();

        if (users && users.length > 0) {
            const userId = users[0].id;
            console.log(`Keycloak: Deleting user ${email} (${userId})`);
            const delRes = await fetch(`${url}/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!delRes.ok) {
                const err = await delRes.text();
                console.error(`Keycloak: Delete FAILED for ${email}:`, err);
                throw new Error("Failed to delete Keycloak user: " + err);
            }
            console.log(`Keycloak: User ${email} deleted successfully`);
        }
    }
}
