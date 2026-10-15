import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import { useAuth } from '../../contexts/AuthContext';
import { gsap, ScrollTrigger, consumeCurtainPending, markCurtainPending, prefersReducedMotion, revealClips, revealLines } from './motion';
import { Monogram } from './brand';
import { SITE } from './content';
import { WorkspacePreviewDialog } from './WorkspacePreviewDialog';
import './site.css';

interface SiteCtx {
  go: (to: string) => void;
  lenis: () => Lenis | null;
  openWorkspacePreview: () => void;
}

const SiteContext = createContext<SiteCtx | null>(null);

export const useSite = () => {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside <SiteShell>');
  return ctx;
};

/** Internal link that plays the curtain transition before routing. */
export function SiteLink({
  to,
  className,
  children,
  ...rest
}: { to: string; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const { go } = useSite();
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

const NAV_LINKS: Array<[string, string]> = [
  ['/projects', 'Projects'],
  ['/features', 'Features'],
  ['/process', 'Process'],
  ['/contact', 'Contact'],
];

/**
 * Layout for every marketing page: fixed nav, curtain page transitions, Lenis smooth
 * scroll and the footer. `animate` runs page-level GSAP setup inside a gsap.context
 * scoped to the page, so every tween/ScrollTrigger/SplitText is reverted on unmount.
 */
export function SiteShell({
  children,
  footer = true,
  page,
}: {
  children: React.ReactNode;
  footer?: boolean;
  page: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainL = useRef<HTMLDivElement>(null);
  const curtainR = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const busy = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Smooth scroll, driven from GSAP's ticker so ScrollTrigger stays in lock-step.
  // Torn down on unmount so the workspace and dashboards keep native scrolling.
  useEffect(() => {
    window.scrollTo(0, 0);
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Pause smooth scrolling while the workspace preview is open.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (previewOpen) lenis.stop();
    else lenis.start();
  }, [previewOpen]);

  // Opening half of the curtain transition + shared reveals for the page.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const curtains = [curtainL.current, curtainR.current];
      if (consumeCurtainPending() && !prefersReducedMotion()) {
        // Left curtain keeps travelling up, right keeps travelling down.
        gsap.set(curtainL.current, { top: 0, bottom: 'auto', height: '100%' });
        gsap.set(curtainR.current, { top: 'auto', bottom: 0, height: '100%' });
        gsap.to(curtains, { height: '0%', duration: 0.9, ease: 'expo.inOut', stagger: 0.06, delay: 0.05 });
      } else {
        gsap.set(curtains, { height: '0%' });
      }
      if (rootRef.current) {
        revealLines(rootRef.current);
        revealClips(rootRef.current);
      }
    }, rootRef);
    // Fonts landing late shift line breaks - re-measure triggers once they're in.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  const go = useCallback(
    (to: string) => {
      setMenuOpen(false);
      if (busy.current) return;
      if (to === location.pathname) {
        lenisRef.current ? lenisRef.current.scrollTo(0) : window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (prefersReducedMotion()) {
        navigate(to);
        return;
      }
      busy.current = true;
      gsap.set(curtainL.current, { top: 'auto', bottom: 0 });
      gsap.set(curtainR.current, { top: 0, bottom: 'auto' });
      gsap.to([curtainL.current, curtainR.current], {
        height: '100%',
        duration: 0.8,
        ease: 'expo.inOut',
        stagger: 0.06,
        onComplete: () => {
          markCurtainPending();
          busy.current = false;
          navigate(to);
        },
      });
    },
    [location.pathname, navigate],
  );

  // Mobile menu: clip-path wipe down / up.
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    gsap.to(el, {
      clipPath: menuOpen ? 'inset(0% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)',
      duration: menuOpen ? 0.8 : 0.6,
      ease: 'power3.out',
    });
    const lenis = lenisRef.current;
    if (lenis) menuOpen ? lenis.stop() : lenis.start();
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // The nav used to be white with mix-blend-mode: difference everywhere, which only reads
  // over dark photos - over the light grey page it came out grey-on-grey and ran straight
  // into headings and form fields. Now it samples what's actually under the bar: over
  // media/dark sections it keeps the blended white look, over light areas it switches to
  // ink text (on a frosted bar once scrolled), and it tucks away while scrolling down.
  const [nav, setNav] = useState({ dark: true, solid: false, hidden: false });
  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    // Only full-width dark surfaces count as "dark" - a card image or a thin strip of
    // photo under part of the bar would leave the blended white text half-unreadable.
    const isDarkAt = (x: number, y: number) => {
      for (const el of document.elementsFromPoint(x, y)) {
        if (el.closest('.nv-nav, .nv-logo, .nv-grain, .nv-curtains, .nv-fcursor')) continue;
        if (el.closest('.nv-hero, .nv-footer, .nv-section--dark, .nv-section--ink, .nv-menu, [data-nv-dark]')) return true;
        const media = el.closest('.nv-media');
        if (!media) return false;
        const r = media.getBoundingClientRect();
        return r.width >= window.innerWidth * 0.95 && r.bottom >= 120;
      }
      return false;
    };
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const probeY = 30;
      const w = window.innerWidth;
      const dark = [0.1, 0.35, 0.6, 0.9].every((f) => isDarkAt(w * f, probeY));
      const down = y > lastY + 2;
      const up = y < lastY - 2;
      lastY = y;
      setNav((prev) => {
        const hidden = y > 240 && (down ? true : up ? false : prev.hidden);
        // At the very top of a light page the bar stays clear (it's the same colour as the
        // page); anywhere else it gets a frosted backing so the links never sit on content.
        const next = { dark, solid: !dark && (y > 8 || document.querySelector('.nv-split') !== null), hidden };
        return next.dark === prev.dark && next.solid === prev.solid && next.hidden === prev.hidden ? prev : next;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    // Pinned GSAP sections and late images can change what's under the bar without a scroll.
    const id = window.setInterval(onScroll, 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  const navMode = menuOpen ? 'dark' : nav.dark ? 'dark' : 'light';
  const navSolid = !menuOpen && nav.solid;
  const navHidden = !menuOpen && nav.hidden;

  const ctx: SiteCtx = {
    go,
    lenis: () => lenisRef.current,
    openWorkspacePreview: () => setPreviewOpen(true),
  };

  const year = new Date().getFullYear();

  return (
    <SiteContext.Provider value={ctx}>
      <div
        ref={rootRef}
        className="nv-site"
        data-page={page}
        data-nav={navMode}
        data-nav-solid={navSolid || undefined}
        data-nav-hidden={navHidden || undefined}
      >
        <div className="nv-grain" aria-hidden />

        {/* Logo sits outside the blended nav so the red mark keeps its real colour. */}
        <SiteLink to="/" className="nv-logo" aria-label="Navish home">
          <Monogram className="nv-logo__mark" />
        </SiteLink>

        <header className="nv-nav">
          <SiteLink to="/" className="nv-nav__word">
            Navish
          </SiteLink>
          <nav className="nv-nav__links" aria-label="Primary">
            {NAV_LINKS.map(([to, label]) => (
              <SiteLink key={to} to={to} className={`nv-nav__link ${location.pathname === to ? 'is-current' : ''}`}>
                {label}
              </SiteLink>
            ))}
          </nav>
          <div className="nv-nav__r">
            <button type="button" className="nv-nav__link" onClick={() => setPreviewOpen(true)}>
              Workspace
            </button>
            <SiteLink to="/login" className={`nv-nav__link ${location.pathname === '/login' ? 'is-current' : ''}`}>
              {user ? 'Account' : 'Login'}
            </SiteLink>
            <button
              type="button"
              className="nv-nav__link nv-nav__menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </header>

        <div ref={menuRef} className="nv-menu" style={{ clipPath: 'inset(0% 0% 100% 0%)' }} aria-hidden={!menuOpen}>
          <nav className="nv-menu__links" aria-label="Mobile">
            {[...NAV_LINKS, ['/login', user ? 'Account' : 'Login'] as [string, string]].map(([to, label], i) => (
              <SiteLink key={to} to={to} className="nv-menu__link" tabIndex={menuOpen ? 0 : -1}>
                <span className="nv-menu__num">{String(i + 1).padStart(2, '0')}</span>
                {label}
              </SiteLink>
            ))}
            <button
              type="button"
              className="nv-menu__link"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => {
                setMenuOpen(false);
                setPreviewOpen(true);
              }}
            >
              <span className="nv-menu__num">{String(NAV_LINKS.length + 2).padStart(2, '0')}</span>
              Workspace
            </button>
          </nav>
          <Monogram className="nv-menu__mark" />
        </div>

        <main className="nv-main">{children}</main>

        {footer && (
          <footer className="nv-footer">
            <div className="nv-footer__top">
              <p className="nv-footer__cta" data-nv-lines>
                Let&rsquo;s build your story.
              </p>
              <div className="nv-footer__cols">
                <div>
                  <p className="nv-eyebrow">Write to us</p>
                  <a className="nv-footer__mail" href={`mailto:${SITE.email}`}>
                    {SITE.email.split('@')[0]}
                    <wbr />@{SITE.email.split('@')[1]}
                  </a>
                </div>
                <div>
                  <p className="nv-eyebrow">Explore</p>
                  <ul className="nv-footer__list">
                    {NAV_LINKS.map(([to, label]) => (
                      <li key={to}>
                        <SiteLink to={to} className="nv-footer__link">
                          {label}
                        </SiteLink>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="nv-eyebrow">Studio</p>
                  <ul className="nv-footer__list">
                    <li>
                      <SiteLink to="/login" className="nv-footer__link">
                        Client login
                      </SiteLink>
                    </li>
                    <li>
                      <SiteLink to="/tools-features" className="nv-footer__link">
                        Documentation
                      </SiteLink>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="nv-footer__brand" aria-hidden>
              <Monogram className="nv-footer__mark" />
              <span className="nv-footer__word">Navish</span>
            </div>
            <div className="nv-footer__bottom">
              <span>&copy; {year} Navish. All rights reserved.</span>
              <span>{SITE.descriptor}</span>
            </div>
          </footer>
        )}

        <div className="nv-curtains" aria-hidden>
          <div ref={curtainL} className="nv-curtain nv-curtain--l" />
          <div ref={curtainR} className="nv-curtain nv-curtain--r" />
        </div>

        <WorkspacePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          workspaceId="header-workspace-preview"
          isAdmin={false}
          title="Workspace Preview"
        />
      </div>
    </SiteContext.Provider>
  );
}
