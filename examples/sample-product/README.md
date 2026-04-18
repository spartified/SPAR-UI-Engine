# Sample Product Reference

This directory contains legacy and sample modules that serve as guidance for developers building new products on the SPAR-UI-Engine framework.

## Contents

- **Telecom KPI**: A sample report module demonstrating multi-statistic layouts and filtered data fetching.
  - Schema: `schemas/kpi-report-v2.json`
  - Page: `pages/kpi/`
- **Node Configuration**: A legacy configuration schema for network node management.
  - Schema: `schemas/node-config.json`

## How to use as guidance

1. **Study the Schemas**: These JSON files define the structure of the dashboards and tables.
2. **Page Structure**: The `pages/kpi` folder shows how to implement a custom authentication-guarded page.
3. **Module Registration**: Refer to the commented-out section in `src/config/modules.ts` to see how these were originally registered in the platform.

---
*Note: These modules are no longer part of the core engine and are for reference only.*
