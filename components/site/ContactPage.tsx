import React, { useEffect, useRef, useState } from 'react';
import { SiteShell, SiteLink } from './SiteShell';
import { LabelCard, SiteImage } from './brand';
import { SITE, contactImage, pathways } from './content';
import { projectId } from '../../supabase/client';

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState(pathways[0].title);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot - hidden from people
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  // Only used when the server can't be reached: hand the message to the visitor's
  // mail app instead, with a copy fallback for people who don't have one.
  const [sent, setSent] = useState<null | { body: string }>(null);
  const [copied, setCopied] = useState(false);
  const thanksRef = useRef<HTMLDivElement>(null);

  // The form collapses into a short message, so bring that message into view (and
  // focus it for screen readers) instead of leaving the page scrolled past it.
  useEffect(() => {
    if (status !== 'done' || !thanksRef.current) return;
    thanksRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    thanksRef.current.focus({ preventScroll: true });
  }, [status]);

  const mailtoFallback = () => {
    const subject = `Project enquiry - ${type}`;
    const lines = [message, '', `Name: ${name}`, `Email: ${email}`];
    if (phone) lines.push(`Phone: ${phone}`);
    lines.push(`Project: ${type}`);
    const body = lines.join('\n');
    setSent({ body: `${subject}\n\n${body}` });
    setCopied(false);
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch(`${functionsBaseUrl}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, projectType: type, message, website }),
      });
      if (res.ok) {
        setStatus('done');
        return;
      }
      const data = await res.json().catch(() => ({}));
      // A validation or rate-limit message from the server is worth showing as-is.
      if (res.status === 400 || res.status === 429) {
        setError(data.error || 'Please check the form and try again.');
        setStatus('idle');
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Enquiry submit failed, falling back to email app:', err);
      setStatus('idle');
      mailtoFallback();
    }
  };

  return (
    <SiteShell page="contact">
      <section className="nv-split">
        <div className="nv-media nv-split__media" data-nv-clip>
          <SiteImage src={contactImage} alt="Navish studio" eager />
          <LabelCard title="Let's talk" sub={SITE.descriptor} />
        </div>
        <div className="nv-split__panel">
          <div>
            <p className="nv-eyebrow" style={{ marginBottom: '1rem' }}>
              Contact
            </p>
            <h1 className="nv-caps" data-nv-lines="now">
              Tell us about your project
            </h1>
          </div>
          <p className="nv-p" data-nv-lines="now">
            A new home, a workplace, an interior or a development - share a few details and we&rsquo;ll come back to you
            to arrange a first conversation.
          </p>
          <a className="nv-mail nv-ulink" href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>

          {status === 'done' ? (
            <div ref={thanksRef} tabIndex={-1} className="nv-msg nv-msg--ok" role="status" aria-live="polite" style={{ maxWidth: '34rem', fontSize: '1rem', outline: 'none' }}>
              <p className="nv-h3" style={{ marginBottom: '0.75rem' }}>
                Thank you{name ? `, ${name.split(' ')[0]}` : ''}.
              </p>
              <p style={{ margin: 0 }}>
                We&rsquo;ve received your enquiry and will reply to {email} within two working days.
              </p>
            </div>
          ) : (
          <form className="nv-form" onSubmit={onSubmit}>
            {/* Honeypot: hidden from people and screen readers; bots tend to fill it. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
              <label htmlFor="nv-c-website">Website</label>
              <input id="nv-c-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="nv-form__row">
              <div className="nv-field">
                <label htmlFor="nv-c-name">Name</label>
                <input id="nv-c-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </div>
              <div className="nv-field">
                <label htmlFor="nv-c-email">Email</label>
                <input id="nv-c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
            </div>
            <div className="nv-form__row">
              <div className="nv-field">
                <label htmlFor="nv-c-phone">Phone (optional)</label>
                <input id="nv-c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </div>
              <div className="nv-field">
                <label htmlFor="nv-c-type">Project</label>
                <select id="nv-c-type" value={type} onChange={(e) => setType(e.target.value)}>
                  {pathways.map((p) => (
                    <option key={p.id}>{p.title}</option>
                  ))}
                  <option>Something else</option>
                </select>
              </div>
            </div>
            <div className="nv-field">
              <label htmlFor="nv-c-msg">Message</label>
              <textarea id="nv-c-msg" value={message} onChange={(e) => setMessage(e.target.value)} required placeholder="Site, brief, timeline..." />
            </div>
            {error && (
              <p className="nv-msg nv-msg--err" role="alert">
                {error}
              </p>
            )}
            <div>
              <button type="submit" className="nv-btn nv-btn--red nv-arrow" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send enquiry'}{' '}
              </button>
            </div>
            <p className="nv-msg" style={{ opacity: 0.75 }}>
              We only use these details to reply to you. See our{' '}
              <SiteLink to="/privacy" className="nv-ulink">
                privacy policy
              </SiteLink>
              .
            </p>
          </form>
          )}

          {/* Server unreachable -> mailto: fallback, which silently does nothing when no
              mail app is set up, so always confirm and offer a copy fallback. */}
          {sent && status !== 'done' && (
            <div className="nv-msg nv-msg--ok" role="status" aria-live="polite" style={{ maxWidth: '34rem' }}>
              <p style={{ margin: 0 }}>
                Your email app should open with the enquiry ready to send. If nothing opened, copy the message and send it
                to{' '}
                <a className="nv-ulink" href={`mailto:${SITE.email}`}>
                  {SITE.email}
                </a>
                .
              </p>
              <button
                type="button"
                className="nv-textbtn"
                style={{ marginTop: '0.75rem' }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(sent.body);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? 'Copied to clipboard' : 'Copy message'}
              </button>
            </div>
          )}

          <p className="nv-eyebrow" style={{ marginTop: 'auto' }}>
            Existing client?{' '}
            <SiteLink to="/login" className="nv-ulink">
              Log in to your workspace
            </SiteLink>
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
