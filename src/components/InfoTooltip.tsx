import { Info } from 'lucide-react'

interface InfoTooltipProps {
  text: string
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <div className="relative group/tip inline-flex">
      <button
        type="button"
        className="p-0.5 rounded-full transition-colors hover:bg-white/10"
        style={{ color: 'var(--text-muted)' }}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs leading-relaxed w-56 opacity-0 scale-95 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:scale-100 transition-all z-50"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          color: 'var(--text-secondary)',
        }}
      >
        {text}
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 -mt-1"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRight: '1px solid var(--border-color)',
            borderBottom: '1px solid var(--border-color)',
          }}
        />
      </div>
    </div>
  )
}
