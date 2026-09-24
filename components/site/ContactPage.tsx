import React, { useState } from 'react';
import { SiteShell, SiteLink } from './SiteShell';
import { LabelCard, SiteImage } from './brand';
import { SITE, contactImage, pathways } from './content';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState(pathways[0].title);
  const [message, setMessage] = useState('');

  // No backend for enquiries yet - hand the message to the visitor's mail client.
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `Project enquiry - ${type}`;
    const lines = [message, '', `Name: ${name}`, `Email: ${email}`];
    if (phone) lines.push(`Phone: ${phone}`);
    lines.push(`Project: ${type}`);
    const body = lines.join('\n');
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

          <form className="nv-form" onSubmit={onSubmit}>
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
            <div>
              <button type="submit" className="nv-btn nv-btn--red nv-arrow">
                Send enquiry{' '}
              </button>
            </div>
          </form>

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
