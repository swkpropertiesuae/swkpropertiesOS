import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, S, R, D, DT } from '../dsl'

export const job_events: EntityDef[] = [
  {
    key: 'job_events', label: 'Timeline Event', plural: 'Timeline Events', module: 'sales', icon: 'Clock',
    title: ['event_type', 'event_at'], titleSep: ' – ', child: true,
    fields: [
      R('job_id', 'Deal File', 'jobs', { hidden: true, required: true }),
      DT('event_at', 'Date/Time', { required: true, list: true }),
      T('event_type', 'Event Type', { required: true, list: true, search: true }),
      T('description', 'Description', { list: true }),
      T('source', 'Source', { default: 'Manual', list: true }),
      B('visible_to_customer', 'Visible to Customer', { default: true, list: true }),
      R('user_id', 'User', 'users', { list: true }),
    ],
    defaultSort: { field: 'event_at', dir: 'desc' },
  },
]
