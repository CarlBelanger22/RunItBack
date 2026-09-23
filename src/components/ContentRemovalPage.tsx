import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from './ui/button';
import { paths } from '../routing/paths';
import {
  buildContentRemovalMailto,
  CONTENT_REMOVAL_EMAIL,
  CONTENT_REMOVAL_SLA_HOURS,
} from '../lib/legal/contentRemoval';

/**
 * Public notice-and-removal page for team/tournament logos and descriptions.
 */
export function ContentRemovalPage() {
  const mailto = buildContentRemovalMailto();

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
        <h1 className="text-2xl font-semibold tracking-tight">
          Content notice and removal
        </h1>
        <p className="text-sm text-muted-foreground">
          Use this page to request review or removal of content hosted on RunItBack.
        </p>
      </div>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">What you can report</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Team logos and tournament logos stored or displayed by the app</li>
          <li>Team or tournament descriptions and other text on public team or tournament pages</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">How to send a notice</h2>
        <p className="text-muted-foreground">
          Email{' '}
          <a
            className="text-foreground underline underline-offset-2"
            href={mailto}
          >
            {CONTENT_REMOVAL_EMAIL}
          </a>{' '}
          with:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Your name and contact email</li>
          <li>The page URL or the team / tournament name</li>
          <li>A clear description of the content and why it should be removed or changed</li>
          <li>Any rights you claim (for example copyright ownership), if applicable</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-medium">Response time</h2>
        <p className="text-muted-foreground">
          We review valid removal notices and respond or act within{' '}
          <span className="text-foreground font-medium">
            {CONTENT_REMOVAL_SLA_HOURS} hours
          </span>{' '}
          of receiving them.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href={mailto}>
            <Mail className="w-4 h-4 mr-2" />
            Email removal request
          </a>
        </Button>
        <Button variant="outline" asChild>
          <Link to={paths.privacy}>Privacy Policy</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={paths.terms}>Terms of Use</Link>
        </Button>
      </div>
    </div>
  );
}
