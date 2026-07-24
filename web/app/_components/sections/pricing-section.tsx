import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "./section-heading";
import { windowsInstallerDownloadLinkProps } from "../../_lib/windows-installer-download";

export function PricingSection() {
  const downloadLink = windowsInstallerDownloadLinkProps();
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="py-20 lg:py-[120px]"
    >
      <Container className="flex flex-col gap-10">
        <Reveal>
          <SectionHeading id="pricing-heading">Pricing</SectionHeading>
        </Reveal>
        <Reveal>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-6 border border-border-strong p-8 md:p-10">
              <div className="flex flex-col gap-2">
                <p className="text-[34px] font-medium leading-none tracking-[-0.04em] text-foreground">
                  14-day trial
                </p>
                <p className="text-lg leading-8 text-muted-foreground lg:text-xl">
                  Create an account in the desktop app to try SabbathCue free for
                  two weeks.
                </p>
              </div>
              <div>
                <Button
                  href={downloadLink.href}
                  target={downloadLink.target}
                  download={downloadLink.download}
                  variant="primary"
                >
                  Download
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-6 border border-border-strong p-8 md:p-10">
              <div className="flex flex-col gap-2">
                <p className="text-[34px] font-medium leading-none tracking-[-0.04em] text-foreground">
                  Subscription
                </p>
                <p className="text-lg leading-8 text-muted-foreground lg:text-xl">
                  After your trial, renew access with Paddle checkout from the
                  app or on the web.
                </p>
              </div>
              <div>
                <Button href="/pricing/" variant="secondary">
                  View pricing
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
