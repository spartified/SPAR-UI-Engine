import crypto from "crypto";
import { dbManager } from "../db/manager";

export interface TelnaPackageTemplate {
    name: string;
    traffic_policy: number;
    supported_countries: string[];
    voice_usage_allowance: number;
    data_usage_allowance: number;
    sms_usage_allowance: number;
    activation_time_allowance: number;
    activation_type: string;
    earliest_activation_date?: number;
    earliest_available_date?: number;
    latest_available_date?: number;
    time_allowance: {
        duration: number;
        unit: string;
    };
    inventory: number;
}

class TelnaService {
    private async getAggregatorConfig(aggregatorAccountId: number | string) {
        if (aggregatorAccountId === undefined || aggregatorAccountId === null) {
            throw new Error("aggregatorAccountId is required for Telna configuration");
        }
        const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL);

        let query = 'SELECT * FROM aggregator_api_keys WHERE id = ?';
        let params: any[] = [aggregatorAccountId];

        if (typeof aggregatorAccountId === 'string' && isNaN(Number(aggregatorAccountId))) {
            query = 'SELECT * FROM aggregator_api_keys WHERE name LIKE ?';
            params = [`%${aggregatorAccountId}%`];
        }

        const [rows]: any = await pool.execute(query, params);
        if (rows.length === 0) throw new Error(`Aggregator account "${aggregatorAccountId}" not found`);
        return rows[0];
    }

    private getApiToken(aggregator: any) {
        // In a real system, we'd decrypt the key or use a secure vault.
        // For now, we use the provided token pattern or the hash if it were the key.
        // The previous implementation used a hardcoded token for Telna.
        return "eyJvcmciOiI2Mjg2MWUxZmY4YjU3ZDAwMDEzNmI1NjkiLCJpZCI6ImQ0YjE1MzJiZmJhMTQ0NGZiOGVjOGM2OTNmNDliNmRhIiwiaCI6Im11cm11cjY0In0=";
    }

    public async getInventories(aggregatorAccountId: number) {
        const aggregator = await this.getAggregatorConfig(aggregatorAccountId);
        const baseUrl = aggregator.base_url || "https://developer-api.telna.com/v2.1";
        const token = this.getApiToken(aggregator);

        const response = await fetch(`${baseUrl}/inventory/inventories`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Version': 'v2.1'
            },
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch inventories: ${response.status}`);
        }

        return await response.json();
    }

    public async getCountries(aggregatorAccountId: number) {
        const aggregator = await this.getAggregatorConfig(aggregatorAccountId);
        const baseUrl = aggregator.base_url || "https://developer-api.telna.com/v2.1";
        const token = this.getApiToken(aggregator);

        const response = await fetch(`${baseUrl}/core/countries?count=100&offset=0`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Version': 'v2.1'
            },
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch countries: ${response.status}`);
        }

        return await response.json();
    }

    public async createPackageTemplate(aggregatorAccountId: number, data: TelnaPackageTemplate) {
        const aggregator = await this.getAggregatorConfig(aggregatorAccountId);
        const baseUrl = aggregator.base_url || "https://developer-api.telna.com/v2.1";
        const token = this.getApiToken(aggregator);
        const requestId = crypto.randomUUID();

        // Dynamically get the first valid inventory if not provided or set to 1
        if (!data.inventory || data.inventory === 1) {
            console.log("Fetching valid inventories for aggregator...");
            try {
                const inventoriesResult = await this.getInventories(aggregatorAccountId);
                console.log("Raw Inventories Result:", JSON.stringify(inventoriesResult));

                // Handle both array and wrapped object responses
                const inventories = Array.isArray(inventoriesResult)
                    ? inventoriesResult
                    : (inventoriesResult.data || inventoriesResult.inventories || []);

                if (inventories && inventories.length > 0) {
                    data.inventory = inventories[0].id;
                    console.log(`Using Authorized Inventory ID: ${data.inventory}`);
                } else {
                    console.warn("No authorized inventories found for this account. Removing inventory field.");
                    delete (data as any).inventory;
                }
            } catch (e) {
                console.error("Failed to fetch inventories, proceeding without inventory field", e);
                delete (data as any).inventory;
            }
        }

        console.log("Calling Telna Create Template:", { baseUrl, requestId, data });

        // Fix supported_countries if set to "WW" (invalid ISO3)
        if (data.supported_countries && (data.supported_countries.includes("WW") || data.supported_countries.length === 0)) {
            console.log("Resolving valid country codes...");
            try {
                const countriesResult = await this.getCountries(aggregatorAccountId);
                const countries = countriesResult.countries || [];
                if (countries.length > 0) {
                    data.supported_countries = [countries[0].iso3];
                    console.log(`Using Resolved Country Code: ${data.supported_countries[0]}`);
                }
            } catch (e) {
                console.warn("Failed to resolve countries, using USA as fallback");
                data.supported_countries = ["USA"];
            }
        }

        // Handle date fields
        const now = Date.now();
        if (!data.earliest_activation_date) data.earliest_activation_date = now;
        if (!data.earliest_available_date) data.earliest_available_date = now;
        if (!data.latest_available_date) {
            // Default to 1 year from now
            data.latest_available_date = now + (365 * 24 * 60 * 60 * 1000);
        }

        const response = await fetch(`${baseUrl}/pcr/package-templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Request-ID': requestId,
                'Reference-ID': requestId,
                'Version': 'v2.1'
            },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Telna API Error Response:", error);
            throw new Error(`Telna API Error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        console.log("Telna API Success Result:", result);
        return result;
    }

    public async getPackageTemplate(aggregatorAccountId: number, remoteId: string) {
        const aggregator = await this.getAggregatorConfig(aggregatorAccountId);
        const baseUrl = aggregator.base_url || "https://developer-api.telna.com/v2.1";
        const token = this.getApiToken(aggregator);

        const response = await fetch(`${baseUrl}/pcr/package-templates/${remoteId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Version': 'v2.1'
            },
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) return null;
        return await response.json();
    }

    public async deletePackageTemplate(aggregatorAccountId: number, remoteId: string) {
        const aggregator = await this.getAggregatorConfig(aggregatorAccountId);
        const baseUrl = aggregator.base_url || "https://developer-api.telna.com/v2.1";
        const token = this.getApiToken(aggregator);

        const response = await fetch(`${baseUrl}/pcr/package-templates/${remoteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Version': 'v2.1'
            },
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Telna API Error: ${response.status} - ${error}`);
        }

        return true;
    }

    public async subscribePackage(aggregatorAccountId: number, iccid: string, remotePackageTemplateId: string) {
        const aggregator = await this.getAggregatorConfig(aggregatorAccountId);
        const baseUrl = aggregator.base_url || "https://developer-api.telna.com/v2.1";
        const token = this.getApiToken(aggregator);
        const requestId = crypto.randomUUID();

        const data = {
            sim: iccid,
            package_template: remotePackageTemplateId
        };

        console.log("Calling Telna Subscribe Package:", { baseUrl, iccid, remotePackageTemplateId });

        const response = await fetch(`${baseUrl}/pcr/packages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Request-ID': requestId,
                'Reference-ID': requestId,
                'Version': 'v2.1'
            },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Telna Subscription API Error:", error);
            throw new Error(`Telna Subscription Failed: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    public async deletePackage(aggregatorAccountId: number, remotePackageId: string) {
        const aggregator = await this.getAggregatorConfig(aggregatorAccountId);
        const baseUrl = aggregator.base_url || "https://developer-api.telna.com/v2.1";
        const token = this.getApiToken(aggregator);

        const response = await fetch(`${baseUrl}/pcr/packages/${remotePackageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Version': 'v2.1'
            },
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Telna Deletion Failed: ${response.status} - ${error}`);
        }

        return true;
    }

    public async getEuiccProfile(aggregatorAccountId: number | string, iccid: string) {
        const aggregator = await this.getAggregatorConfig(aggregatorAccountId);
        const baseUrl = aggregator.base_url || "https://developer-api.telna.com/v2.1";
        const token = this.getApiToken(aggregator);

        const response = await fetch(`${baseUrl}/esim-rsp/euicc-profiles/${iccid}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Version': 'v2.1'
            },
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch eUICC profile: ${response.status} - ${error}`);
        }

        return await response.json();
    }
}

export const telnaService = new TelnaService();
