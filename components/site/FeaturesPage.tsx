import React, { useLayoutEffect, useRef, useState } from 'react';
import { SiteShell, SiteLink } from './SiteShell';
import { LabelCard } from './brand';
import { toolPageDefinitions } from '../toolPageDefinitions';
import { DESKTOP_MQ, gsap, prefersReducedMotion } from './motion';

const tools = Object.entries(toolPageDefinitions);

export function FeaturesPage() {
  const listRef = useRef<HTMLUListElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // A small label card trails the pointer while hovering the list (desktop only).
  useLayoutEffect(() => {
    const list = listRef.current;
    const cursor = cursorRef.current;
    if (!list || !cursor || prefersReducedMotion()) return;
    const mm = gsap.matchMedia();
    mm.add(DESKTOP_MQ, () => {
      const xTo = gsap.quickTo(cursor, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(cursor, 'y', { duration: 0.6, ease: 'power3' });
      const move = (e: PointerEvent) => {
        xTo(e.clientX + 24);
        yTo(e.clientY);
      };
      const enter = () => gsap.to(cursor, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power3.out' });
      const leave = () => gsap.to(cursor, { autoAlpha: 0, scale: 0.9, duration: 0.3, ease: 'power3.in' });
      gsap.set(cursor, { xPercent: 0, yPercent: -50, scale: 0.9 });
      list.addEventListener('pointermove', move);
      list.addEventListener('pointerenter', enter);
      list.addEventListener('pointerleave', leave);
      return () => {
        list.removeEventListener('pointermove', move);
        list.removeEventListener('pointerenter', enter);
        list.removeEventListener('pointerleave', leave);
      };
    });
    return () => mm.revert();
  }, []);

  const current = hovered ? toolPageDefinitions[hovered] : null;

  return (
    <SiteShell page="features">
      <header className="nv-page-head">
        <h1 className="nv-caps nv-caps--xl" data-nv-lines="now">
          Features
        </h1>
        <div className="nv-page-head__aside">
          <p className="nv-p" data-nv-lines="now" style={{ maxWidth: '24rem' }}>
            The tools inside the Navish workspace - simulation, analysis, collaboration and immersive review, all
            working on the same live 3D model.
          </p>
          <SiteLink to="/tools-features" className="nv-eyebrow nv-ulink nv-arrow">
            Full catalogue{' '}
          </SiteLink>
        </div>
      </header>

      <ul ref={listRef} className="nv-flist">
        {tools.map(([id, t], i) => (
          <li key={id} onPointerEnter={() => setHovered(id)}>
            <SiteLink to={`/tool/${id}`} className="nv-rowlink">
              <span className="nv-eyebrow">{String(i + 1).padStart(2, '0')}</span>
              <span className="nv-rowlink__title">{t.title}</span>
              <span className="nv-rowlink__desc">{t.description}</span>
              <span className="nv-eyebrow nv-rowlink__status">{t.status ?? ''}</span>
              <span className="nv-rowlink__go nv-arrow" aria-hidden />
            </SiteLink>
          </li>
        ))}
      </ul>

      <div ref={cursorRef} className="nv-fcursor" aria-hidden style={{ opacity: 0 }}>
        <LabelCard title={current?.title ?? ''} sub={current?.status ?? 'Navish workspace'} />
      </div>
    </SiteShell>
  );
}
