import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SiteShell, SiteLink, useSite } from './site/SiteShell';
import { LabelCard, SiteImage } from './site/brand';
import { ProjectCard } from './site/ProjectCard';
import { WorkspacePreviewDialog } from './site/WorkspacePreviewDialog';
import { SITE, heroSlides, projects, studioImage } from './site/content';
import { DESKTOP_MQ, MOBILE_MQ, ScrollTrigger, gsap, prefersReducedMotion } from './site/motion';

export function Home() {
  return (
    <SiteShell page="home">
      <HomeContent />
    </SiteShell>
  );
}

function HomeContent() {
  const { user, logout } = useAuth();
  const { go, lenis } = useSite();
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

  useEffect(() => {
    const l = lenis();
    if (!l) return;
    if (workspaceModalOpen) l.stop();
    else l.start();
  }, [workspaceModalOpen, lenis]);

  return (
    <>
      <HeroSlider />
      <Statement />
      <SelectedProjects />
      <ScaleSection />

      {user && (
        <section className="nv-section nv-section--dark" aria-labelledby="nv-studio-title">
          <div className="nv-row">
            <div>
              <p className="nv-eyebrow" style={{ color: 'var(--nv-red)', marginBottom: '1rem' }}>
                Signed in{user.name ? ` as ${user.name}` : ''}
              </p>
              <h2 id="nv-studio-title" className="nv-caps" data-nv-lines>
                {user.role === 'admin' ? 'Admin studio' : 'Your studio'}
              </h2>
            </div>
            <button type="button" className="nv-btn nv-btn--ghost" onClick={logout}>
              Logout
            </button>
          </div>
          <ul className="nv-rows">
            {user.role === 'admin' && (
              <>
                <StudioRow n="01" title="User management" desc="Manage user accounts and permissions" onClick={() => go('/admin/clients')} />
                <StudioRow n="02" title="Models library" desc="Manage 3D model library and assignments" onClick={() => go('/admin/models')} />
                <StudioRow n="03" title="System settings" desc="Configure system settings and preferences" onClick={() => go('/admin/settings')} />
              </>
            )}
            <StudioRow
              n={user.role === 'admin' ? '04' : '01'}
              title="Quick 3D workspace preview"
              desc="Experience the 3D workspace with drag, resize and scroll"
              onClick={() => setWorkspaceModalOpen(true)}
            />
          </ul>
          <WorkspacePreviewDialog
            open={workspaceModalOpen}
            onOpenChange={setWorkspaceModalOpen}
            workspaceId="naviz-studio-main"
            isAdmin={user.role === 'admin'}
            title="3D Preview"
          />
        </section>
      )}
    </>
  );
}

function StudioRow({ n, title, desc, onClick }: { n: string; title: string; desc: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="nv-rowlink" onClick={onClick}>
        <span className="nv-eyebrow">{n}</span>
        <span className="nv-rowlink__title">{title}</span>
        <span className="nv-rowlink__desc">{desc}</span>
        <span className="nv-rowlink__go nv-arrow" aria-hidden />
      </button>
    </li>
  );
}

/**
 * Split-screen slider: two stacked image columns revealed with opposing clip-paths
 * (left from the bottom, right from the top) and a centre label card kept in sync.
 * Desktop: pinned and scrubbed by scroll. Mobile: autoplays.
 */
function HeroSlider() {
  const ref = useRef<HTMLElement>(null);
  const stRef = useRef<ScrollTrigger | null>(null);
  const [active, setActive] = useState(0);
  const { lenis } = useSite();
  const n = heroSlides.length;

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      const L = gsap.utils.toArray<HTMLElement>('.nv-hero__half--l .nv-hero__slide', root);
      const R = gsap.utils.toArray<HTMLElement>('.nv-hero__half--r .nv-hero__slide', root);
      const labels = gsap.utils.toArray<HTMLElement>('.nv-hero__labels > .nv-label', root);
      [L, R, labels].forEach((set) => set.forEach((el, i) => gsap.set(el, { zIndex: i + 1 })));

      const SHOWN = 'inset(0% 0% 0% 0%)';
      const FROM_BOTTOM = 'inset(100% 0% 0% 0%)';
      const FROM_TOP = 'inset(0% 0% 100% 0%)';
      gsap.set(L.slice(1), { clipPath: FROM_BOTTOM });
      gsap.set(R.slice(1), { clipPath: FROM_TOP });
      gsap.set(labels.slice(1), { clipPath: FROM_BOTTOM });
      if (prefersReducedMotion()) return;

      gsap
        .timeline({ delay: 0.15 })
        .fromTo(L[0], { clipPath: FROM_BOTTOM }, { clipPath: SHOWN, duration: 1.4, ease: 'expo.inOut' })
        .fromTo(R[0], { clipPath: FROM_TOP }, { clipPath: SHOWN, duration: 1.4, ease: 'expo.inOut' }, 0)
        .fromTo(labels[0], { clipPath: 'inset(0% 50% 0% 50%)' }, { clipPath: SHOWN, duration: 1.1, ease: 'expo.inOut' }, 0.9)
        .from('.nv-hero__foot', { autoAlpha: 0, y: 16, duration: 0.8, ease: 'power3.out' }, 1.3);

      mm.add(DESKTOP_MQ, () => {
        const tl = gsap.timeline();
        for (let i = 1; i < n; i++) {
          tl.to(L[i], { clipPath: SHOWN, ease: 'none', duration: 1 }, i - 1)
            .to(R[i], { clipPath: SHOWN, ease: 'none', duration: 1 }, i - 1)
            .to(labels[i], { clipPath: SHOWN, ease: 'none', duration: 1 }, i - 1);
        }
        stRef.current = ScrollTrigger.create({
          trigger: root,
          start: 'top top',
          end: () => `+=${(n - 1) * window.innerHeight}`,
          pin: true,
          scrub: true,
          animation: tl,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const idx = Math.min(n - 1, Math.floor(self.progress * (n - 1) + 0.5));
            setActive((prev) => (prev === idx ? prev : idx));
          },
        });
        return () => {
          stRef.current = null;
        };
      });

      mm.add(MOBILE_MQ, () => {
        let cur = 0;
        let z = n + 1;
        const id = window.setInterval(() => {
          const nx = (cur + 1) % n;
          z += 1;
          gsap.set([L[nx], R[nx], labels[nx]], { zIndex: z });
          gsap.fromTo(L[nx], { clipPath: FROM_BOTTOM }, { clipPath: SHOWN, duration: 1.3, ease: 'expo.inOut' });
          gsap.fromTo(R[nx], { clipPath: FROM_TOP }, { clipPath: SHOWN, duration: 1.3, ease: 'expo.inOut' });
          gsap.fromTo(labels[nx], { clipPath: FROM_BOTTOM }, { clipPath: SHOWN, duration: 1.3, ease: 'expo.inOut' });
          cur = nx;
          setActive(nx);
        }, 4500);
        return () => window.clearInterval(id);
      });
    }, root);
    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [n]);

  const jumpTo = (i: number) => {
    const st = stRef.current;
    if (!st) return;
    const y = st.start + i * window.innerHeight;
    const l = lenis();
    if (l) l.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <section ref={ref} className="nv-hero" aria-label="Featured projects">
      <div className="nv-hero__half nv-hero__half--l">
        {heroSlides.map((p, i) => (
          <div key={p.slug} className="nv-hero__slide nv-media">
            <SiteImage src={p.image} alt={`${p.title} - ${p.type}`} eager={i === 0} />
          </div>
        ))}
      </div>
      <div className="nv-hero__half nv-hero__half--r">
        {heroSlides.map((p, i) => (
          <div key={p.slug} className="nv-hero__slide nv-media">
            <SiteImage src={p.detail} alt={`${p.title} - detail`} eager={i === 0} />
          </div>
        ))}
      </div>
      <div className="nv-hero__labels">
        {heroSlides.map((p) => (
          <LabelCard key={p.slug} title={p.title} sub={p.type} />
        ))}
      </div>
      <div className="nv-hero__foot">
        <ul className="nv-hero__index">
          {heroSlides.map((p, i) => (
            <li key={p.slug}>
              <button
                type="button"
                className={`nv-hero__dot nv-eyebrow ${i === active ? 'is-active' : ''}`}
                aria-current={i === active}
                onClick={() => jumpTo(i)}
              >
                {p.title}
              </button>
            </li>
          ))}
        </ul>
        <p className="nv-eyebrow nv-hero__tagline">{SITE.tagline}</p>
      </div>
    </section>
  );
}

function Statement() {
  return (
    <section className="nv-section">
      <div className="nv-statement">
        <h1 className="nv-caps nv-statement__title" data-nv-lines>
          Architecture that listens. Buildings that last.
        </h1>
        <div className="nv-statement__body">
          <p className="nv-p nv-p--justify" data-nv-lines>
            Navish is an architecture and construction studio. We design and build homes, workplaces and interiors as
            one continuous process - from the first conversation to the day the keys change hands - and let you walk
            through every room in 3D and VR before a single wall goes up.
          </p>
          <SiteLink to="/process" className="nv-btn nv-arrow">
            Our process
          </SiteLink>
        </div>
      </div>
    </section>
  );
}

function SelectedProjects() {
  return (
    <section className="nv-section" style={{ paddingTop: 0 }}>
      <div className="nv-row">
        <div>
          <p className="nv-eyebrow" style={{ marginBottom: '1rem' }}>
            Selected work
          </p>
          <h2 className="nv-caps" data-nv-lines>
            Recent projects
          </h2>
        </div>
        <SiteLink to="/projects" className="nv-eyebrow nv-ulink nv-arrow">
          All projects{' '}
        </SiteLink>
      </div>
      <div className="nv-grid-4">
        {projects.slice(4, 8).map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>
    </section>
  );
}

/** Framed image that grows to full-bleed as you scroll (pinned on desktop). */
function ScaleSection() {
  const ref = useRef<HTMLElement>(null);
  const { openWorkspacePreview } = useSite();

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const mm = gsap.matchMedia();
    mm.add(DESKTOP_MQ, () => {
      const img = root.querySelector<HTMLElement>('.nv-scale__img');
      const frameW = () => Math.min(480, window.innerWidth * 0.7);
      const tl = gsap
        .timeline()
        .fromTo(
          img,
          { width: frameW, height: () => frameW() * 0.75, clipPath: 'inset(6% 6% 6% 6%)' },
          { width: () => window.innerWidth, height: () => window.innerHeight, clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 1 },
        )
        .to(root.querySelectorAll('.nv-scale__head, .nv-scale__foot .nv-p'), { color: '#eceaea', duration: 0.15 }, 0.8);
      ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: () => `+=${window.innerHeight}`,
        pin: true,
        scrub: 1,
        animation: tl,
        invalidateOnRefresh: true,
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={ref} className="nv-scale" aria-labelledby="nv-scale-title">
      <div className="nv-scale__head">
        <p className="nv-eyebrow">Navish workspace</p>
        <h2 id="nv-scale-title" className="nv-caps" style={{ textAlign: 'right' }}>
          Walk through it
          <br />
          before it&rsquo;s built
        </h2>
      </div>
      <div className="nv-media nv-scale__img">
        <SiteImage src={studioImage} alt="Navish 3D workspace" />
      </div>
      <div className="nv-scale__foot">
        <p className="nv-p">
          Every project is modelled in our real-time 3D workspace - review materials, light and space on screen or in
          VR, and approve it before construction begins.
        </p>
        <div className="nv-scale__cta">
          <button type="button" className="nv-btn nv-btn--red" onClick={openWorkspacePreview}>
            Open the workspace
          </button>
          <SiteLink to="/features" className="nv-btn nv-arrow">
            Features{' '}
          </SiteLink>
        </div>
      </div>
    </section>
  );
}
