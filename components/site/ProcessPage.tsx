import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SiteShell, SiteLink } from './SiteShell';
import { LabelCard, Monogram, SiteImage } from './brand';
import { pathways, processHeroImage, processSteps } from './content';
import { DESKTOP_MQ, MOBILE_MQ, ScrollTrigger, SplitText, gsap, prefersReducedMotion } from './motion';

export function ProcessPage() {
  return (
    <SiteShell page="process">
      <ProcessHero />
      <section className="nv-section">
        <div className="nv-intro">
          <h2 className="nv-caps" data-nv-lines>
            From first sketch to the keys in your hand
          </h2>
          <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'start' }}>
            <p className="nv-p nv-p--justify" data-nv-lines>
              One studio carries your project the whole way. Architects, engineers and builders sit at the same table,
              so decisions made in the drawings are the decisions made on site. Seven steps, each one reviewed with you -
              in drawings, in 3D and in VR - before we move to the next.
            </p>
            <p className="nv-eyebrow">{processSteps.length} steps</p>
          </div>
        </div>
      </section>
      <ProcessSteps />
      <Pathways />
      <section className="nv-section">
        <div className="nv-closing">
          <h2 className="nv-caps" data-nv-lines>
            Start your project
          </h2>
          <LabelCard title="Let's talk" sub="Tell us about your site, your brief and your timeline." />
          <SiteLink to="/contact" className="nv-btn nv-btn--red nv-arrow">
            Contact the studio{' '}
          </SiteLink>
        </div>
      </section>
    </SiteShell>
  );
}

/** Framed image opens to full-bleed, then the title and label card are revealed. */
function ProcessHero() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      const img = root.querySelector('.nv-pc-hero__img');
      const title = root.querySelector<HTMLElement>('.nv-pc-hero__title');
      const label = root.querySelector('.nv-pc-hero__label');
      if (prefersReducedMotion() || !title) return;

      const split = SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'nv-line' });
      const build = () =>
        gsap
          .timeline()
          .fromTo(img, { clipPath: 'inset(26% 32% 26% 32%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 1 })
          .from(split.lines, { yPercent: 100, duration: 0.3, stagger: 0.05, ease: 'power2.out' }, 0.72)
          .fromTo(label, { clipPath: 'inset(0% 50% 0% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.3, ease: 'power2.inOut' }, 0.82);

      mm.add(DESKTOP_MQ, () => {
        ScrollTrigger.create({
          trigger: root,
          start: 'top top',
          end: () => `+=${window.innerHeight * 1.5}`,
          pin: true,
          scrub: 1,
          animation: build(),
          invalidateOnRefresh: true,
        });
      });
      mm.add(MOBILE_MQ, () => {
        // Same choreography, played once on load instead of scrubbed.
        const tl = build().pause();
        gsap.to(tl, { progress: 1, duration: 2.2, ease: 'expo.inOut', delay: 0.3 });
      });
    }, root);
    return () => {
      mm.revert();
      ctx.revert();
    };
  }, []);

  return (
    <section ref={ref} className="nv-pc-hero" aria-labelledby="nv-process-title">
      <div className="nv-media nv-pc-hero__img">
        <SiteImage src={processHeroImage} alt="Navish process" eager />
      </div>
      <div className="nv-pc-hero__kicker">
        <p className="nv-eyebrow">Process</p>
        <p className="nv-eyebrow">{processSteps.length} steps - from brief to handover</p>
      </div>
      <h1 id="nv-process-title" className="nv-caps nv-caps--xl nv-pc-hero__title">
        Our
        <br />
        process
      </h1>
      <LabelCard className="nv-pc-hero__label" title="How we work" sub="Architect & Builders - one team, start to finish" />
    </section>
  );
}

/**
 * Steps stack on top of each other; while the block is pinned, each next step wipes
 * up over the previous one with a scrubbed clip-path (desktop). Mobile shows them in
 * normal flow.
 */
function ProcessSteps() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const mm = gsap.matchMedia();
    mm.add(DESKTOP_MQ, () => {
      const steps = gsap.utils.toArray<HTMLElement>('.nv-step', root);
      const n = steps.length;
      if (n < 2) return;
      gsap.set(root, { height: '100vh', overflow: 'hidden' });
      steps.forEach((s, i) =>
        gsap.set(s, {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          zIndex: i + 1,
          clipPath: i === 0 ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)',
        }),
      );
      const tl = gsap.timeline();
      for (let i = 1; i < n; i++) {
        tl.to(steps[i], { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 1 }, i - 1);
        // The outgoing step's card drifts up slightly as it's covered.
        tl.to(steps[i - 1].querySelector('.nv-step__card'), { yPercent: -18, ease: 'none', duration: 1 }, i - 1);
      }
      ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: () => `+=${(n - 1) * window.innerHeight}`,
        pin: true,
        scrub: true,
        animation: tl,
        invalidateOnRefresh: true,
      });
    });
    return () => mm.revert();
  }, []);

  const total = String(processSteps.length).padStart(2, '0');
  return (
    <div ref={ref} className="nv-steps">
      {processSteps.map((s, i) => {
        const num = String(i + 1).padStart(2, '0');
        return (
          <article key={s.title} className="nv-step" aria-labelledby={`nv-step-${num}`}>
            <div className="nv-media nv-step__img">
              <SiteImage src={s.image} alt={s.title} />
            </div>
            <div className="nv-step__info">
              <div className="nv-step__top">
                <span className="nv-eyebrow">
                  {num} / {total}
                </span>
                <span className="nv-eyebrow">Process</span>
              </div>
              <div className="nv-step__card">
                <Monogram variant="emboss" />
                <span className="nv-eyebrow">Step {num}</span>
              </div>
              <div className="nv-step__text">
                <h3 id={`nv-step-${num}`} className="nv-caps" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.75rem)' }}>
                  {s.title}
                </h3>
                <p className="nv-p">{s.body}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Service pathways - each opens a panel that slides in from the right. */
function Pathways() {
  const ref = useRef<HTMLElement>(null);
  const panels = useRef<Record<string, HTMLDivElement | null>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const prevOpen = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevOpen.current;
    const reduced = prefersReducedMotion();
    if (prev && prev !== openId && panels.current[prev]) {
      gsap.to(panels.current[prev], { x: '100%', duration: reduced ? 0 : 0.6, ease: 'power3.inOut' });
    }
    if (openId && panels.current[openId]) {
      gsap.fromTo(panels.current[openId], { x: '100%' }, { x: '0%', duration: reduced ? 0 : 0.8, ease: 'power3.out' });
    }
    prevOpen.current = openId;
  }, [openId]);

  // Close the open panel once the section is mostly scrolled away.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < 0.35) setOpenId(null);
      },
      { threshold: [0, 0.35, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="nv-paths" aria-labelledby="nv-paths-title">
      <div>
        <p className="nv-eyebrow" style={{ marginBottom: '1rem' }}>
          Ways to work with us
        </p>
        <h2 id="nv-paths-title" className="nv-caps" data-nv-lines>
          Three pathways
        </h2>
      </div>
      <ul className="nv-paths__list">
        {pathways.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="nv-paths__btn"
              aria-expanded={openId === p.id}
              aria-controls={`nv-path-${p.id}`}
              onClick={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
            >
              <span className="nv-h3">{p.title}</span>
              <span className="nv-plus" aria-hidden>
                +
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pathways.map((p) => (
        <div
          key={p.id}
          id={`nv-path-${p.id}`}
          ref={(el) => {
            panels.current[p.id] = el;
          }}
          className="nv-paths__panel"
          role="region"
          aria-label={p.title}
          aria-hidden={openId !== p.id}
        >
          <button type="button" className="nv-paths__close nv-eyebrow" onClick={() => setOpenId(null)} tabIndex={openId === p.id ? 0 : -1}>
            Close ✕
          </button>
          <div>
            <h3 className="nv-caps" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.75rem)' }}>
              {p.title}
            </h3>
            <p className="nv-p" style={{ marginTop: '1.25rem' }}>
              {p.intro}
            </p>
            <ul className="nv-paths__items">
              {p.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
          <SiteLink to="/contact" className="nv-btn nv-arrow" style={{ alignSelf: 'flex-start' }} tabIndex={openId === p.id ? 0 : -1}>
            Let&rsquo;s talk{' '}
          </SiteLink>
        </div>
      ))}
    </section>
  );
}
