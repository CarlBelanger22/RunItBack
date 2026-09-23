import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from './ui/button';
import { paths } from '../routing/paths';
import { buildContentRemovalMailto } from '../lib/legal/contentRemoval';
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_LAST_UPDATED,
} from '../lib/legal/privacy';

/**
 * Plain-language privacy / data-protection notice for RunItBack (Singapore).
 * Describes practices reflected in the product; not a substitute for legal advice.
 */
export function PrivacyPolicyPage() {
  const mailto = buildContentRemovalMailto({
    subject: 'RunItBack privacy enquiry',
  });

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={paths.home}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          How RunItBack collects, uses, and discloses personal data. Last updated{' '}
          {PRIVACY_POLICY_LAST_UPDATED}.
        </p>
      </div>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">1. Who we are</h2>
        <p className="text-muted-foreground">
          RunItBack is a basketball statistics and tournament management website
          operated from Singapore. For privacy questions or requests, contact{' '}
          <a
            className="text-foreground underline underline-offset-2"
            href={mailto}
          >
            {PRIVACY_CONTACT_EMAIL}
          </a>
          . This address is also our contact for data-protection enquiries.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">2. What personal data we collect</h2>
        <p className="text-muted-foreground">Depending on how you use the site, we may process:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>
            <span className="text-foreground">Account data</span> when you sign in
            with Google: name, email address, and profile photo URL provided by
            Google / our auth provider.
          </li>
          <li>
            <span className="text-foreground">Usage signals for operators</span> in
            production: limited notices that a signed-in user signed up or opened
            the app (name, email, event type, and timestamp), sent to our private
            admin channel so we can understand who is using the product.
          </li>
          <li>
            <span className="text-foreground">Basketball content</span> entered by
            league operators: team and player names, jersey numbers, game
            statistics, optional profile details (for example height, weight, or
            date of birth), descriptions, and logos.
          </li>
          <li>
            <span className="text-foreground">Technical data</span> needed to run
            the site: authentication session cookies or tokens, and browser
            local storage used for app data snapshots or similar functional
            preferences. We do not use third-party advertising or analytics pixels.
          </li>
        </ul>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">3. How we collect it</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Directly from you when you sign in with Google.</li>
          <li>
            Automatically when a signed-in session is active in production (for
            the limited admin usage notices described above).
          </li>
          <li>
            From authorised league operators who enter or upload team, player,
            tournament, and game information.
          </li>
        </ul>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">4. Why we use it</h2>
        <p className="text-muted-foreground">We use personal data to:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Authenticate users and provide signed-in features (for example detailed stats views).</li>
          <li>Operate and improve the basketball stats and tournament service.</li>
          <li>Display public league information that operators choose to publish.</li>
          <li>Receive and handle content-removal or privacy requests.</li>
          <li>
            Let the operator know about new sign-ups and daily app use in
            production (admin notifications only; not for advertising to you).
          </li>
        </ul>
        <p className="text-muted-foreground">
          We do not sell personal data. We do not use it for third-party marketing.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">5. Who we share it with</h2>
        <p className="text-muted-foreground">
          We use service providers to run RunItBack. Personal data may be
          processed by:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>
            <span className="text-foreground">Google</span> — sign-in (OAuth).
          </li>
          <li>
            <span className="text-foreground">Supabase</span> — authentication,
            database, and file storage for the app.
          </li>
          <li>
            <span className="text-foreground">Telegram</span> — delivery of the
            private admin signup / app-open notices described above.
          </li>
          <li>
            Hosting providers that serve the website (for example the platform
            that hosts the front end).
          </li>
        </ul>
        <p className="text-muted-foreground">
          Some of these providers may process data on servers outside Singapore.
          We use them only as needed to provide the service.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">6. Cookies and local storage</h2>
        <p className="text-muted-foreground">
          We use essential cookies or similar storage for sign-in sessions and
          functional local storage so the app can work (for example caching
          league data offline). We do not use non-essential advertising trackers.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">7. How long we keep data</h2>
        <p className="text-muted-foreground">
          Account and sports data are kept while needed to operate the league
          service and related records. Admin usage notices are deduplicated and
          kept only as needed for that operational purpose. You may ask us to
          delete or correct personal data that relates to you (see below);
          some sports records may remain if they are part of published game
          history that others rely on.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">8. Security</h2>
        <p className="text-muted-foreground">
          We rely on our providers’ security controls (including authenticated
          access and database permissions) and limit admin tools to authorised
          accounts. No method of transmission or storage is completely secure.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">9. Your choices and requests</h2>
        <p className="text-muted-foreground">Under Singapore’s PDPA framework, you may:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Ask what personal data we hold about you and request a copy or correction.</li>
          <li>
            Withdraw consent for optional processing where applicable (for
            example by signing out and stopping use of the account features).
          </li>
          <li>
            Ask us to delete account-related personal data where reasonable; we
            will explain if some game/league records must remain.
          </li>
        </ul>
        <p className="text-muted-foreground">
          Email{' '}
          <a
            className="text-foreground underline underline-offset-2"
            href={mailto}
          >
            {PRIVACY_CONTACT_EMAIL}
          </a>{' '}
          with your request. We will respond within a reasonable time.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">10. Children</h2>
        <p className="text-muted-foreground">
          RunItBack may display youth or school league statistics entered by
          operators. Account sign-in is intended for adults or users who can
          lawfully use Google accounts. If you believe a child’s personal data
          was uploaded inappropriately, contact us to request review or removal.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">11. Changes</h2>
        <p className="text-muted-foreground">
          We may update this policy when the product or our practices change.
          The “Last updated” date at the top will change when we do. Continued
          use of the site after an update means you should review the revised
          policy.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">12. Related pages</h2>
        <p className="text-muted-foreground">
          For logo or description removal requests, see{' '}
          <Link
            to={paths.contentRemoval}
            className="text-foreground underline underline-offset-2"
          >
            Content notice and removal
          </Link>
          . Site rules are in our{' '}
          <Link
            to={paths.terms}
            className="text-foreground underline underline-offset-2"
          >
            Terms of Use
          </Link>
          .
        </p>
      </section>

      <div>
        <Button asChild>
          <a href={mailto}>
            <Mail className="w-4 h-4 mr-2" />
            Email privacy contact
          </a>
        </Button>
      </div>
    </div>
  );
}
