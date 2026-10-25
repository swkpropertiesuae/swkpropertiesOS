import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award, Building2, Check, Copy, DollarSign, FileBarChart, Home, Percent, Plus, UserRoundCog, Wrench,
} from 'lucide-react'
import { get, put } from '../../lib/api'
import {
  Card, EmptyState, ModuleHeader, Pill, ProgressRing, Reveal, SWK, StatTile, aed, num, pct,
} from '../../swk/ui'
import { COMMUNITIES, reraIncrease, visaEligibility, yieldCalc } from '../../swk/uae'
import { useToast } from '../../lib/toast'

type PortfolioUnit = {
  id: number
  title: string
  community: string
  beds: string
  areaSqft: number
  value: number
  annualRent: number
  indexRent: number
  serviceChargePerSqft: number
  status: 'Occupied' | 'Vacant'
  tenant?: string
  leaseEnd?: string
}

type PendingMaint = {
  id: number
  unit: string
  issue: string
  quoteAed: number
  priority: string
  status: string
}

type PortfolioOwner = {
  id: number
  name: string
  nationality: string
  email: string
  phone: string
  units: PortfolioUnit[]
  pendingMaintenance: PendingMaint[]
}

export default function Owner360() {
  const qc = useQueryClient()
  const toast = useToast()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const partiesQ = useQuery({ queryKey: ['owner360-parties'], queryFn: () => get<any>('/api/e/parties', { pageSize: 300 }) })
  const unitsQ = useQuery({ queryKey: ['owner360-units'], queryFn: () => get<any>('/api/e/units', { pageSize: 300 }) })
  const propsQ = useQuery({ queryKey: ['owner360-props'], queryFn: () => get<any>('/api/e/properties', { pageSize: 300 }) })
  const mandatesQ = useQuery({ queryKey: ['owner360-mandates'], queryFn: () => get<any>('/api/e/mandates', { pageSize: 300 }) })
  const leasesQ = useQuery({ queryKey: ['owner360-leases'], queryFn: () => get<any>('/api/e/leases', { pageSize: 300 }) })
  const maintQ = useQuery({ queryKey: ['owner360-maint'], queryFn: () => get<any>('/api/e/maintenance', { pageSize: 300 }) })
  const statementsQ = useQuery({ queryKey: ['owner-stmts'], queryFn: () => get<any>('/api/e/owner_statements', { pageSize: 50 }) })

  const portfolios = useMemo<PortfolioOwner[]>(() => {
    const parties: any[] = partiesQ.data?.rows ?? []
    const units: any[] = unitsQ.data?.rows ?? []
    const props: any[] = propsQ.data?.rows ?? []
    const mandates: any[] = mandatesQ.data?.rows ?? []
    const leases: any[] = leasesQ.data?.rows ?? []
    const maints: any[] = maintQ.data?.rows ?? []

    const propById = new Map<number, any>(props.map(p => [Number(p.id), p]))
    const partyById = new Map<number, any>(parties.map(p => [Number(p.id), p]))

    // Identify all landlord/owner party IDs
    const ownerIds = new Set<number>()
    for (const p of parties) {
      if (p.is_landlord || p.party_type === 'Landlord' || p.party_type === 'Seller') ownerIds.add(Number(p.id))
    }
    for (const u of units) if (u.owner_id) ownerIds.add(Number(u.owner_id))
    for (const l of leases) if (l.landlord_id) ownerIds.add(Number(l.landlord_id))
    for (const m of mandates) if (m.owner_id) ownerIds.add(Number(m.owner_id))

    const result: PortfolioOwner[] = []
    for (const ownerId of ownerIds) {
      const party = partyById.get(ownerId)
      if (!party) continue

      const ownerUnitsMap = new Map<string, PortfolioUnit>()

      // Units directly owned or leased by this landlord
      const directUnits = units.filter(u => Number(u.owner_id) === ownerId)
      for (const u of directUnits) {
        const prop = propById.get(Number(u.property_id))
        const activeLease = leases.find(
          l => Number(l.unit_id) === Number(u.id) && !['Expired', 'Terminated', 'Cancelled'].includes(String(l.status)),
        )
        const commName = prop?.community_id || 'Dubai Marina'
        const comm = COMMUNITIES.find(c => c.name === commName) ?? COMMUNITIES[0]!
        const areaSqft = Number(u.area_sqft) || Number(prop?.area_sqft) || 1000
        const value = Number(u.sale_price) || Number(prop?.price) || areaSqft * comm.ppsf
        const annualRent = Number(activeLease?.annual_rent) || Number(u.rent_annual) || Number(prop?.rent_annual) || Math.round((value * comm.yieldPct) / 100)
        const indexRent = Number(u.bedrooms) >= 3 ? comm.rent3 : Number(u.bedrooms) === 2 ? comm.rent2 : Number(u.bedrooms) === 1 ? comm.rent1 : comm.rentStudio
        const scPerSqft = Number(u.service_charge_per_sqft) || (u.service_charge_annual && areaSqft ? Number(u.service_charge_annual) / areaSqft : comm.serviceCharge)
        const isOccupied = Boolean(activeLease) || u.status === 'Rented'
        const tenantParty = activeLease?.tenant_id ? partyById.get(Number(activeLease.tenant_id)) : u.tenant_id ? partyById.get(Number(u.tenant_id)) : null

        ownerUnitsMap.set(`unit-${u.id}`, {
          id: Number(u.id),
          title: `${prop?.title || u.property_title || 'Property'} · ${u.unit_no}`,
          community: commName,
          beds: u.bedrooms != null ? (Number(u.bedrooms) === 0 ? 'Studio' : `${u.bedrooms} BR`) : '1 BR',
          areaSqft,
          value,
          annualRent,
          indexRent,
          serviceChargePerSqft: Math.round(scPerSqft * 100) / 100,
          status: isOccupied ? 'Occupied' : 'Vacant',
          tenant: tenantParty?.name || activeLease?.tenant_id_label,
          leaseEnd: activeLease?.end_date,
        })
      }

      // Properties mandated by this owner that didn't have unit rows above
      const ownerMandates = mandates.filter(m => Number(m.owner_id) === ownerId)
      for (const m of ownerMandates) {
        if (m.unit_id && ownerUnitsMap.has(`unit-${m.unit_id}`)) continue
        const prop = propById.get(Number(m.property_id))
        if (!prop) continue
        const key = `prop-${prop.id}`
        if (ownerUnitsMap.has(key)) continue
        const commName = prop.community_id || 'Dubai Marina'
        const comm = COMMUNITIES.find(c => c.name === commName) ?? COMMUNITIES[0]!
        const areaSqft = Number(prop.area_sqft) || 1000
        const value = Number(m.asking_price) || Number(prop.price) || areaSqft * comm.ppsf
        const annualRent = Number(m.asking_rent) || Number(prop.rent_annual) || Math.round((value * comm.yieldPct) / 100)
        const indexRent = Number(prop.bedrooms) >= 3 ? comm.rent3 : Number(prop.bedrooms) === 2 ? comm.rent2 : Number(prop.bedrooms) === 1 ? comm.rent1 : comm.rentStudio
        ownerUnitsMap.set(key, {
          id: Number(prop.id) * 10000,
          title: prop.title || m.property_title || `Property #${prop.id}`,
          community: commName,
          beds: prop.bedrooms != null ? (Number(prop.bedrooms) === 0 ? 'Studio' : `${prop.bedrooms} BR`) : '1 BR',
          areaSqft,
          value,
          annualRent,
          indexRent,
          serviceChargePerSqft: comm.serviceCharge,
          status: prop.status === 'Rented' ? 'Occupied' : 'Vacant',
        })
      }

      const ownerUnitIds = new Set(directUnits.map(u => Number(u.id)))
      const pendingMaintenance: PendingMaint[] = maints
        .filter(m => (Number(m.landlord_id) === ownerId || ownerUnitIds.has(Number(m.unit_id))) && !['Completed', 'Cancelled'].includes(String(m.status)))
        .map(m => ({
          id: Number(m.id),
          unit: m.unit_title || m.unit_id_label || `Unit #${m.unit_id}`,
          issue: m.description || m.category || 'Maintenance request',
          quoteAed: Number(m.estimated_cost ?? m.actual_cost ?? 0),
          priority: m.priority || 'Medium',
          status: m.status || 'Reported',
        }))

      result.push({
        id: ownerId,
        name: party.name || `Landlord #${ownerId}`,
        nationality: party.nationality || party.country || 'UAE',
        email: party.email || '—',
        phone: party.mobile || party.phone || '—',
        units: Array.from(ownerUnitsMap.values()),
        pendingMaintenance,
      })
    }

    return result.sort((a, b) => b.units.length - a.units.length)
  }, [partiesQ.data, unitsQ.data, propsQ.data, mandatesQ.data, leasesQ.data, maintQ.data])

  useEffect(() => {
    if (portfolios.length > 0 && (selectedId === null || !portfolios.some(p => p.id === selectedId))) {
      setSelectedId(portfolios[0]!.id)
    }
  }, [portfolios, selectedId])

  const owner = portfolios.find(o => o.id === selectedId) ?? portfolios[0] ?? null

  const summary = useMemo(() => {
    if (!owner) {
      const y = yieldCalc({ price: 0, annualRent: 0, areaSqft: 0, serviceChargePerSqft: 18 })
      const visa = visaEligibility({ value: 0, mortgaged: false, offPlan: false })
      return { totalValue: 0, grossRent: 0, totalSc: 0, y, occ: 0, visa }
    }
    const totalValue = owner.units.reduce((s, u) => s + u.value, 0)
    const grossRent = owner.units.filter(u => u.status === 'Occupied').reduce((s, u) => s + u.annualRent, 0)
    const totalArea = owner.units.reduce((s, u) => s + u.areaSqft, 0)
    const totalSc = owner.units.reduce((s, u) => s + u.areaSqft * u.serviceChargePerSqft, 0)
    const avgSc = totalArea ? totalSc / totalArea : 18
    const y = yieldCalc({ price: totalValue, annualRent: grossRent, areaSqft: totalArea, serviceChargePerSqft: avgSc })
    const occ = owner.units.length ? (owner.units.filter(u => u.status === 'Occupied').length / owner.units.length) * 100 : 0
    const visa = visaEligibility({ value: totalValue, mortgaged: false, offPlan: false })
    return { totalValue, grossRent, totalSc, y, occ, visa }
  }, [owner])

  const maintDecisionMut = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: 'Approved' | 'Declined' }) => {
      return put(`/api/e/maintenance/${id}`, {
        status: decision === 'Approved' ? 'Scheduled' : 'Cancelled',
        approved_at: decision === 'Approved' ? new Date().toISOString() : null,
      })
    },
    onSuccess: (_, vars) => {
      toast.ok(vars.decision === 'Approved' ? 'Maintenance quote approved & scheduled' : 'Maintenance quote declined')
      qc.invalidateQueries({ queryKey: ['owner360-maint'] })
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update maintenance request'),
  })

  const copyStatement = async () => {
    if (!owner) return
    const text = `*SWK Properties — Owner 360 Portfolio Statement*\nLandlord: ${owner.name}\nPortfolio Value: ${aed(summary.totalValue)} (${owner.units.length} units, ${summary.occ.toFixed(0)}% occupied)\nGross Annual Rent: ${aed(summary.grossRent)} | Net Annual Income: ${aed(summary.y.netIncome)}\nGross Yield: ${summary.y.gross.toFixed(2)}% | *Net Yield: ${summary.y.net.toFixed(2)}%*\nResidency Eligibility: ${summary.visa.tier}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch { /* ignore */ }
  }

  return (
    <div className="grid gap-5 max-w-[1640px] mx-auto">
      <ModuleHeader
        eyebrow="Landlords · Net Yield · Mollak Service Charges · Golden Visa"
        title="Owner 360 Portfolio Intelligence"
        subtitle="Dedicated landlord command view combining DLD comparable valuations, net yields after Mollak service charges, RERA Decree 43/2013 renewal uplift opportunities, maintenance quote approvals and Golden Visa qualification."
        icon={<UserRoundCog size={24} />}
        actions={
          <div className="flex items-center gap-2">
            {owner && (
              <button type="button" className="swk-btn swk-btn-gold" onClick={copyStatement}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Statement copied' : 'Share WhatsApp statement'}
              </button>
            )}
            <Link to="/e/parties" className="swk-btn swk-btn-ghost"><Plus size={15} />Add Landlord</Link>
            <Link to="/e/owner_statements" className="swk-btn swk-btn-primary"><FileBarChart size={16} />Owner statements ({statementsQ.data?.total ?? 0})</Link>
          </div>
        }
      />

      {!owner ? (
        <Card title="Landlord Portfolios" subtitle="No landlord portfolios registered yet">
          <EmptyState
            title="No landlord portfolios in your database yet"
            hint="Create a party marked as Landlord in Clients & Parties and link their Units, Mandates, or Leases to view live portfolio yields, RERA renewal uplifts, and Golden Visa status."
            action={
              <div className="flex items-center justify-center gap-2 mt-2">
                <Link to="/e/parties" className="swk-btn swk-btn-primary"><Plus size={15} />Add Landlord Party</Link>
                <Link to="/e/units" className="swk-btn swk-btn-ghost"><Building2 size={15} />Manage Units</Link>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4 flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
              {portfolios.map(p => {
                const val = p.units.reduce((s, u) => s + u.value, 0)
                const active = p.id === owner.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="text-start p-4 rounded-2xl border transition-all cursor-pointer"
                    style={{
                      background: active ? 'linear-gradient(145deg,#14305c,#0b1a33)' : '#fff',
                      borderColor: active ? '#1d3a66' : 'var(--line)',
                      color: active ? '#fff' : 'var(--ink)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-wider" style={{ color: active ? '#dcc8a2' : 'var(--muted)' }}>{p.nationality} · {p.units.length} units</span>
                      <Pill tone={active ? 'champ' : 'navy'}>{aed(val, { compact: true })}</Pill>
                    </div>
                    <div className="font-display text-[17px] font-semibold mt-1">{p.name}</div>
                    <div className="text-xs mt-1 opacity-75">{p.email} · {p.phone}</div>
                  </button>
                )
              })}
            </div>

            <div className="lg:col-span-8 grid gap-3 grid-cols-2 sm:grid-cols-4">
              <StatTile label="Portfolio valuation" value={summary.totalValue} format={v => aed(v, { compact: true })} hint="DLD comparable mark-to-market" icon={<Building2 size={16} />} tone="navy" />
              <StatTile label="Net annual income" value={summary.y.netIncome} format={v => aed(v, { compact: true })} hint={`Gross ${aed(summary.grossRent, { compact: true })}`} icon={<DollarSign size={16} />} tone="champ" />
              <StatTile label="Net yield (after SC)" value={summary.y.net} format={v => `${v.toFixed(2)}%`} hint={`Gross ${summary.y.gross.toFixed(2)}%`} icon={<Percent size={16} />} />
              <StatTile label="Occupancy rate" value={summary.occ} format={v => `${v.toFixed(0)}%`} hint={summary.visa.tier} icon={<Award size={16} />} />
            </div>
          </div>

          <Reveal className="grid gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-8" title="Unit performance, RERA renewal uplift & Hold-vs-Sell signal" subtitle="Compares current lease rent against the RERA index and community yield benchmark">
              {owner.units.length === 0 ? (
                <EmptyState
                  title={`No units linked to ${owner.name} yet`}
                  hint="Assign this landlord as the Owner on Units or Mandates to track unit valuations, net yields, and RERA renewal caps."
                  action={<Link to="/e/units" className="swk-btn swk-btn-primary mt-2"><Plus size={14} />Assign Units</Link>}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="swk-table">
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th className="num">Market value</th>
                        <th className="num">Current rent</th>
                        <th className="num">Net yield</th>
                        <th>RERA renewal cap</th>
                        <th>Advisory signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {owner.units.map(u => {
                        const uy = yieldCalc({ price: u.value, annualRent: u.annualRent, areaSqft: u.areaSqft, serviceChargePerSqft: u.serviceChargePerSqft })
                        const rera = reraIncrease(u.annualRent, u.indexRent)
                        const comm = COMMUNITIES.find(c => c.name === u.community)
                        const signal = uy.net >= (comm?.yieldPct ?? 6) - 0.8 ? 'Hold & Re-let' : 'Candidate to Re-price / Sell'
                        return (
                          <tr key={u.id}>
                            <td>
                              <div className="font-semibold text-ink">{u.title}</div>
                              <div className="text-xs text-muted">{u.community} · {num(u.areaSqft)} sqft · SC AED {u.serviceChargePerSqft}/sqft</div>
                            </td>
                            <td className="num font-semibold">{aed(u.value, { compact: true })}</td>
                            <td className="num">{u.status === 'Occupied' ? aed(u.annualRent) : <Pill tone="dune">Vacant</Pill>}</td>
                            <td className="num font-semibold text-[#17625f]">{pct(uy.net, 2)}</td>
                            <td>
                              {rera.maxIncreasePct > 0 ? (
                                <Pill tone="champ">+{rera.maxIncreasePct}% ({aed(rera.maxRent)})</Pill>
                              ) : (
                                <Pill tone="grey">At market (0%)</Pill>
                              )}
                            </td>
                            <td>
                              <Pill tone={signal.startsWith('Hold') ? 'oasis' : 'navy'}>{signal}</Pill>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="xl:col-span-4 grid gap-4 content-start">
              <Card
                title="Owner repair approvals"
                subtitle="Open maintenance quotes requiring landlord sign-off"
                tone="champ"
                actions={<Link to="/e/maintenance" className="swk-btn swk-btn-ghost" style={{ height: 28, padding: '0 10px', fontSize: 12 }}><Wrench size={13} />All Requests</Link>}
              >
                {owner.pendingMaintenance.length === 0 ? (
                  <div className="text-xs text-muted py-4 text-center">No open maintenance requests pending approval for {owner.name}.</div>
                ) : (
                  <div className="grid gap-2.5">
                    {owner.pendingMaintenance.map(m => (
                      <div key={m.id} className="p-3.5 rounded-xl bg-white border border-[#e7e1d4]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[13.5px] text-ink">{m.unit}</span>
                          <b className="text-ink">{aed(m.quoteAed)}</b>
                        </div>
                        <div className="text-xs text-muted mt-1">{m.issue}</div>
                        <div className="flex items-center justify-between gap-2 mt-2.5">
                          <Pill tone="grey">{m.priority} · {m.status}</Pill>
                          {m.status === 'Scheduled' || m.status === 'In Progress' ? (
                            <Pill tone="oasis">Approved</Pill>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                className="swk-btn swk-btn-primary"
                                style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                                disabled={maintDecisionMut.isPending}
                                onClick={() => maintDecisionMut.mutate({ id: m.id, decision: 'Approved' })}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="swk-btn swk-btn-ghost"
                                style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                                disabled={maintDecisionMut.isPending}
                                onClick={() => maintDecisionMut.mutate({ id: m.id, decision: 'Declined' })}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="UAE Golden Visa status" subtitle="Assessed on combined DLD deed equity" tone="navy">
                <div className="flex items-center gap-4">
                  <ProgressRing
                    value={Math.min(100, Math.round((summary.totalValue / 2_000_000) * 100))}
                    size={82}
                    color={SWK.champ}
                    label={summary.visa.golden ? '10 YR' : summary.visa.investor ? '2 YR' : 'BELOW'}
                    sub="DLD"
                  />
                  <div className="text-xs leading-relaxed">
                    <div className="font-semibold text-white text-[14px]">{summary.visa.tier}</div>
                    <div className="text-[#c8d3e6] mt-1">
                      {summary.visa.golden
                        ? `Portfolio equity of ${aed(summary.totalValue, { compact: true })} exceeds the AED 2,000,000 DLD Golden Visa threshold.`
                        : `Portfolio equity is ${aed(summary.totalValue, { compact: true })}. Add ${aed(summary.visa.gap, { compact: true })} to qualify for the 10-year Golden Visa.`}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </Reveal>
        </>
      )}
    </div>
  )
}
