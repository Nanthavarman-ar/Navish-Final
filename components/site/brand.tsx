import React, { useState } from 'react';

// The "na" letterforms from the Navish logo, drawn on a 108×93 grid (the red square
// occupies 0-100 × 0-92; the alpha deliberately overhangs the square's right edge, as
// in the original mark). Kept in sync with public/brand/navish-mark.svg.
const NaGlyph = () => (
  <>
    <path d="M37 27V65.5" />
    <path d="M37 40C37 31.5 42.5 26.5 49 26.5C56 26.5 60.5 31.5 60.5 38.5V78.5H71" />
    <ellipse cx="85.5" cy="44" rx="12.25" ry="17.25" />
    <path d="M97.75 27V55.5Q97.75 61.5 104.5 61.5" />
  </>
);

interface MonogramProps {
  /** solid = full logo mark (red square); emboss = letters pressed into a label card */
  variant?: 'solid' | 'emboss';
  className?: string;
  title?: string;
}

export function Monogram({ variant = 'solid', className, title }: MonogramProps) {
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
  if (variant === 'emboss') {
    return (
      <svg viewBox="20 16 90 70" fill="none" className={`nv-mono nv-mono--emboss ${className ?? ''}`} {...a11y}>
        <g stroke="currentColor" strokeWidth="7" strokeLinecap="butt">
          <NaGlyph />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 108 93" fill="none" className={`nv-mono ${className ?? ''}`} {...a11y}>
      <rect width="100" height="92" rx="16" fill="var(--nv-red)" />
      <g stroke="#1A1A1A" strokeOpacity=".45" strokeWidth="5.9">
        <NaGlyph />
      </g>
      <g stroke="#FFFFFF" strokeWidth="5">
        <NaGlyph />
      </g>
    </svg>
  );
}

/** Red label card with an embossed monogram - the site's recurring "etiquette". */
export function LabelCard({
  title,
  sub,
  className,
  children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`nv-label ${className ?? ''}`}>
      <div className="nv-label__text">
        <p className="nv-label__title">{title}</p>
        {sub && <p className="nv-label__sub">{sub}</p>}
        {children}
      </div>
      <Monogram variant="emboss" className="nv-label__mark" />
    </div>
  );
}

/**
 * Image with a toned placeholder fallback, so layouts hold their shape until the real
 * photography is dropped into /public/site.
 */
export function SiteImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <div className={`nv-ph ${className ?? ''}`} role="img" aria-label={alt}>
        <span className="nv-ph__cap">{alt}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
