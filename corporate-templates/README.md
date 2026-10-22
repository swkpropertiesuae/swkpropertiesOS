# DigitalBurj Business OS Corporate Template Set – SWKPROPOS

## Start here
This pack contains document designs for the SWK Properties UAE real estate enterprise, each supplied as editable DOCX and reusable DOTX, plus supporting emails and marketing material, logo assets, and ready-to-print legal documents.

Open a DOTX in Microsoft Word to create a new document without overwriting the template. In Google Docs or LibreOffice, use the DOCX copy. Replace all bracketed fields and review the final page layout after entering real data. The blank templates are not completed transactions.

## Company details
Office: Dubai, United Arab Emirates
Phone: +971 50 422 1950
Email: info@swkpropertiesuae.com
Website: [www.swkpropertiesuae.com](https://www.swkpropertiesuae.com)
Hours: Sun-Thu 09:00-18:00 GST

Before issue, verify and enter the full registered address, trade licence, VAT TRN if registered, bank beneficiary and IBAN, authorised signatories and approved contract terms. No registration, tax number, banking detail or certification has been invented. In the marketing material, claims are limited to how the company works; add years in operation, memberships and certifications only when you can prove them.

## Folder layout
- `documents/<category>/` – SWK-001 to SWK-050 as `.docx` and `.dotx`
- `emails/` – Email templates for property enquiries, quotes, and payments
- `marketing/` – pamphlet, brochure, capability statement and flyers (`.html` editable source, `.pdf` print-ready)
- `assets/` – logo files (primary, reverse, icon)
- `inventory.json` – machine-readable list of all documents

To regenerate everything after editing the content: `npm run docs:build`. The same content, plus the email and marketing pieces, is built into the DigitalBurj OS **Document Studio** (`npm run docs:studio`), where staff fill, edit, generate text with AI and print the documents without Word.

## Format
Letter portrait 8.5 x 11 inches; 0.95 inch side margins; Instrument Sans 10.5 pt body; 22 pt black titles; 11 pt bold black section headings; 1.12 body line spacing; 9 pt tables with repeatable header rows, light grey borders and expandable rows. Colour is concentrated in the approved logo; restrained graphite accents keep operational forms readable. Headers have no decorative rule. Footer contact details and automatic page number repeat on every page. Marketing pieces use the brand emerald and graphite on a dark band and are designed for Letter; resize to A4 before printing in the UAE if your printer requires it.

Body text and descriptions are left aligned. Short quantities, dates and status fields use compact columns. Enter monetary amounts consistently to two decimals and check totals manually; these Word templates do not calculate. Dates should use DD MMM YYYY, times should include GST or the relevant local time zone, and property measurements must specify their units.