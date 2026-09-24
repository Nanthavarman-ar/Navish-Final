// Shared GSAP setup for the marketing site (landing, projects, features, process,
// contact, login). Nothing in the 3D workspace imports this, so the workspace keeps
// its own scroll/animation behaviour untouched.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

export { gsap, ScrollTrigger, SplitText, Flip };

export const DESKTOP_MQ = '(min-width: 992px)';
export const MOBILE_MQ = '(max-width: 991px)';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Masked line-by-line reveal for every `[data-nv-lines]` element inside `scope`.
 * Elements start hidden via CSS so there's no flash of unsplit text. Call inside a
 * gsap.context() so the splits and triggers are reverted on unmount.
 */
export function revealLines(scope: Element) {
  const els = gsap.utils.toArray<HTMLElement>('[data-nv-lines]', scope);
  if (prefersReducedMotion()) {
    gsap.set(els, { visibility: 'visible' });
    return;
  }
  els.forEach((el) => {
    // data-nv-lines="now" plays on mount (hero copy) instead of on scroll.
    const immediate = el.dataset.nvLines === 'now';
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      linesClass: 'nv-line',
      onSplit(self) {
        gsap.set(el, { visibility: 'visible' });
        return gsap.from(self.lines, {
          yPercent: 100,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.07,
          delay: immediate ? 0.35 : 0,
          scrollTrigger: immediate ? undefined : { trigger: el, start: 'top 90%', once: true },
        });
      },
    });
  });
}

/** Clip-path reveal (bottom → top) for every `[data-nv-clip]` inside `scope`. */
export function revealClips(scope: Element) {
  const els = gsap.utils.toArray<HTMLElement>('[data-nv-clip]', scope);
  if (prefersReducedMotion()) return;
  els.forEach((el) => {
    const media = el.querySelector('img, .nv-ph');
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut' });
    if (media) tl.fromTo(media, { scale: 1.25 }, { scale: 1, duration: 1.6, ease: 'expo.out' }, 0.15);
  });
}

// ---- Page-transition curtain handoff -------------------------------------------------
// Each site page mounts its own SiteShell, so the "curtain closes → route changes →
// curtain opens" sequence spans two component instances. The outgoing shell stamps
// this, and the incoming one plays the opening half if the stamp is fresh (a stale one
// - e.g. after leaving for /workspace and coming back much later - is ignored).
let curtainStamp = 0;
export const markCurtainPending = () => {
  curtainStamp = Date.now();
};
export const consumeCurtainPending = () => {
  const fresh = Date.now() - curtainStamp < 2500;
  curtainStamp = 0;
  return fresh;
};
