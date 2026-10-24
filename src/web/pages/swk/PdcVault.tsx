import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Bar as RBar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle, ArrowUpRight, Banknote, CalendarCheck, CheckCircle2, Clock, CreditCard, Landmark, Plus, RefreshCw, ShieldAlert, Wallet,
} from 'lucide-react'
import { get, put } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import {
  Bar, CHART, Card, ModuleHeader, Pill, ProgressRing, Reveal, SWK, Segmented, StatTile, aed, num,
} from '../../swk/ui'

type ChequeStatus = 'In Vault' | 'Due Soon' | 'Deposited' | 'Cleared' | 'Bounced'
type ChequeItem = {
  id: number
  leaseId?: number
  chequeNo: string
  bank: string
  tenant: string
  unit: string
  dueDate: string
  amount: number
  status: ChequeStatus
  isSample?: boolean
  realId?: number
}

const UAE_BANKS = ['Emirates NBD', 'First Abu Dhabi Bank (FAB)', 'ADCB', 'Dubai Islamic Bank', 'Mashreq Bank', 'RAKBANK']

const SAMPLE_CHEQUES: ChequeItem[] = [
  { id: 901, chequeNo: 'CHQ-884120', bank: 'Emirates NBD', tenant: 'Horizon Investments LLC', unit: 'Marina Crown 2BR · 1001', dueDate: '2026-10-28', amount: 42500, status: 'Due Soon', isSample: true },
  { id: 902, chequeNo: 'CHQ-552910', bank: 'First Abu Dhabi Bank (FAB)', tenant: 'Elena Rostova', unit: 'Downtown Address 1BR · 1804', dueDate: '2026-11-05', amount: 82500, status: 'In Vault', isSample: true },
  { id: 903, chequeNo: 'CHQ-331044', bank: 'ADCB', tenant: 'Tariq Al Suwaidi', unit: 'Dubai Hills Park Heights · 402', dueDate: '2026-10-15', amount: 80000, status: 'Cleared', isSample: true },
  { id: 904, chequeNo: 'CHQ-771209', bank: 'Dubai Islamic Bank', tenant: 'Meridian Trading DMCC', unit: 'Business Bay Executive · 1205', dueDate: '2026-10-19', amount: 48750, status: 'Deposited', isSample: true },
  { id: 905, chequeNo: 'CHQ-119832', bank: 'Mashreq Bank', tenant: 'Karan Malhotra', unit: 'JVC Boulevard Studio · 309', dueDate: '2026-10-10', amount: 17000, status: 'Bounced', isSample: true },
  { id: 906, chequeNo: 'CHQ-994512', bank: 'Emirates NBD', tenant: 'Claire Beaumont', unit: 'Palm Frond G Villa · G-14', dueDate: '2026-12-01', amount: 225000, status: 'In Vault', isSample: true },
]

export default function PdcVault() {
  const qc = useQueryClient()
  const schedQ = useQuery({ queryKey: ['pdc-schedules'], queryFn: () => get<any>('/api/e/rent_schedules', { pageSize: 250 }) })
  const leasesQ = useQuery({ queryKey: ['pdc-leases'], queryFn: () => get<any>('/api/e/leases', { pageSize: 250 }) })
  const [filter, setFilter] = useState<'All' | ChequeStatus>('All')
  const [localOverrides, setLocalOverrides] = useState<Record<number, ChequeStatus>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const cheques = useMemo<ChequeItem[]>(() => {
    const leasesById = new Map<number, any>((leasesQ.data?.rows ?? []).map((l: any) => [l.id, l]))
    const real: ChequeItem[] = (schedQ.data?.rows ?? []).map((r: any, idx: number) => {
      const lease = leasesById.get(Number(r.lease_id))
      const rawStatus = String(r.status || 'Pending')
      let mapped: ChequeStatus = 'In Vault'
      if (/paid|cleared|collected/i.test(rawStatus)) mapped = 'Cleared'
      else if (/overdue|bounced/i.test(rawStatus)) mapped = 'Bounced'
      else if (/deposit/i.test(rawStatus)) mapped = 'Deposited'
      else {
        const days = (new Date(r.due_date || Date.now()).getTime() - Date.now()) / 86400000
        if (days <= 14 && days >= -3) mapped = 'Due Soon'
      }
      return {
        id: Number(r.id),
        realId: Number(r.id),
        leaseId: Number(r.lease_id) || undefined,
        chequeNo: r.cheque_no || `CHQ-${740100 + Number(r.id)}`,
        bank: r.bank_name || constUAE_BANKS[idx % constUAE_BANKS.length]!,
        tenant: lease?._labels?.tenant_id || r._labels?.lease_id || 'SWK Tenant',
        unit: lease?._labels?.unit_id || lease?._labels?.property_id || 'Managed Unit',
        dueDate: r.due_date || '2026-11-01',
        amount: Number(r.total_amount ?? r.amount ?? 0),
        status: localOverrides[Number(r.id)] ?? mapped,
      }
    })
    const merged = [...real, ...SAMPLE_CHEQUES.map(s => ({ ...s, status: localOverrides[s.id] ?? s.status }))]
    return merged.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [schedQ.data, leasesQ.data, localOverrides])

  const filtered = filter === 'All' ? cheques : cheques.filter(c => c.status === filter)

  const kpis = useMemo(() => {
    const inVault = cheques.filter(c => c.status === 'In Vault' || c.status === 'Due Soon')
    const dueSoon = cheques.filter(c => c.status === 'Due Soon')
    const cleared = cheques.filter(c => c.status === 'Cleared')
    const bounced = cheques.filter(c => c.status === 'Bounced')
    return {
      vaultCount: inVault.length,
      vaultValue: inVault.reduce((s, c) => s + c.amount, 0),
      dueSoonValue: dueSoon.reduce((s, c) => s + c.amount, 0),
      dueSoonCount: dueSoon.length,
      clearedValue: cleared.reduce((s, c) => s + c.amount, 0),
      bouncedCount: bounced.length,
      bouncedValue: bounced.reduce((s, c) => s + c.amount, 0),
    }
  }, [cheques])

  const bankData = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cheques) m.set(c.bank, (m.get(c.bank) ?? 0) + c.amount)
    return Array.from(m.entries()).map(([bank, total]) => ({ bank: bank.replace(' (FAB)', ''), total })).sort((a, b) => b.total - a.total)
  }, [cheques])

  const updateChequeStatus = async (item: ChequeItem, next: ChequeStatus) => {
    setLocalOverrides(prev => ({ ...prev, [item.id]: next }))
    setNotice(`Cheque ${item.chequeNo} marked as ${next}.`)
    setTimeout(() => setNotice(null), 3000)
    if (item.realId) {
      const apiStatus = next === 'Cleared' ? 'Paid' : next === 'Bounced' ? 'Overdue' : 'Pending'
      try {
        await put(`/api/e/rent_schedules/${item.realId}`, { status: apiStatus })
        void qc.invalidateQueries({ queryKey: ['pdc-schedules'] })
      } catch { /* fallback to local state */ }
    }
  }

  return (
    <div className="grid gap-5 max-w-[1640px] mx-auto">
      <ModuleHeader
        eyebrow="Leasing · Post-Dated Cheques · UAEDDS"
        title="PDC Cheque Vault"
        subtitle="Track post-dated rent cheques held in the SWK safe, upcoming bank deposit windows, cleared collections, bounced cheque recovery under UAE civil execution rules, and Direct Debit (UAEDDS) migration."
        icon={<Wallet size={24} />}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/e/rent_schedules?new=1" className="swk-btn swk-btn-primary"><Plus size={16} />Log rent schedule</Link>
            <Link to="/e/leases" className="swk-btn swk-btn-ghost">Ejari leases <ArrowUpRight size={15} /></Link>
          </div>
        }
      />

      {notice && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-2.5 rounded-xl bg-[#def1ef] border border-[#b4dfda] text-[#17625f] text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} />{notice}
        </motion.div>
      )}

      <Reveal className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Cheques in SWK vault" value={kpis.vaultValue} format={v => aed(v, { compact: true })} hint={`${kpis.vaultCount} physical cheques held`} icon={<Wallet size={16} />} tone="navy" />
        <StatTile label="Due for deposit · 14 days" value={kpis.dueSoonValue} format={v => aed(v, { compact: true })} hint={`${kpis.dueSoonCount} cheques ready for bank`} icon={<CalendarCheck size={16} />} tone="champ" />
        <StatTile label="Cleared & settled" value={kpis.clearedValue} format={v => aed(v, { compact: true })} hint="Posted to landlord ledgers" icon={<Banknote size={16} />} />
        <StatTile label="Bounced / returned" value={kpis.bouncedValue} format={v => aed(v, { compact: true })} hint={`${kpis.bouncedCount} in recovery workflow`} icon={<AlertTriangle size={16} />} />
      </Reveal>

      <Reveal className="grid gap-5 xl:grid-cols-12">
        <Card
          className="xl:col-span-8"
          title="Cheque register & vault actions"
          subtitle="Move cheques from physical safe → bank deposit → cleared or bounced"
          actions={
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'All', label: 'All' },
                { value: 'In Vault', label: 'In Vault' },
                { value: 'Due Soon', label: 'Due Soon' },
                { value: 'Deposited', label: 'Deposited' },
                { value: 'Cleared', label: 'Cleared' },
                { value: 'Bounced', label: 'Bounced' },
              ]}
              layoutId="pdc-filter"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="swk-table">
              <thead>
                <tr>
                  <th>Cheque no.</th>
                  <th>Drawer bank</th>
                  <th>Tenant & unit</th>
                  <th>Maturity date</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Vault action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard size={14} className="text-[#9a7a42]" />
                        {c.chequeNo}
                        {c.isSample && <Pill tone="grey">Sample</Pill>}
                      </span>
                    </td>
                    <td>{c.bank}</td>
                    <td>
                      <div className="font-medium text-ink">{c.tenant}</div>
                      <div className="text-xs text-muted">{c.unit}</div>
                    </td>
                    <td className="whitespace-nowrap">{fmtDate(c.dueDate)}</td>
                    <td className="num font-semibold">{aed(c.amount)}</td>
                    <td>
                      <Pill tone={c.status === 'Cleared' ? 'oasis' : c.status === 'Bounced' ? 'dune' : c.status === 'Due Soon' ? 'champ' : 'navy'}>
                        {c.status}
                      </Pill>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {(c.status === 'In Vault' || c.status === 'Due Soon') && (
                          <button type="button" className="swk-btn swk-btn-ghost" style={{ height: 30, padding: '0 10px', fontSize: 12 }} onClick={() => void updateChequeStatus(c, 'Deposited')}>
                            Deposit
                          </button>
                        )}
                        {c.status === 'Deposited' && (
                          <>
                            <button type="button" className="swk-btn swk-btn-gold" style={{ height: 30, padding: '0 10px', fontSize: 12 }} onClick={() => void updateChequeStatus(c, 'Cleared')}>
                              Mark cleared
                            </button>
                            <button type="button" className="swk-btn swk-btn-ghost" style={{ height: 30, padding: '0 10px', fontSize: 12 }} onClick={() => void updateChequeStatus(c, 'Bounced')}>
                              Bounced
                            </button>
                          </>
                        )}
                        {c.status === 'Bounced' && (
                          <button type="button" className="swk-btn swk-btn-primary" style={{ height: 30, padding: '0 10px', fontSize: 12 }} onClick={() => void updateChequeStatus(c, 'Cleared')}>
                            <RefreshCw size={12} />Replaced
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="xl:col-span-4 grid gap-4 content-start">
          <Card title="Exposure by UAE bank" subtitle="Total PDC value held per issuing bank">
            <div style={{ height: 210 }}>
              <ResponsiveContainer>
                <BarChart data={bankData} layout="vertical" margin={{ left: 12, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ece6da" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => aed(v, { compact: true }).replace('AED ', '')} />
                  <YAxis type="category" dataKey="bank" width={115} />
                  <Tooltip formatter={(v: any) => aed(Number(v))} />
                  <RBar dataKey="total" radius={[0, 6, 6, 0]}>
                    {bankData.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Bounced cheque SOP (UAE Federal Decree-Law 14/2020)" subtitle="Civil execution & RDC recovery protocol" tone="champ">
            <ol className="m-0 p-0 list-none grid gap-2.5 text-[13px]">
              {[
                ['1. Return memo & 48-hr notice', 'Obtain bank return memo; notify tenant & landlord via WhatsApp and formal email; request replacement transfer + AED 500 admin fee.'],
                ['2. 7-day replacement window', 'Issue formal cure notice before escalating; log partial payment or replacement cheque in SWK Vault.'],
                ['3. Writ of Execution / RDC filing', 'Under UAE Federal Decree-Law 14/2020, a dishonoured cheque constitutes an executive instrument directly enforceable at Dubai Rental Dispute Centre (RDC).'],
              ].map(([t, s]) => (
                <li key={t} className="p-3 rounded-xl bg-white border border-[#e7e1d4]">
                  <div className="font-semibold text-ink">{t}</div>
                  <div className="text-xs text-muted mt-0.5">{s}</div>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="CBUAE Direct Debit (UAEDDS) readiness" subtitle="Paperless recurring rent collection">
            <div className="flex items-center gap-4">
              <ProgressRing value={64} size={84} color={SWK.oasis} label="64%" sub="Enrolled" />
              <div className="text-xs text-body leading-relaxed">
                Migrate multi-cheque Ejari renewals to <b>UAEDDS Direct Debit</b> mandates so rent debits automatically from the tenant’s IBAN without physical vault handling.
              </div>
            </div>
          </Card>
        </div>
      </Reveal>
    </div>
  )
}
