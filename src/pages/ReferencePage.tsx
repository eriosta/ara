import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import Sidebar from '@/components/Sidebar'
import { MODALITIES, BODY_REGIONS, FOCUS_TO_REGION, SOURCES } from '@/lib/taxonomy'
import { ACGME_CATEGORIES, ACGME_CASELOG_SOURCE, ACGME_SUPPLEMENTARY } from '@/lib/acgmeCategories'
import { BookOpen, Menu, User, LogOut, ExternalLink } from 'lucide-react'

// Group the fine anatomic-focus labels under their coarse region for display.
const regionToFoci: Record<string, string[]> = {}
for (const [focus, region] of Object.entries(FOCUS_TO_REGION)) {
  ;(regionToFoci[region] ||= []).push(focus)
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export default function ReferencePage() {
  const { profile, signOut } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(224)

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} width={sidebarWidth} onWidthChange={setSidebarWidth} />

      <div className="flex-1 bg-slate-950 flex flex-col max-lg:!ml-0" style={{ marginLeft: `${sidebarWidth}px` }}>
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
            <Menu className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-display font-bold"><span className="text-white">Classification</span><span className="text-emerald-400"> Reference</span></h1>
          <div className="w-10" />
        </header>

        {/* Toolbar */}
        <div className="sticky top-0 z-30" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="flex items-center gap-2 px-4 lg:px-6 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <BookOpen className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Classification Reference</span>
            <div className="flex items-center gap-3 ml-auto shrink-0">
              <div className="flex items-center gap-2 px-1.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <User className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-xs font-medium hidden sm:block" style={{ color: 'var(--text-secondary)' }}>{profile?.full_name || 'Resident'}</span>
              </div>
              <button onClick={() => signOut()} className="p-1.5 rounded-lg hover:bg-white/5" title="Sign out">
                <LogOut className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-4xl">
          <div className="mb-6 rounded-xl bg-blue-500/5 border border-blue-500/20 px-4 py-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              myRVU categorizes each study by <span className="text-slate-300 font-medium">modality</span> and{' '}
              <span className="text-slate-300 font-medium">body region</span>, then rolls studies up into{' '}
              <span className="text-slate-300 font-medium">ACGME case-log categories</span>. The vocabulary below is aligned to
              recognized radiology standards — the DICOM modality codes, the RSNA/LOINC RadLex Playbook anatomy model, and the
              official ACGME case-log requirements — rather than ad-hoc labels. Sources are listed at the bottom.
            </p>
          </div>

          {/* Modalities */}
          <SectionCard title="Modalities" subtitle="DICOM Modality codes (PS3.3 §C.7.3.1.1.1) with RadLex/LOINC Playbook subtypes.">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-4 font-medium">myRVU label</th>
                    <th className="py-2 pr-4 font-medium">DICOM</th>
                    <th className="py-2 pr-4 font-medium">RadLex</th>
                    <th className="py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {MODALITIES.map(m => (
                    <tr key={m.name} className="border-b border-slate-800/50">
                      <td className="py-2 pr-4 text-white whitespace-nowrap">{m.name}</td>
                      <td className="py-2 pr-4 font-mono text-emerald-400 whitespace-nowrap">{m.dicom.join(', ') || '—'}</td>
                      <td className="py-2 pr-4 font-mono text-slate-400 whitespace-nowrap">{m.radlex || '—'}</td>
                      <td className="py-2 text-slate-400">{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Body regions */}
          <SectionCard
            title="Body regions"
            subtitle="Two-tier RadLex Playbook model: a coarse Region Imaged, refined by a fine anatomic focus."
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {BODY_REGIONS.map(region => (
                <div key={region} className="rounded-lg bg-slate-950/40 border border-slate-800 p-3">
                  <div className="text-xs font-semibold text-emerald-400 mb-1">{region}</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    {(regionToFoci[region] || []).join(' · ') || '—'}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ACGME categories */}
          <SectionCard
            title="ACGME case-log categories"
            subtitle={`${ACGME_CASELOG_SOURCE.label} (rev. ${ACGME_CASELOG_SOURCE.revision}).`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-4 font-medium">Category</th>
                    <th className="py-2 pr-4 font-medium text-right">Minimum</th>
                    <th className="py-2 font-medium">What counts</th>
                  </tr>
                </thead>
                <tbody>
                  {ACGME_CATEGORIES.map(c => (
                    <tr key={c.id} className="border-b border-slate-800/50">
                      <td className="py-2 pr-4 text-white whitespace-nowrap">{c.name}</td>
                      <td className="py-2 pr-4 font-mono text-emerald-400 text-right">{c.defaultMinimum.toLocaleString()}</td>
                      <td className="py-2 text-slate-400">{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 mb-2">Supplementary ACGME / MQSA guidelines</p>
              <ul className="space-y-1.5">
                {ACGME_SUPPLEMENTARY.map(s => (
                  <li key={s.label} className="text-[11px] text-slate-400">
                    <span className="text-slate-300 font-medium">{s.label}:</span> {s.detail}{' '}
                    <span className="text-slate-600">({s.source})</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-[11px] text-amber-400/80">
              Minimums are revised periodically — verify against the current ACGME PDF before relying on them for compliance.
            </p>
          </SectionCard>

          {/* Sources */}
          <SectionCard title="Sources">
            <ul className="space-y-2">
              {SOURCES.map(s => (
                <li key={s.id} className="flex items-start gap-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 whitespace-nowrap mt-0.5">{s.kind}</span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                    {s.label}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </SectionCard>
        </main>
      </div>
    </div>
  )
}
