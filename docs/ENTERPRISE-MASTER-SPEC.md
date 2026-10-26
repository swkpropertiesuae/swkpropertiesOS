# SWK Properties OS — Enterprise Operating Model & Master Specification (v1.0)

This document serves as the authoritative **Architecture, Data Dictionary, RBAC & Separation-of-Duties Matrix, Standard Operating Procedures (SOPs), and Production Runbook** for **SWK Properties OS** (`Master Specification v1.0`).

---

## 1. Seven Executive Operating Principles

1. **One Canonical Record Per Business Object**: Every employee, broker authorisation, immigration case, attendance event, daily report, inventory submission, property/unit, listing mandate, developer NOC request, lead, communication, field session, transaction, invoice/receipt, commission entitlement, universal approval, compliance case, and audit event has a single canonical record with full ownership and version history.
2. **Evidence-Backed Workflow Transitions**: No regulated or commercial workflow stage advances without verified prerequisite evidence (KYC, RERA Forms A/B/F/I, Trakheesi permit, developer portal reference, external DLD title deed / Oqood reference, posted tax invoice, and reconciled bank receipt).
3. **Least-Privilege Access & Separation of Duties**: High-risk actions enforce strict maker-checker or three-way segregation (`initiator ≠ approver ≠ payer`, `sourcing agent ≠ inventory verifier ≠ publication approver`, `NOC coordinator ≠ independent NOC reviewer`, `PRO submitter ≠ HR completion verifier`).
4. **Integration Honesty**: Live external integrations are explicitly distinguished from simulated/sandbox or manual status in `/api/enterprise/command-centre` and `/admin/integrations`.
5. **Fair Anomaly Review (Never Automatic Guilt)**: Automated fraud, collusion, WhatsApp diversion, and viewing disputes generate leads in `compliance_cases` for independent human investigation — never automatic penalties or guilt. Subjects have a built-in right to appeal (`7.16`).
6. **Transparent, Proportionate Work-Hours Monitoring**: Field presence (`field_sessions`) is strictly duty-based during scheduled work hours. Off-hours GPS lookups are blocked (`7.03`) and logged in `location_access_logs` for security review.
7. **End-to-End Commercial-to-Finance Reconciliation**: Every closed sale, off-plan booking, lease, and commission payout reconciles to `invoices`, `receipts`, and `commission_entitlements`.

---

## 2. Complete 35-Module Matrix (Section 3.01 – 3.35)

| Code | Module Name | Canonical Entities | Key Endpoints & UI |
|---|---|---|---|
| **3.01** | Corporate Governance | `corporate_governance_items`, `legal_entities`, `branches` | `/e/corporate_governance_items`, `/enterprise/master-os` |
| **3.02** | Employee 360 & HR | `employees`, `departments`, `hr_lifecycle_cases` | `/e/employees`, `/e/hr_lifecycle_cases` |
| **3.03** | Visa, Immigration & PRO | `immigration_cases` | `POST /api/immigration-cases/:id/advance`, `/e/immigration_cases` |
| **3.04** | Broker Licensing & Agent Lifecycle | `agent_authorisations`, `agents` | `POST /api/agent-authorisations/:id/activate`, `/e/agent_authorisations` |
| **3.05** | Attendance, Leave & Field Duty | `attendance_events`, `attendance`, `leave_requests` | `/e/attendance_events`, `/e/leave_requests` |
| **3.06** | Daily Staff Accountability | `daily_reports` | `POST /api/daily-reports/:id/submit`, `POST /api/daily-reports/:id/review` |
| **3.07** | Daily Inventory Acquisition | `inventory_submissions` | `POST /api/inventory-submissions/:id/verify`, `POST /api/inventory-submissions/:id/publish` |
| **3.08** | Developer NOC & Clearance | `developer_requests` | `POST /api/developer-requests/:id/submit`, `POST /api/developer-requests/:id/verify` |
| **3.09** | WhatsApp Business Supervision | `communications`, `supervisor_access_logs` | `POST /api/communications/:id/supervise`, `/whatsapp` |
| **3.10** | Work-hours Field Presence | `field_sessions`, `location_access_logs` | `POST /api/field-sessions/:id/location`, `/e/field_sessions` |
| **3.11** | CRM & Lead Ownership | `leads`, `opportunities`, `lead_assignment_logs` | `POST /api/leads/:id/reassign-protected`, `/e/leads` |
| **3.12** | Property Inventory & Listings | `properties`, `units`, `listing_mandates` | `POST /api/listing-mandates/:id/approve-price`, `/listings` |
| **3.13** | Secondary Sales Transactions | `transactions`, `sales_contracts`, `offers` | `POST /api/enterprise-transactions/:id/advance`, `/pipeline` |
| **3.14** | Off-plan & Developers | `developers`, `payment_plans`, `transactions` | `/offplan`, `/e/transactions` |
| **3.15** | Leasing & Tenancies | `leases`, `rent_schedules`, `pdc_cheques` | `/pdc`, `/e/leases` |
| **3.16** | Property Management | `maintenance`, `inspections`, `service_charges`, `handovers` | `/e/maintenance`, `/e/inspections` |
| **3.17** | Commissions & Disputes | `commission_entitlements`, `agent_commissions` | `POST /api/commission-entitlements/:id/initiate`, `/e/commission_entitlements` |
| **3.18** | Payroll & Benefits | `payslips`, `allowances`, `deductions`, `eosb_accruals` | `/hr/wps`, `/e/payslips` |
| **3.19** | Accounting & Treasury | `accounts`, `invoices`, `receipts`, `payments`, `journal_entries` | `/finance/statements`, `/e/invoices` |
| **3.20** | Legal, AML/KYC & Licensing | `kyc_checks`, `aml_reports`, `compliance_items`, `compliance_cases` | `/rera`, `/compliance`, `/e/compliance_cases` |
| **3.21** | Document Vault & E-signatures | `company_documents`, `studio_documents`, `attachments` | `/documents`, `/studio` |
| **3.22** | AI Voice Receptionist & Call Centre | `voice_calls` | `POST /api/voice/inbound`, `/e/voice_calls` |
| **3.23** | Marketing & Growth Attribution | `campaigns`, `leads` | `/e/campaigns`, `/market` |
| **3.24** | Customer / Investor Portals | `investors`, `owner_statements`, `distributions` | `/owners`, `/t/:token` |
| **3.25** | Procurement, Assets & Facilities | `procurement_requests`, `purchase_orders`, `assets` | `/e/procurement_requests`, `/e/assets` |
| **3.26** | Recruitment & Offboarding | `hr_lifecycle_cases`, `candidates` | `POST /api/hr-lifecycle/:id/separate`, `/e/hr_lifecycle_cases` |
| **3.27** | Universal Task & Approval Engine | `universal_approvals`, `tasks`, `work_items` | `POST /api/universal-approvals/:id/decide`, `/e/universal_approvals` |
| **3.28** | CEO & Department Command Centres | `audit_events` + live cross-domain aggregation | `GET /api/enterprise/command-centre`, `/enterprise/master-os` |
| **3.29** | Fraud & Collusion Detection | `compliance_cases` | `POST /api/compliance-cases/:id/decide`, `/e/compliance_cases` |
| **3.30** | Data Loss & Insider Risk (DLP) | `compliance_cases` | `POST /api/dlp/check-export`, `GET /api/e/:entity/export.csv` |
| **3.31** | Lead Ownership Protection | `lead_assignment_logs` | `POST /api/leads/:id/reassign-protected`, `/e/lead_assignment_logs` |
| **3.32** | Developer Commission Assurance | `commission_entitlements` | `POST /api/commission-entitlements/:id/clawback` |
| **3.33** | Quality Assurance & Client Reviews | `qa_reviews` | `POST /api/qa-reviews/:id/challenge`, `/e/qa_reviews` |
| **3.34** | AI Functional Agents | `ai_agents`, `ai_runs`, `ai_action_queue` | `/ai` |
| **3.35** | Infrastructure, Cybersecurity & DR | `dr_exercises` | `/e/dr_exercises`, `/admin/backup` |

---

## 3. Ten Cross-Department Workflows (4.01 – 4.10)

- **4.01 Employee Day & Reporting**: Attendance check-in (`attendance_events`) → CRM/viewing execution → immutable system activity snapshot (`computeActivitySnapshot`) → employee narrative submission (`submitDailyReport`) → freeze → independent line-manager versioned review (`reviewDailyReport`). Approved leave days are automatically exempt; missing reports generate manager follow-up tasks without automatic penalties.
- **4.02 Agent Inventory to Approved Listing**: Broker submits unit (`inventory_submissions`) → automatic building/unit duplicate check (`7.01`) → independent inventory verification (`verifyInventorySubmission('inventory')`) → compliance Trakheesi verification (`verifyInventorySubmission('compliance')`) → second-person manager publication (`approveAndPublishInventory`) creating canonical `properties` and `listing_mandates`.
- **4.03 Transaction-Specific NOC Request**: Qualifying transaction (`sales_contracts` or `jobs`) required → seller authorisation & service-charge clearance → portal submission (`submitDeveloperNoc`) → NOC certificate upload (`uploadDeveloperNocDocument`, keeps closing locked) → independent reviewer verification (`verifyDeveloperNoc`) unlocking closing stage.
- **4.04 Lead to Closed Secondary Sale**: Controlled stage progression (`advanceTransactionStage`) validating KYC/AML, RERA Forms A/B/F, verified Developer NOC, external DLD Title Deed reference, and Tax Invoice + Bank Receipt reconciliation, plus all **11 Secondary Sale Exception States** (`raiseTransactionException` / `resolveTransactionException`).
- **4.05 Off-Plan Reservation to Collection**: Distinguishes EOI from confirmed developer SPA/booking (`developer_booking_confirmed`), tracks Oqood registration, developer commission invoicing, receipt collection, and developer clawback recalculation (`recordDeveloperClawback`).
- **4.06 Employee/Agent Joining to Regulated Activation**: PRO visa workflow (`advanceImmigrationCase`) + independent HR work-authorisation check (`activateAgentAuthorisation('hr')`) + Compliance RERA BRN/exam/AML sign-off (`activateAgentAuthorisation('compliance')`).
- **4.07 Company WhatsApp Enquiry**: Inbound/outbound WABA tracking (`communications`), automatic personal-number diversion detection (`7.04`), audited supervisory review & ownership handoff (`superviseCommunication` → `supervisor_access_logs`), and provider outage fallback (`handleCommunicationOutage`).
- **4.08 Commission Eligibility & 3-Way Payout**: Tracks `entitlement_amount`, `earned_amount`, `invoiced_amount`, `collected_amount`, `payable_amount`, and `paid_amount`. Enforces two-person out-of-band verification on IBAN swaps (`7.06`), blocks manager collusion (`7.11`), and requires three-way segregation (`initiateCommissionPayout` ≠ `approveCommissionPayout` ≠ `executeCommissionPayout`).
- **4.09 Client Complaint to Resolution**: Logs complaint in `compliance_cases` with `legal_hold = true` (blocking record deletion), excludes implicated managers (`assignComplianceInvestigator` / `decideComplianceCase`), and supports subject appeals (`appealComplianceCase` / `resolveComplianceAppeal`).
- **4.10 Employee Separation / Emergency Removal**: Single-action execution (`executeEmployeeSeparation`) disables user account, revokes active sessions and API keys, reassigns open leads, WhatsApp threads, viewings, and NOC tasks to the designated handover recipient, and preserves all historical records under legal hold.

---

## 4. Production Operations & Backup/DR Runbook

1. **Typecheck & Build**:
   ```bash
   npm run typecheck
   npm run build
   ```
2. **Automated Verification Suites**:
   ```bash
   npx tsx tests/ai-controls.ts
   npx tsx tests/voice.ts
   npx tsx tests/enterprise-master-spec.ts
   ```
3. **Backup & Disaster Recovery Verification (`3.35` / `7.15`)**:
   - Trigger verified encrypted snapshot via `/admin/backup` (`POST /api/admin/backup`).
   - Record RTO/RPO restoration drill results and SHA-256 checksum validation in `/e/dr_exercises`.
