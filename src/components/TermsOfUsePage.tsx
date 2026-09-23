import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from './ui/button';
import { paths } from '../routing/paths';
import { buildContentRemovalMailto } from '../lib/legal/contentRemoval';
import { TERMS_CONTACT_EMAIL, TERMS_LAST_UPDATED } from '../lib/legal/terms';

/**
 * Short Terms of Use for RunItBack. Plain language; not a substitute for legal advice.
 */
export function TermsOfUsePage() {
  const mailto = buildContentRemovalMailto({
    subject: 'RunItBack terms enquiry',
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
        <h1 className="text-2xl font-semibold tracking-tight">Terms of Use</h1>
        <p className="text-sm text-muted-foreground">
          Simple rules for using RunItBack. Last updated {TERMS_LAST_UPDATED}.
        </p>
      </div>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">1. Agreement</h2>
        <p className="text-muted-foreground">
          By using RunItBack, you agree to these Terms and our{' '}
          <Link
            to={paths.privacy}
            className="text-foreground underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          . If you do not agree, do not use the site.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">2. The service</h2>
        <p className="text-muted-foreground">
          RunItBack is a basketball statistics and tournament management
          website operated from Singapore. Features may include viewing games
          and standings, signing in with Google for detailed stats, and (for
          authorised operators) entering live stats and managing teams,
          players, and tournaments.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">3. Accounts</h2>
        <p className="text-muted-foreground">
          Some features require Google sign-in. You must use an account you are
          allowed to use, keep your access secure, and not share credentials or
          try to access another person’s account. We may suspend or remove
          access if these Terms are broken or if needed to protect the service.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">4. Content you upload or enter</h2>
        <p className="text-muted-foreground">
          If you upload logos, paste image URLs, or write team/tournament
          descriptions (or similar content), you confirm that you have the
          rights to use that material and that it does not infringe others’
          rights or break the law. You grant RunItBack permission to host and
          display that content as part of the service. We may remove content
          that appears unlawful, infringing, or harmful. See{' '}
          <Link
            to={paths.contentRemoval}
            className="text-foreground underline underline-offset-2"
          >
            Content notice and removal
          </Link>
          .
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">5. Acceptable use</h2>
        <p className="text-muted-foreground">You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Misuse the site, attempt to break security, or disrupt others’ use</li>
          <li>Scrape or bulk-export data in a way that harms the service</li>
          <li>Upload malware or illegal content</li>
          <li>Impersonate others or misrepresent your affiliation</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">6. Stats and accuracy</h2>
        <p className="text-muted-foreground">
          Game stats, standings, and related figures are provided for
          information and league operations. They may contain errors or delays.
          Do not rely on them as the sole basis for official decisions without
          verifying with your league organisers.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">7. Our intellectual property</h2>
        <p className="text-muted-foreground">
          The RunItBack name, branding, and the site’s software and design are
          owned by RunItBack or its licensors. You may not copy or reuse them
          except as needed to use the service normally.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">8. Disclaimer and liability</h2>
        <p className="text-muted-foreground">
          The service is provided “as is.” To the fullest extent allowed by
          Singapore law, RunItBack is not liable for indirect or consequential
          loss, or for decisions made based on stats shown on the site. Nothing
          in these Terms limits liability that cannot be limited by law.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">9. Changes</h2>
        <p className="text-muted-foreground">
          We may update these Terms from time to time. The “Last updated” date
          will change when we do. Continued use after an update means you
          accept the revised Terms.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">10. Contact and law</h2>
        <p className="text-muted-foreground">
          Questions:{' '}
          <a
            className="text-foreground underline underline-offset-2"
            href={mailto}
          >
            {TERMS_CONTACT_EMAIL}
          </a>
          . These Terms are governed by the laws of Singapore.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href={mailto}>
            <Mail className="w-4 h-4 mr-2" />
            Email contact
          </a>
        </Button>
        <Button variant="outline" asChild>
          <Link to={paths.privacy}>Privacy Policy</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={paths.contentRemoval}>Content removal</Link>
        </Button>
      </div>
    </div>
  );
}
