import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export type PolicySection = { heading: string; body: string[] };

export function PolicyPage({
  title,
  updated,
  intro,
  sections,
  footer,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: PolicySection[];
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/"
          className="font-mono text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← BRUH
        </Link>

        <h1 className="mt-8 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Last updated {updated}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{intro}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        {footer && <div className="mt-12 border-t border-border pt-6 text-sm">{footer}</div>}

        <nav className="mt-12 flex gap-4 border-t border-border pt-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <Link to="/privacy" className="hover:text-primary">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-primary">
            Terms
          </Link>
          <Link to="/risk" className="hover:text-primary">
            Risk
          </Link>
        </nav>
      </div>
    </main>
  );
}
