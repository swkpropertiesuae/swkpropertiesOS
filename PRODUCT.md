# SWK Properties OS (SWK OS)

## Product and Users

SWK Properties OS supports the daily operations of **SWK Properties L.L.C.** (`إس دبليو كي العقارية ش.ذ.م.م`), a RERA-licensed real estate brokerage and property management enterprise in Dubai, UAE (DET Licence `1645802`, RERA ORN `51517`).

Staff manage property listings, units, Form A mandates, buyer/tenant leads, viewings, offers, Form F sales contracts, DLD trustee transfers, escrow accounts, Ejari leases, post-dated cheques (PDCs), maintenance requests, property handovers, commission tax invoices, vendor bills, HR/WPS payroll, and UAE statutory compliance. Landlords and clients have a dedicated portal view of their own deals, leases, and statements.

## Core Capabilities

- **Zero Mock Data in Production**: Starts with a clean database containing only statutory UAE reference data (Chart of Accounts, VAT codes, Dubai communities, developers, DET/RERA licence items, and 82 corporate document templates).
- **Document Studio**: Generated documents identify the recipient first and include a system-generated notice. Administrators can upload the official company seal and configure default terms under `docs/DOCUMENTS.md`.
- **Executive Dashboard & SWK Suite**: Real-time visibility across listings, sales pipeline, viewings, offers, PDC maturities, landlord yields, agent GCI leaderboards, and RERA/AML compliance.
- **Email & Communications**: Staff can send email from the OS using Sales, Accounts, Info, Contact, or Support at `swkpropertiesuae.com`. Administrators configure authenticated SMTP/Resend connections with full outbox history and retry controls.

## Security & Governance

- Role-based access control across all modules with strict customer-portal isolation.
- Encrypted integration credentials excluded from API responses.
- Enforced UAE VAT (5%), Corporate Tax, RERA BRN/ORN, and AML/DNFBP sanctions screening checks.
