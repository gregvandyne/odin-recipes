import Link from "next/link";
import { Phone, MessageSquare, ExternalLink, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Veteran resources page (bottom-nav target).
 *
 * Curated list, calm + concrete. Crisis line is first and largest. Then
 * VA benefits, financial counseling, and grounded self-help reading. Each
 * resource opens in a new tab; the 988 phone link uses tel:.
 */
const RESOURCES = [
  {
    title: "Veterans Crisis Line — 988, press 1",
    description:
      "24/7. Confidential. Talk to someone who's trained for what you're carrying. Text 838255 if calling isn't possible right now.",
    href: "tel:988",
    Icon: Phone,
    accent: "crisis",
  },
  {
    title: "Text the Crisis Line",
    description: "Send any message to 838255. Same trained responders.",
    href: "sms:838255",
    Icon: MessageSquare,
    accent: "crisis",
  },
  {
    title: "VA benefits",
    description: "Health care, disability, education, housing — start here.",
    href: "https://www.va.gov/",
    Icon: ExternalLink,
    accent: "default",
  },
  {
    title: "Financial counseling",
    description: "Free, confidential financial counseling for service members and veterans.",
    href: "https://www.consumerfinance.gov/consumer-tools/educator-tools/servicemembers/financial-coaching/",
    Icon: ExternalLink,
    accent: "default",
  },
  {
    title: "About transitions (reading)",
    description:
      "A short, plain-language piece on what most people experience after separation. Helpful even if you're doing fine.",
    href: "https://www.va.gov/transition/",
    Icon: BookOpen,
    accent: "default",
  },
] as const;

export default function VeteranResourcesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resources"
        title="Help and reading"
        description="A short list. Use what helps. Skip what doesn't."
      />

      <ul className="space-y-3" role="list">
        {RESOURCES.map((r) => {
          const isExternal = r.href.startsWith("http");
          const isCrisis = r.accent === "crisis";
          return (
            <li key={r.title}>
              <Link
                href={r.href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={`block rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isCrisis
                    ? "border-crisis/30 bg-crisis/5 hover:bg-crisis/10"
                    : "border-border bg-canvas-card hover:bg-canvas-banded"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${
                      isCrisis ? "bg-crisis/10 text-crisis" : "bg-canvas-banded text-ink-tertiary"
                    }`}
                  >
                    <r.Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className={`text-body font-semibold ${isCrisis ? "text-crisis" : "text-ink-primary"}`}
                    >
                      {r.title}
                    </h2>
                    <p className="mt-0.5 text-body text-ink-secondary">{r.description}</p>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-caption text-ink-tertiary">
        If you have a resource that helped you, tell your coordinator. We'll consider adding it
        for the next cohort.
      </p>
    </div>
  );
}
