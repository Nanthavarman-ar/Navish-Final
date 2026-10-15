import React from 'react';
import { SiteShell, SiteLink } from './SiteShell';

export function NotFoundPage() {
  return (
    <SiteShell page="not-found">
      <section className="nv-section nv-notfound">
        <p className="nv-eyebrow" style={{ marginBottom: '1rem' }}>
          Error 404
        </p>
        <h1 className="nv-caps nv-caps--xl" data-nv-lines="now">
          Page not found
        </h1>
        <p className="nv-p" style={{ marginTop: '2rem' }}>
          The page you&rsquo;re looking for has moved or no longer exists. Try one of these instead.
        </p>
        <div className="nv-scale__cta" style={{ marginTop: '2.5rem' }}>
          <SiteLink to="/" className="nv-btn nv-btn--red nv-arrow">
            Back to home{' '}
          </SiteLink>
          <SiteLink to="/projects" className="nv-btn">
            Projects
          </SiteLink>
          <SiteLink to="/contact" className="nv-btn nv-btn--ghost">
            Contact us
          </SiteLink>
        </div>
      </section>
    </SiteShell>
  );
}
