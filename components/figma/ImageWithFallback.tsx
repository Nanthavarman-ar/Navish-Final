import React, { useState } from 'react'

// Shown when there's no thumbnail or it fails to load. Previously a light-grey box
// (jarring on the dark dashboards), and an empty src never fired onError at all, so
// callers patched over it with an unrelated stock furniture photo.
function Placeholder({ className, style, label }: { className?: string; style?: React.CSSProperties; label?: string }) {
  return (
    <div
      role="img"
      aria-label={label || 'No preview available'}
      className={`flex items-center justify-center bg-linear-to-br from-slate-700 to-slate-800 text-slate-500 ${className ?? ''}`}
      style={style}
    >
      <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ maxWidth: 56, maxHeight: 56 }}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
      </svg>
    </div>
  )
}

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)
  const { src, alt, style, className, ...rest } = props

  if (didError || !src) return <Placeholder className={className} style={style} label={alt} />

  return <img src={src} alt={alt} className={className} style={style} loading="lazy" {...rest} onError={() => setDidError(true)} />
}
