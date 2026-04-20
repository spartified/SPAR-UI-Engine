import crypto from "crypto";

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

class AggregatorService {
    private getBaseUrl() {
        return process.env.AGG_SERVICE_URL || "http://localhost:8005/portal";
    }

    private getHeaders(aggregatorId: number | string) {
        return {
            'Accept': 'application/json',
            'aggregator-id': String(aggregatorId)
        };
    }

    public async getInventories(aggregatorAccountId: number) {
        const url = `${this.getBaseUrl()}/v1/inventory/inventories`;
        console.log(`[AggregatorService] GET ${url} (AggregatorID: ${aggregatorAccountId})`);
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders(aggregatorAccountId),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch inventories: ${response.status}`);
        }

        const result = await response.json();
        console.log(`[AggregatorService] SUCCESS ${url} Response:`, JSON.stringify(result));
        return result;
    }

    public async getCountries(aggregatorAccountId: number) {
        const url = `${this.getBaseUrl()}/v1/core/countries?count=100&offset=0`;
        console.log(`[AggregatorService] GET ${url} (AggregatorID: ${aggregatorAccountId})`);
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders(aggregatorAccountId),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch countries: ${response.status}`);
        }

        const result = await response.json();
        console.log(`[AggregatorService] SUCCESS ${url} Response:`, JSON.stringify(result));
        return result;
    }

    public async createPackageTemplate(aggregatorAccountId: number, data: TelnaPackageTemplate) {
        const requestId = crypto.randomUUID();

        if (!data.inventory || data.inventory === 1) {
            console.log("Fetching valid inventories for aggregator...");
            try {
                const inventoriesResult = await this.getInventories(aggregatorAccountId);
                console.log("Raw Inventories Result:", JSON.stringify(inventoriesResult));

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

        console.log("Calling Aggregator Create Template:", { baseUrl: this.getBaseUrl(), requestId, data });

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

        const now = Date.now();
        if (!data.earliest_activation_date) data.earliest_activation_date = now;
        if (!data.earliest_available_date) data.earliest_available_date = now;
        if (!data.latest_available_date) {
            data.latest_available_date = now + (365 * 24 * 60 * 60 * 1000);
        }

        const response = await fetch(`${this.getBaseUrl()}/v1/pcr/package-templates`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(aggregatorAccountId),
                'Content-Type': 'application/json',
                'Request-ID': requestId,
                'Reference-ID': requestId
            },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Aggregator API Error Response:", error);
            throw new Error(`Aggregator API Error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        console.log("Aggregator API Success Result:", result);
        return result;
    }

    public async getPackageTemplate(aggregatorAccountId: number, remoteId: string) {
        const response = await fetch(`${this.getBaseUrl()}/v1/pcr/package-templates/${remoteId}`, {
            method: 'GET',
            headers: this.getHeaders(aggregatorAccountId),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) return null;
        return await response.json();
    }

    public async deletePackageTemplate(aggregatorAccountId: number, remoteId: string) {
        const response = await fetch(`${this.getBaseUrl()}/v1/pcr/package-templates/${remoteId}`, {
            method: 'DELETE',
            headers: this.getHeaders(aggregatorAccountId),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Aggregator API Error: ${response.status} - ${error}`);
        }

        return true;
    }

    public async subscribePackage(aggregatorAccountId: number, iccid: string, remotePackageTemplateId: string) {
        const requestId = crypto.randomUUID();
        const data = {
            sim: iccid,
            package_template: remotePackageTemplateId
        };

        console.log("Calling Aggregator Subscribe Package:", { baseUrl: this.getBaseUrl(), iccid, remotePackageTemplateId });

        const response = await fetch(`${this.getBaseUrl()}/v1/pcr/packages`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(aggregatorAccountId),
                'Content-Type': 'application/json',
                'Request-ID': requestId,
                'Reference-ID': requestId
            },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Aggregator Subscription API Error:", error);
            throw new Error(`Aggregator Subscription Failed: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    public async deletePackage(aggregatorAccountId: number, remotePackageId: string) {
        const response = await fetch(`${this.getBaseUrl()}/v1/pcr/packages/${remotePackageId}`, {
            method: 'DELETE',
            headers: this.getHeaders(aggregatorAccountId),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Aggregator Deletion Failed: ${response.status} - ${error}`);
        }

        return true;
    }

    public async getEuiccProfile(aggregatorAccountId: number | string, iccid: string) {
        const url = `${this.getBaseUrl()}/v1/esim-rsp/euicc-profiles/${iccid}`;
        console.log(`[AggregatorService] GET ${url} (AggregatorID: ${aggregatorAccountId})`);
        // Correct path mapping based on Swagger json provided earlier
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders(aggregatorAccountId),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch eUICC profile: ${response.status} - ${error}`);
        }

        const result = await response.json();
        console.log(`[AggregatorService] SUCCESS ${url} Response:`, JSON.stringify(result));
        return result;
    }

    public async getInventorySims(aggregatorAccountId: number | string, inventoryId: string) {
        const url = `${this.getBaseUrl()}/v1/inventory/sim-registries?inventory=${inventoryId}`;
        console.log(`[AggregatorService] GET ${url} (AggregatorID: ${aggregatorAccountId})`);
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders(aggregatorAccountId),
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch inventory SIMs: ${response.status} - ${error}`);
        }

        const result = await response.json();
        console.log(`[AggregatorService] SUCCESS ${url} Response:`, JSON.stringify(result));
        return result;
    }
}

export const aggregatorService = new AggregatorService();
