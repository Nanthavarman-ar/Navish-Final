import React, { useLayoutEffect, useRef, useState } from 'react';
import { SiteShell } from './SiteShell';
import { ProjectCard } from './ProjectCard';
import { projects } from './content';
import { Flip, gsap, prefersReducedMotion } from './motion';

type Layout = 'compact' | 'expanded';

export function ProjectsPage() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [layout, setLayoutState] = useState<Layout>('compact');

  // The grid's data-layout attribute is driven directly (not through React) so GSAP
  // Flip can capture positions immediately before and after the switch.
  const setLayout = (next: Layout, opts: { duration?: number; stagger?: number } = {}) => {
    const grid = gridRef.current;
    if (!grid || grid.dataset.layout === next) return;
    const items = grid.querySelectorAll('.nv-card');
    const state = Flip.getState(items);
    grid.dataset.layout = next;
    setLayoutState(next);
    if (prefersReducedMotion()) return;
    Flip.from(state, {
      duration: opts.duration ?? 1.2,
      ease: 'expo.inOut',
      stagger: opts.stagger ?? 0.03,
      nested: true,
    });
  };

  // Arrive as a compact contact sheet, then resolve into the editorial layout.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) {
        grid.dataset.layout = 'expanded';
        setLayoutState('expanded');
        return;
      }
      gsap.from('.nv-card', { autoAlpha: 0, yPercent: 20, duration: 0.9, ease: 'expo.out', stagger: 0.04, delay: 0.4 });
      gsap.delayedCall(1.5, () => setLayout('expanded', { duration: 2, stagger: 0.05 }));
    }, grid);
    return () => ctx.revert();
  }, []);

  return (
    <SiteShell page="projects">
      <header className="nv-page-head">
        <h1 className="nv-caps nv-caps--xl" data-nv-lines="now">
          Projects
        </h1>
        <div className="nv-page-head__aside">
          <p className="nv-eyebrow">{String(projects.length).padStart(2, '0')} projects</p>
          <div className="nv-toggle nv-eyebrow" role="group" aria-label="Grid layout">
            <button type="button" className={layout === 'compact' ? 'is-active' : ''} aria-pressed={layout === 'compact'} onClick={() => setLayout('compact')}>
              Overview
            </button>
            <button type="button" className={layout === 'expanded' ? 'is-active' : ''} aria-pressed={layout === 'expanded'} onClick={() => setLayout('expanded')}>
              Gallery
            </button>
          </div>
        </div>
      </header>
      <div ref={gridRef} className="nv-pgrid" data-layout="compact">
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} clip={false} />
        ))}
      </div>
    </SiteShell>
  );
}
