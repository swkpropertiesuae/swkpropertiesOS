# AI Receptionist (voice)

The AI Receptionist answers your office phone line 24/7 in English and Arabic (and Hindi/Urdu or Russian when the caller uses them). It qualifies buyers and tenants, logs maintenance problems, takes call-back requests and hands urgent or sensitive calls to staff. Every call is logged under **AI → Voice** with a summary and the full transcript.

## How a call flows

```
Caller ──► du SIP trunk ──► voice platform ──► SWK OS  /api/public/voice/<secret>/turn
           (your number)    (answers, speech     │   AI Receptionist + tools
                             to text, text to    │   (listings, leads, tickets, tasks)
                             speech, transfer)   ▼
                                              reply text (+ "transfer" when needed)
```

SWK OS never handles audio. A **voice platform** sits between the carrier and the OS: it answers the call, turns what the caller says into text, sends it to the OS, and speaks the reply. The OS keeps the conversation (so the platform only sends the call id and the new words), runs the AI Receptionist with its tools, and logs the call.

## What you need

1. **A du Business SIP trunk with your office number(s).** Ask du Business for SIP trunking (they may sell it under a different product name). Questions to put to them:
   - Which number(s) can be delivered on the trunk, and can an existing office number be ported or forwarded to it?
   - How many simultaneous calls (channels) are included?
   - How does the trunk authenticate: IP allow-list or SIP registration? Which IP address or hostname does the voice platform use?
   - Which codecs are supported (G.711 a-law is the common baseline)?
   - Is the caller's number delivered on inbound calls (caller ID passthrough)? The OS uses it to recognise customers and leads.
   - Can calls be transferred to another number (SIP REFER or bridging) and what does that cost?
   - Any TDRA/regulatory conditions for routing calls through a third-party platform.
2. **A voice platform** that accepts a SIP trunk, supports Arabic and English speech, and can call an HTTPS URL for each thing the caller says. The OS side is the same for every platform; each platform needs a small mapping to the three endpoints below. Check the platform's Arabic (Gulf dialect) speech recognition and voice quality with real recordings before committing.
3. **An AI model** connected under *Integrations → AI employees*. For phone use choose a fast model: callers notice every second of delay.

## Set it up in SWK OS

1. *Integrations → Voice*: tick **Enable the voice gateway**, enter the **staff number for transfers** (optional), review the opening lines, then **Generate** the base URL. Copy it now, it is shown once.
2. *AI → Employees*: switch **AI Receptionist** on. It starts switched off like every AI employee.
3. *AI → Voice*: use **Try the receptionist** to rehearse calls in text before any telephone is connected. Leads and tickets it creates are real.
4. Give the base URL to your voice platform and map the three endpoints below.
5. Place a real test call from a mobile phone, in English and Arabic, and check it under *AI → Voice*.

## Endpoints for the voice platform

All three live under the secret base URL, `https://<your-os>/api/public/voice/<secret>`. A wrong secret or a disabled gateway answers `404`. Field names in brackets are accepted aliases.

**`GET <base>/greeting`**: what to say when the call connects.
```json
{ "en": "Thank you for calling SWK Properties L.L.C. You are speaking with our AI assistant, and this call may be recorded to help us serve you. How can I help you today?",
  "ar": "شكراً لاتصالكم بـ …", "record_notice": true, "transfer_configured": true }
```

**`POST <base>/turn`**: one caller utterance in, one reply out.
```json
{ "call_id": "abc123", "from": "+971501234567", "to": "+97143001111", "text": "I'm looking for a two bedroom to buy in Marina" }
```
(`call_id` / `callId` / `call_sid`, `from` / `caller` / `caller_id`, `text` / `transcript` / `utterance`.) Response:
```json
{ "call_id": "abc123", "reply": "I found a two bedroom in Marina Gate for one point five million dirhams. Shall I book a viewing?", "action": "none" }
```
Speak `reply`. When `action` is `"transfer"`, speak the reply and then connect the caller to `transfer_to`. The reply is always plain speech (no markdown, links or emoji). If the receptionist is switched off, AI is not connected or the model fails, the reply is a short apology and the action is a transfer when a staff number is set, so a caller is never left in silence.

**`POST <base>/end`**: the call finished.
```json
{ "call_id": "abc123", "duration_sec": 94 }
```
Closes the log and writes a two-sentence summary. A call with no caller speech is recorded as *Abandoned*.

## What the receptionist can do

| Tool | Effect |
|---|---|
| `find_caller` | Matches the caller's number to a customer or lead, for greeting and routing only. |
| `lookup_listings` | Reads available listings (area, size, price, payment plan). Never returns owner details or internal notes. |
| `capture_lead` | Creates a lead (source *Inbound call*) or adds to the caller's existing lead. One lead per phone number. |
| `request_viewing` | Creates a high-priority task for the sales team to confirm the time. It does not book a slot itself. |
| `report_maintenance_issue` | Creates a *Maintenance* ticket. An emergency is flagged Urgent, alerts the duty team and WhatsApps the owner numbers. |
| `request_callback` | Creates a call-back task. |
| `transfer_call` | Hands the call to the staff number, or refuses and falls back to a call-back when none is set. |

Anything that sends a message to an outsider (e-mail, WhatsApp) still needs human approval; the receptionist has no such tools.

## Safety and compliance

- **It says it is an AI.** The opening line discloses this, and the receptionist answers honestly if asked.
- **Recording notice.** The default opening line tells callers the call may be recorded. Keep *Tell callers the call may be recorded* on if the voice platform records audio. Transcripts are always stored.
- **Caller ID is not identity.** Numbers can be spoofed, so even for a recognised customer the receptionist never reads out balances, contract terms or personal data. It routes, takes a message or logs a request. The caller's number comes from the telephone network; a number the AI model types into a tool is ignored.
- **Never:** quotes fees or commission, negotiates, promises a price, availability or viewing time, gives legal/tax/mortgage advice, discusses other customers, or accepts card, bank, Emirates ID or passport details by phone.
- **Callers are untrusted.** Speech is treated as untrusted input, and the receptionist can only use the seven tools above.
- **Emergencies.** For danger to life the receptionist tells callers to call 999, 998 or 997 and logs the problem for the duty team.
- **UAE rules to check with your adviser:** PDPL (what you tell callers, how long transcripts and recordings are kept), TDRA rules for routing calls through third-party platforms, and, for any outbound calling you add later, the TDRA do-not-call rules. There is no automatic transcript retention job yet; delete or anonymise old rows in *AI → Voice calls* according to your retention policy.

## Limits to know about

- Reply speed depends on the AI model and the voice platform. The receptionist uses at most four model steps and short answers per turn, but a slow free-tier model will feel slow on a phone. Test with your real provider.
- Arabic quality depends on the platform's speech recognition and voice, not on the OS.
- Inbound calls only. Outbound calling (speed-to-lead callbacks, reminders) is a separate agent.
- Viewings are requested, not booked: a colleague confirms the time and creates the viewing.

## Tests

`npm run test:all` includes the `voice` suite (`tests/voice.ts`): listing privacy, lead de-duplication, caller-ID precedence, tool policy, multi-turn calls with a scripted model, transfer, summary, failure fallback and the secret-protected endpoints. It calls no external service.
