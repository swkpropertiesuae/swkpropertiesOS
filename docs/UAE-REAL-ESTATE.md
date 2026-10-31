# UAE real estate rules in SWK OS

These features help SWK Properties follow Dubai real estate and anti-money-laundering (AML) rules. They are **indicative aids, not legal advice**. Rates, bands, thresholds and form names come from public rules as understood when they were built. Authorities change them. **Confirm every figure with RERA, DLD, the Financial Intelligence Unit (FIU) or your legal adviser before you rely on it.** Where a number is a setting, you can change it without code.

Scope: Dubai only. Other emirates have different rules and are not covered.

## 1. Advertising permit (Trakheesi) expiry

- Properties carry a **Trakheesi permit no.** and a **Permit expiry** date.
- Listing Studio treats a permit as `Missing`, `No expiry`, `Valid`, `Expiring` (within the warning window), or `Expired`.
- A `Missing` or `Expired` permit blocks the listing from the portal feeds. `Expiring` and `No expiry` show a warning.
- The expiry date appears on the calendar as a deadline.
- The warning window is 30 days (fixed in `src/shared/uae-rules.ts`).

Limit: the app does not check the permit with DLD. It records what your team enters.

## 2. Lease rent increase and notice

- Each lease can hold the **RERA index average rent** for the unit (read it from the RERA rental calculator).
- The lease computes **Allowed increase %** and **Maximum renewal rent** from the bands below, and **Notice deadline** (end date minus the notice days, default 90).
- The renew action (`POST /api/leases/:id/renew`) checks the new rent against the cap and checks that a written rent-change notice was sent before the deadline. It only checks when the rent goes up.
- In `enforce` mode (default) a failing renewal is refused with the reasons. A user can renew anyway by sending an **override reason** (10 or more characters). The reason is written into the lease notes.
- In `advisory` mode the renewal goes through and the warnings are written into the notes.
- Setting: `rent_cap_mode` (`enforce` or `advisory`).

| Current rent is below the index by | Maximum increase |
|---|---|
| up to 10% | 0% |
| 11 – 20% | 5% |
| 21 – 30% | 10% |
| 31 – 40% | 15% |
| more than 40% | 20% |

Limits: bands follow the Dubai rent-increase decree as used by the RERA calculator. Rules about a landlord's own use, major renovation, or sale have separate notice and eviction rules that the app does not model. Agreement between landlord and tenant may change the outcome, which is why an override exists.

## 3. DLD filings tracker

`DLD filings` (menu: Sales & Mandates) records each government form or registration: broker forms, NOC, Oqood, title deed transfer, mortgage registration, Ejari. Each record has a type, status, reference number, due, issue, expiry, submitted and registered dates, the government fee and whether it is paid, and links to the deal, property, contract, lease, client and agent.

Rules enforced:
- A filing cannot be marked `Registered` without a reference number. Registering fills in the dates.
- `Valid until` cannot be before the issue date. Registered cannot be before submitted.
- A registered filing can only be moved to `Expired` or `Cancelled`.
- Filings cannot be deleted.
- Due and expiry dates appear on the calendar.

The app does **not** connect to DLD systems. Staff enter the data.

## 4. KYC and AML

### KYC checks
- Party records have extra fields: PEP flag and details, beneficial owners (25% or more) and the date they were verified, source of funds, last KYC review.
- On a client, `POST /api/kyc/:partyId/checklist` adds the standard checks (identity, residence, address, trade licence, beneficial owners, source of funds, sanctions, PEP, adverse media). Running it twice adds nothing new.
- `GET /api/kyc/:partyId` shows whether the file is complete, lists gaps (pending, failed, expired checks, PEP warning, missing source of funds, missing beneficial owners for companies) and gives the next review date: 6 months for high risk, 12 for medium, 24 for low. These review intervals are an internal policy default. Set your own in your AML policy.

### goAML report log
- `goAML reports` (menu: AML & KYC) logs STR, SAR, REAR, FFR, PNMR and other reports, with reason, amount, dates, goAML reference and compliance officer decision. Check the list of report types against the current FIU guidance.
- Rules enforced: `Filed` needs a goAML reference and sets the filed date. `Not required` needs a written decision. A filed report cannot be edited or reopened. Reports cannot be deleted.
- The internal **File by** date is the detection date plus `aml_filing_days` (default 5). This is an internal target only. The law expects reports **without delay**.
- `POST /api/aml/scan-cash` creates draft reports for cash sales contracts and cash rent receipts at or above `aml_cash_threshold` (default AED 55,000). It creates one draft per source record, so it is safe to run again.
- `GET /api/aml/overview` gives counts: open, overdue, filed, PEP clients, pending and failed KYC checks.

Limits:
- The app **does not file with goAML**. The compliance officer files on the FIU portal and records the reference here.
- Never tell a client that a report is being considered or has been filed (tipping-off is an offence). Keep access to these records limited to the compliance officer. Use roles to do this.
- Cash-threshold rules and which reports apply to which event change. Check the current rules.

## Settings added

| Setting | Default | Use |
|---|---|---|
| `rent_cap_mode` | `enforce` | Refuse or only warn on renewals above the cap |
| `aml_cash_threshold` | 55000 | AED amount for the cash scan |
| `aml_filing_days` | 5 | Days after detection for the internal "File by" date |

All three can be changed with `PUT /api/admin/settings`.

## Tests

- `tests/uae-rules.ts` – pure rules (no server).
- `tests/uae-regulatory.ts` – API behaviour: permit expiry, lease cap and notice, DLD filings, KYC, goAML.
