import React from 'react';
import { CalendarCheck, Eye, X } from 'lucide-react';
import { formatArea, statusLabel, type Home } from '../data/homesData';
import { safeContactHref } from '../data/presentConfig';

/** Only allow http(s) and same-site paths for images coming from homes.json. */
const safeSrc = (src?: string) => (src && /^(https:\/\/|http:\/\/|\/|data:image\/)/i.test(src) ? src : undefined);

interface Props {
  home: Home;
  level?: number;
  unit: 'm2' | 'ft2';
  contactLink: string;
  onClose: () => void;
  onEnter: () => void;
}

/** Side panel on desktop, bottom sheet on phones (see present.css). */
export function HomePanel({ home, level, unit, contactLink, onClose, onEnter }: Props) {
  const href = safeContactHref(contactLink, home.name);
  const photos = (home.photos || []).map(safeSrc).filter(Boolean) as string[];
  const plan = safeSrc(home.floorPlan);
  const hasRooms = !!home.rooms?.length;
  return (
    <aside className="pr-sheet pr-glass" role="dialog" aria-label={`${home.name} details`}>
      <header>
        <div>
          <h2>{home.name}</h2>
          <span className={`pr-status ${home.status}`}>{statusLabel(home.status)}</span>
          {level != null && <span style={{ marginLeft: 12, fontSize: 12, opacity: 0.7 }}>Level {level}</span>}
        </div>
        <button type="button" className="pr-btn pr-icon-btn" onClick={onClose} aria-label="Close"><X /></button>
      </header>

      <div className="pr-grid">
        <div className="pr-stat"><small>Area</small><strong>{formatArea(home.areaM2, unit)}</strong></div>
        <div className="pr-stat"><small>{unit === 'm2' ? 'In square feet' : 'In square metres'}</small><strong>{formatArea(home.areaM2, unit === 'm2' ? 'ft2' : 'm2')}</strong></div>
        {home.bedrooms ? <div className="pr-stat"><small>Bedrooms</small><strong>{home.bedrooms}</strong></div> : null}
        {home.bathrooms ? <div className="pr-stat"><small>Bathrooms</small><strong>{home.bathrooms}</strong></div> : null}
        {home.price ? <div className="pr-stat" style={{ gridColumn: '1 / -1' }}><small>Price</small><strong>{home.price}</strong></div> : null}
      </div>

      {home.description ? <p className="pr-desc">{home.description}</p> : null}

      {photos.length > 0 && (
        <>
          <h4>Photos</h4>
          <div className="pr-photos">
            {photos.map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" />)}
          </div>
        </>
      )}
      {plan && (
        <>
          <h4>Floor plan</h4>
          <img className="pr-plan" src={plan} alt={`${home.name} floor plan`} loading="lazy" decoding="async" />
        </>
      )}

      <div className="pr-cta">
        {hasRooms && <button type="button" className="pr-btn" onClick={onEnter}><Eye />Enter home</button>}
        {href && (
          <a className="pr-btn pr-primary" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <CalendarCheck />Book a call
          </a>
        )}
      </div>
    </aside>
  );
}

