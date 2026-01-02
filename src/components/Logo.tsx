interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export default function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-base', sub: 'text-[10px]' },
    md: { icon: 'w-10 h-10', text: 'text-lg', sub: 'text-xs' },
    lg: { icon: 'w-14 h-14', text: 'text-2xl', sub: 'text-sm' },
  }

  const s = sizes[size]

  return (
    <div className="flex items-center gap-3">
      {/* Icon */}
      <div className={`${s.icon} rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center relative overflow-hidden shadow-lg shadow-emerald-500/20`}>
        {/* Stylized "R" with pulse effect */}
        <span className="text-white font-bold font-display tracking-tight" style={{ fontSize: size === 'lg' ? '1.75rem' : size === 'md' ? '1.25rem' : '1rem' }}>
          R
        </span>
        {/* Subtle shine effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0" />
      </div>
      
      {showText && (
        <div>
          <h1 className={`${s.text} font-display font-bold tracking-tight`}>
            <span className="text-white">my</span>
            <span className="text-emerald-400">RVU</span>
          </h1>
          <p className={`${s.sub} text-slate-500 -mt-0.5`}>Radiology Analytics</p>
        </div>
      )}
    </div>
  )
}

