import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * State for the phone call a tool is running inside. Tools take only their own arguments, so the voice route
 * wraps each turn in `withCall` and tools such as transfer_call or report_maintenance_issue read it here.
 */
export interface VoiceCallState {
  callRowId: number
  from: string
  partyId: number | null
  leadId: number | null
  ticketId: number | null
  handoff: { reason: string } | null
  outcome: string | null
}

const store = new AsyncLocalStorage<VoiceCallState>()
export const withCall = <T>(state: VoiceCallState, fn: () => Promise<T>): Promise<T> => store.run(state, fn)
export const currentCall = (): VoiceCallState | undefined => store.getStore()

/** Outcomes in priority order: when several happen on one call, the most valuable one is recorded. */
const RANK = ['Abandoned', 'Information given', 'Other', 'Callback requested', 'Lead captured', 'Maintenance logged', 'Viewing requested', 'Transferred to staff']
export function setOutcome(outcome: string) {
  const c = currentCall()
  if (c && RANK.indexOf(outcome) > RANK.indexOf(c.outcome ?? 'Abandoned')) c.outcome = outcome
}
