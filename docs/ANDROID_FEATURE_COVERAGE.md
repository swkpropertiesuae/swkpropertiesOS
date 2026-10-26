# SWK ONE Android — requirement coverage

Coverage of the 65 ideas in the attached SWK ONE 2.0 brief. **Record access is not a claim that a dedicated feature is complete.** Native Workspaces follow the existing API permissions. Production validation and actual service configuration remain required.

| # | Requested feature | Status in this implementation |
|---|---|---|
| 1 | Personal workday dashboard | Implemented — Personal workday with own tasks, field assignments and attendance. |
| 2 | Automatic daily activity journal | Partial / existing workflow — Backend system activity snapshot is included in submitted reports; no standalone journal UI. |
| 3 | One-tap end-of-day report | Implemented — Native report narrative and atomic submit/freeze; server-derived evidence. |
| 4 | Workday checklist | Partial / existing workflow — Tasks/work-items available in native record screens; no dedicated daily checklist. |
| 5 | Attendance history and corrections | Partial / existing workflow — Attendance records/correction fields available; no dedicated correction approval journey. |
| 6 | Break and field-duty switch | Not implemented — requires additional native/backend product work. |
| 7 | Shift handover | Partial / existing workflow — Handover records available through Workspaces where permitted. |
| 8 | Leave and emergency absence requests | Partial / existing workflow — Native leave forms and manager decision workflow. |
| 9 | HR document wallet | Partial / existing workflow — HR metadata, uploads and private PDF/image previews; no dedicated HR wallet layout. |
| 10 | Expiry reminders | Partial / existing workflow — Existing expiry fields and company notifications; no new push scheduling. |
| 11 | Company knowledge assistant | Not implemented — requires additional native/backend product work. |
| 12 | Employee onboarding checklist | Partial / existing workflow — Existing lifecycle/qualification/knowledge records, no guided onboarding wizard. |
| 13 | Employee exit checklist | Partial / existing workflow — Lifecycle records, no native exit automation action. |
| 14 | AI-powered lead briefing | Not implemented — requires additional native/backend product work. |
| 15 | Lead priority queue | Partial / existing workflow — Searchable lead list with existing fields; no new priority algorithm. |
| 16 | One-tap call logging | Partial / existing workflow — Native dialer handoff and record notes; no automatic call outcome capture. |
| 17 | Viewing itinerary | Partial / existing workflow — Native viewing records; no route/day itinerary screen. |
| 18 | Navigation handoff | Implemented — Native maps handoff from viewing meeting point. |
| 19 | Viewing check-in and checkout | Partial / existing workflow — Field assignment location evidence; no dedicated viewing arrival/checkout journey. |
| 20 | Client viewing feedback | Partial / existing workflow — Viewing feedback forms use existing fields. |
| 21 | Property comparison builder | Not implemented — requires additional native/backend product work. |
| 22 | Verified alternative suggestions | Not implemented — requires additional native/backend product work. |
| 23 | Digital offer submission | Partial / existing workflow — Existing offer records through metadata forms; no dedicated offer composer. |
| 24 | Negotiation history | Partial / existing workflow — Existing record history/notes; no native negotiation timeline. |
| 25 | Mortgage readiness checklist | Partial / existing workflow — Existing transaction fields/checklists; no separate mortgage checklist screen. |
| 26 | Personal pipeline dashboard | Partial / existing workflow — Existing deals/opportunities accessible; no personal pipeline chart. |
| 27 | Deal closing checklist | Partial / existing workflow — Transaction records and advance/exception workflows; no dedicated closing checklist. |
| 28 | Quick property sourcing | Partial / existing workflow — Native inventory-submission form; completion speed not benchmarked. |
| 29 | Camera-assisted inventory entry | Not implemented — requires additional native/backend product work. |
| 30 | Duplicate unit warning | Partial / existing workflow — Backend duplicate/conflict detection retained, with conflict resolution action. |
| 31 | Owner authority checklist | Partial / existing workflow — Existing authority/document verification fields and backend publication gate. |
| 32 | Owner follow-up timeline | Partial / existing workflow — Owner records and comments; no dedicated owner timeline. |
| 33 | Price verification reminder | Partial / existing workflow — Existing verification dates; no new local reminder scheduler. |
| 34 | Property condition checklist | Partial / existing workflow — Existing inspection records in native forms. |
| 35 | Image quality assistant | Not implemented — requires additional native/backend product work. |
| 36 | Property key handover | Partial / existing workflow — Existing handover/key fields; no dedicated receipt flow. |
| 37 | Listing publication status | Partial / existing workflow — Inventory status and verification/publication workflows. |
| 38 | Developer NOC status tracker | Partial / existing workflow — NOC records and submission/issue/verify workflow. |
| 39 | Owner withdrawal alert | Partial / existing workflow — Existing withdrawn/status fields; no push alert. |
| 40 | Duty location sharing | Implemented — Explicit scheduled-duty sharing with visible foreground notification. |
| 41 | Arrived-at-property confirmation | Partial / existing workflow — Scheduled field session evidence; no dedicated arrival action. |
| 42 | Scheduled route overview | Partial / existing workflow — Appointment records and maps handoff; no map route overview. |
| 43 | Missed appointment alert | Partial / existing workflow — Existing company notifications may contain appointment alerts; no new scheduler. |
| 44 | Late-arrival communication | Partial / existing workflow — Dial/email handoff only; no prefilled delay message. |
| 45 | Client no-show report | Partial / existing workflow — Viewing feedback and status fields. |
| 46 | Emergency SOS | Partial / existing workflow — Safety flag saved to record; no emergency dispatch or guaranteed colleague notification. |
| 47 | Safety check-in reminder | Partial / existing workflow — No local safety timer; existing work/task records usable. |
| 48 | Battery and connectivity warning | Partial / existing workflow — Connection errors displayed, service stops after repeated failures; no battery dashboard. |
| 49 | Offline evidence queue | Partial / existing workflow — Encrypted manual report drafts only; no offline evidence outbox. |
| 50 | Location privacy dashboard | Implemented — Sharing explanation and Stop control; privacy audit log remains available according to role. |
| 51 | Assigned business conversations | Partial / existing workflow — Company communications records according to existing permissions; no native messaging inbox. |
| 52 | Unanswered message alerts | Partial / existing workflow — Existing SLA fields visible; no push delivery. |
| 53 | Conversation handover | Partial / existing workflow — Native supervisor handover action supports exact new owner ID; backend permissions apply. |
| 54 | AI reply drafts | Not implemented — requires additional native/backend product work. |
| 55 | Multilingual message drafts | Not implemented — requires additional native/backend product work. |
| 56 | Call-back queue | Partial / existing workflow — Existing callbacks/tasks through native forms; no dedicated queue. |
| 57 | Client appointment confirmation | Partial / existing workflow — Existing viewing status/notes; no customer confirmation link. |
| 58 | Customer complaint escalation | Partial / existing workflow — Existing tickets/complaints and supervision action. |
| 59 | Communication quality feedback | Partial / existing workflow — Existing QA review records and challenge workflow. |
| 60 | Post-transaction referral requests | Partial / existing workflow — Existing tasks/communication notes; no automated referral request. |
| 61 | Verified activity score | Partial / existing workflow — Existing verified report evidence; no new activity scoring algorithm. |
| 62 | Personal commission tracker | Partial / existing workflow — Native commission records and payout workflow; no personal-only aggregation. |
| 63 | Training milestones | Partial / existing workflow — Knowledge/qualification records, acknowledge and verification actions. |
| 64 | Team recognition | Partial / existing workflow — Existing performance records accessible if permitted; no recognition feed. |
| 65 | Improvement coaching | Partial / existing workflow — Existing QA/coaching records and review notes. |

## Security scope

Encrypted session/draft storage, HTTPS-only networking, backup exclusion, screen protection, optional device unlock and existing server session revocation are implemented. Individual device registration, cryptographic device attestation, short-lived mobile token exchange, guaranteed offline sync and push notification delivery are not implemented. Existing generic module/record permissions are reused; the new workday and field endpoints additionally enforce own-employee identity.

## Acceptance evidence

- `tests/mobile.ts`: authenticated identity, password gate, CSRF header, office configuration, mock/stale/outside-area rejection, duplicate clocking, own-duty isolation, off-duty denial, report freeze and server-derived metrics, disabled-account revocation.
- `DutyWindowTest`: UTC interpretation independent of phone timezone and exclusive deadline boundary.
- Existing web/API typecheck/build and auth security regression suite are run separately.
- Successful APK assembly proves compilation, not field reliability. Physical-device acceptance is still required.
