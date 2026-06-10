import {
  BookOpenIcon,
  GraduationCapIcon,
  HeartIcon,
  ScaleIcon,
  ScrollTextIcon,
  ShieldIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  COPYRIGHT_SECTIONS,
  HELP_GUIDE_SECTIONS,
  HELP_LEGAL_AGREEMENT_NOTICE,
  HELP_LEGAL_APP_VERSION,
  HELP_LEGAL_CLOSING_MESSAGE,
  HELP_LEGAL_COPYRIGHT_HOLDER,
  HELP_LEGAL_CREATOR,
  HELP_LEGAL_TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
} from "@/content/help-legal"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { useTutorialStore } from "@/stores/tutorial-store"

function SectionBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="glass-panel space-y-3 p-5">
      <h3 className="text-sm font-semibold tracking-wide text-white uppercase">
        {title}
      </h3>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">
        {children}
      </div>
    </section>
  )
}

function ProseParagraph({ text }: { text: string }) {
  return (
    <>
      {/* Paragraphs are static content, so index keys are stable. */}
      {text.split("\n\n").map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </>
  )
}

export function HelpLegalPage() {
  return (
    <div className="view-pane mx-auto flex max-w-4xl flex-col gap-5">
      <div className="glass-panel space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="font-mono text-[11px] tracking-widest text-[var(--accent)] uppercase">
              User guide & legal
            </p>
            <h2 className="text-2xl font-bold text-white">
              Help, Terms & Copyright
            </h2>
            <p className="max-w-2xl text-sm text-slate-400">
              Everything you need to use {APP_DISPLAY_NAME} confidently — plus
              the terms you agree to when you download and run the app.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-right">
            <p className="text-[10px] tracking-wide text-slate-500 uppercase">
              Version
            </p>
            <p className="font-mono text-sm text-slate-200">
              v{HELP_LEGAL_APP_VERSION}
            </p>
          </div>
        </div>

        <div
          className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
          role="note"
        >
          <p className="font-medium text-amber-50">Important — please read</p>
          <p className="mt-1 leading-relaxed">{HELP_LEGAL_AGREEMENT_NOTICE}</p>
        </div>
      </div>

      <Tabs defaultValue="guide" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-950/60 p-1.5">
          <TabsTrigger value="guide" className="gap-1.5 px-3 py-2 text-xs">
            <BookOpenIcon className="size-3.5" />
            User guide
          </TabsTrigger>
          <TabsTrigger value="terms" className="gap-1.5 px-3 py-2 text-xs">
            <ScaleIcon className="size-3.5" />
            Terms & conditions
          </TabsTrigger>
          <TabsTrigger value="copyright" className="gap-1.5 px-3 py-2 text-xs">
            <ShieldIcon className="size-3.5" />
            Copyright
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-1.5 px-3 py-2 text-xs">
            <HeartIcon className="size-3.5" />
            A note for you
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="space-y-4">
          <SectionBlock title="Interactive tutorial">
            <p>
              New to {APP_DISPLAY_NAME}? Walk through every major feature with
              the built-in tutorial.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => useTutorialStore.getState().startTutorial()}
            >
              <GraduationCapIcon className="mr-1.5 size-3.5" />
              Restart tutorial
            </Button>
          </SectionBlock>

          {HELP_GUIDE_SECTIONS.map((section) => (
            <SectionBlock key={section.title} title={section.title}>
              <ul className="list-disc space-y-2 pl-5 marker:text-[var(--accent)]">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </SectionBlock>
          ))}
        </TabsContent>

        <TabsContent value="terms" className="space-y-4">
          <SectionBlock title="Terms and conditions">
            <p className="text-slate-400">
              Effective for version {HELP_LEGAL_APP_VERSION}. Last updated{" "}
              {HELP_LEGAL_TERMS_LAST_UPDATED}.
            </p>
          </SectionBlock>

          {TERMS_SECTIONS.map((section) => (
            <SectionBlock key={section.title} title={section.title}>
              <ProseParagraph text={section.body} />
            </SectionBlock>
          ))}

          <div className="glass-panel border border-white/5 p-5 text-xs text-slate-500">
            <ScrollTextIcon className="mb-2 size-4 text-slate-400" />
            This document is provided for in-app notice and user agreement. It
            does not constitute legal advice. For formal legal questions,
            consult a qualified attorney in your jurisdiction.
          </div>
        </TabsContent>

        <TabsContent value="copyright" className="space-y-4">
          {COPYRIGHT_SECTIONS.map((section) => (
            <SectionBlock key={section.title} title={section.title}>
              <ProseParagraph text={section.body} />
            </SectionBlock>
          ))}

          <SectionBlock title="All rights reserved">
            <p>
              Except where otherwise noted, all rights in {APP_DISPLAY_NAME} are
              reserved by {HELP_LEGAL_COPYRIGHT_HOLDER}. Your licence to use
              the App is personal to you and subject to the Terms and
              Conditions.
            </p>
          </SectionBlock>
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <SectionBlock title="Created with care">
            <p className="text-base text-slate-200">
              {APP_DISPLAY_NAME} is created by{" "}
              <span className="font-semibold text-white">
                {HELP_LEGAL_CREATOR}
              </span>
              .
            </p>
            <p>{HELP_LEGAL_CLOSING_MESSAGE.greeting}</p>
            <p>{HELP_LEGAL_CLOSING_MESSAGE.body}</p>
          </SectionBlock>

          <blockquote className="glass-panel space-y-3 border-l-4 border-[var(--accent)] p-5 not-italic">
            <p className="font-serif text-lg leading-relaxed text-slate-100">
              &ldquo;{HELP_LEGAL_CLOSING_MESSAGE.verse.text}&rdquo;
            </p>
            <footer className="text-sm font-medium text-[var(--accent)]">
              — {HELP_LEGAL_CLOSING_MESSAGE.verse.reference}
            </footer>
          </blockquote>

          <div className="glass-panel p-5">
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {HELP_LEGAL_CLOSING_MESSAGE.signOff}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
