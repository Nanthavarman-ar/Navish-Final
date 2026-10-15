import React from 'react';
import { SiteShell, SiteLink } from './SiteShell';
import { SITE } from './content';

// Keep this in step with what the site actually does. If a feature starts collecting
// something new (analytics, a contact-form backend, payments), update the matching
// section and the "Last updated" date.
const LAST_UPDATED = '15 October 2026';
const BUSINESS = 'Navish Studio Architects';
const LOCATION = 'Coimbatore, Tamil Nadu, India';

export function PrivacyPage() {
  return (
    <SiteShell page="privacy">
      <header className="nv-page-head">
        <div>
          <p className="nv-eyebrow" style={{ marginBottom: '1rem' }}>
            Legal
          </p>
          <h1 className="nv-caps" data-nv-lines="now">
            Privacy policy
          </h1>
        </div>
        <div className="nv-page-head__aside">
          <p className="nv-eyebrow">Last updated {LAST_UPDATED}</p>
        </div>
      </header>

      <article className="nv-legal">
        <section>
          <h2>Who we are</h2>
          <p>
            {BUSINESS} (&ldquo;Navish&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is an architecture and construction
            studio based in {LOCATION}, registered as an MSME (Udyam). This policy explains what personal information we
            collect through navishstudioarchitect.com and our 3D workspace, why we collect it, and the choices you have.
          </p>
          <p>
            For any privacy question or request, email{' '}
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <h3>When you contact us</h3>
          <p>
            The contact form does not send or store anything on our servers. It opens your own email app with your
            message filled in, and we receive whatever you choose to send: usually your name, email address, phone
            number (optional), project type and message.
          </p>
          <h3>If you are a client with an account</h3>
          <ul>
            <li>
              Account details we set up with you: name, username, email address and, if you give them to us, phone
              number, company and location.
            </li>
            <li>Your password, which is stored only in hashed form by our authentication provider. We cannot read it.</li>
            <li>3D models, drawings and other files you or we upload for your project.</li>
            <li>Notes, markers and other content you add in the 3D workspace.</li>
            <li>
              Security and activity records: what action was taken and when, your IP address and your browser type.
              These help us keep accounts secure and investigate problems.
            </li>
          </ul>
          <h3>Optional workspace features</h3>
          <p>
            Some workspace tools only work if you turn them on, and your browser asks for your permission first:
          </p>
          <ul>
            <li>Camera, for augmented-reality (AR) views and gesture controls.</li>
            <li>Microphone, for voice chat and the voice assistant.</li>
            <li>Location, for placing a design on a real site and for site-context tools.</li>
          </ul>
          <p>
            Camera and gesture processing happens on your device. Voice commands use your browser&rsquo;s built-in
            speech recognition, which your browser provider (for example Google, for Chrome) may process. Weather and
            map tools send the location you search for to OpenWeatherMap, OpenStreetMap or Google Maps to fetch that
            data.
          </p>
          <h3>What we do not collect</h3>
          <p>
            We do not use advertising, analytics or tracking cookies, and we do not sell or rent your information to
            anyone. Our fonts are hosted on our own site, so simply visiting does not share your IP address with font
            providers.
          </p>
        </section>

        <section>
          <h2>Cookies and browser storage</h2>
          <p>
            We only store what the site needs to work. When you log in, your session is kept in your browser&rsquo;s
            local storage so you stay signed in. The workspace also remembers small preferences, such as the last model
            you opened. None of this is used to track you, so we do not show a cookie banner. Clearing your browser
            data removes it.
          </p>
        </section>

        <section>
          <h2>Why we use your information</h2>
          <ul>
            <li>To reply to your enquiry and discuss your project.</li>
            <li>To provide your account, your models and the 3D workspace.</li>
            <li>To keep the service secure, prevent misuse and fix problems.</li>
            <li>To meet our legal, tax and accounting obligations.</li>
          </ul>
          <p>
            We rely on your consent (for example, when you contact us or turn on an optional feature), on what is
            needed to deliver the services you asked for, and on legitimate uses such as security. You can withdraw
            consent at any time.
          </p>
        </section>

        <section>
          <h2>Who we share it with</h2>
          <p>We use trusted service providers who process data for us only to run the service:</p>
          <ul>
            <li>Supabase: account login and database.</li>
            <li>Cloudflare: storage and delivery of 3D model files, and our domain&rsquo;s DNS.</li>
            <li>Vercel and Railway: website and server hosting.</li>
            <li>Google (Gmail): our email.</li>
          </ul>
          <p>
            These providers may store data on servers outside India. We only use providers that protect data with
            industry-standard security. We may also share information if the law requires it.
          </p>
          <p>
            If you use a public demo link we create for a model, anyone with that link can view the model without
            logging in. We only create these links for models intended to be shared.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <p>
            We keep account information and project files while your account is active and for as long as needed to
            complete your project and meet legal obligations. Enquiry emails are kept while they are relevant to a
            possible or ongoing project. When information is no longer needed, we delete it. You can ask us to delete
            your account and files at any time.
          </p>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            Depending on where you live, including under India&rsquo;s Digital Personal Data Protection Act 2023, the
            UK and EU GDPR, and the UAE data protection law, you can ask us to:
          </p>
          <ul>
            <li>tell you what personal information we hold about you and give you a copy;</li>
            <li>correct information that is wrong or incomplete;</li>
            <li>delete your information;</li>
            <li>stop or limit how we use it, or withdraw consent you gave earlier;</li>
            <li>move your information to another provider, where this applies.</li>
          </ul>
          <p>
            To make a request, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. We may need to confirm your
            identity first, and we will respond as soon as we can, within the time the law requires. If you are not
            happy with our response, you can complain to your local data protection authority, for example the Data
            Protection Board of India or, in the UK, the Information Commissioner&rsquo;s Office (ICO).
          </p>
        </section>

        <section>
          <h2>Security</h2>
          <p>
            All connections to our site use HTTPS, passwords are never stored in readable form, and access to client
            data is limited to the people who need it. No online service can be completely secure, so if we ever learn
            of a breach affecting your information, we will notify you and the relevant authorities as the law
            requires.
          </p>
        </section>

        <section>
          <h2>Children</h2>
          <p>
            Our services are for adults commissioning or managing building projects. We do not knowingly collect
            information from anyone under 18.
          </p>
        </section>

        <section>
          <h2>Changes to this policy</h2>
          <p>
            If we change how we handle personal information, we will update this page and the date at the top.
          </p>
        </section>

        <p className="nv-eyebrow" style={{ marginTop: '3rem' }}>
          <SiteLink to="/contact" className="nv-ulink">
            Contact us
          </SiteLink>
        </p>
      </article>
    </SiteShell>
  );
}
