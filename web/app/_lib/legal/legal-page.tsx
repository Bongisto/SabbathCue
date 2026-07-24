import Link from "next/link";
import { Container } from "../../_components/ui/container";
import { LEGAL_LAST_UPDATED } from "./content";

export function LegalPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: readonly { title: string; body: string }[];
}) {
  return (
    <main className="min-h-screen py-16">
      <Container className="max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-border pb-8">
          <p className="text-sm text-muted-foreground">
            Last updated {LEGAL_LAST_UPDATED}
          </p>
          <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </header>
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-xl font-medium">{section.title}</h2>
              <p className="leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
        <footer className="border-t border-border pt-8 text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            Back to home
          </Link>
          {" · "}
          <Link href="/privacy/" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
          {" · "}
          <Link href="/terms/" className="underline-offset-4 hover:underline">
            Terms
          </Link>
          {" · "}
          <Link href="/refund/" className="underline-offset-4 hover:underline">
            Refund policy
          </Link>
        </footer>
      </Container>
    </main>
  );
}
