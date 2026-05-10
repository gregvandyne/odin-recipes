import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, ScrollText, Building2 } from "lucide-react";

/**
 * Org-level settings landing. Surfaces the current organization context
 * and links to the controls we have today: user-roster import, audit log,
 * coordinator caseload reassignment.
 */
export default async function AdminSettingsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId || !organizationId) redirect("/auth/sign-in");
  if (role !== "PROGRAM_MANAGER" && role !== "SUPER_ADMIN") redirect("/admin");

  const org = await withTenant(
    { organizationId, userId, userRole: role, isOrgAdmin: false },
    async (tx) =>
      tx.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          slug: true,
          status: true,
          mfaEnforcementLevel: true,
          dataRetentionPolicy: true,
          testModeUntil: true,
        },
      }),
  );

  return (
    <div className="space-y-6 px-6 py-6">
      <PageHeader eyebrow="Program" title="Settings" />

      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-canvas-banded text-ink-tertiary">
            <Building2 className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-body font-semibold text-ink-primary">{org?.name ?? "—"}</h2>
            <p className="text-caption text-ink-tertiary">slug: {org?.slug}</p>
          </div>
          <Badge variant={org?.status === "ACTIVE" ? "primary" : "outline"} className="ml-auto">
            {org?.status ?? "—"}
          </Badge>
        </div>
        {org?.status === "TEST_MODE" && org.testModeUntil && (
          <p className="mt-3 text-caption text-ink-tertiary">
            Test mode until {org.testModeUntil.toLocaleDateString()}.
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-caption">
          <div>
            <dt className="font-semibold uppercase tracking-wide text-ink-tertiary">MFA enforcement</dt>
            <dd className="text-ink-primary">{org?.mfaEnforcementLevel ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <ul className="overflow-hidden divide-y divide-border rounded-lg border border-border bg-canvas-card">
        <SettingLink
          href="/admin/coordinators"
          icon={<Users className="h-4 w-4" aria-hidden />}
          title="Coordinators"
          description="Caseload health + reassignments"
        />
        <SettingLink
          href="/admin/audit"
          icon={<ScrollText className="h-4 w-4" aria-hidden />}
          title="Audit log"
          description="Read-only browser + NDJSON export (MFA-gated)"
        />
        <SettingLink
          href="/admin/caseload/reassign"
          icon={<Settings className="h-4 w-4" aria-hidden />}
          title="Reassign caseload"
          description="Move veterans between coordinators (MFA-gated)"
        />
      </ul>

      <p className="text-caption text-ink-tertiary">
        Org-level provisioning, branding, and cohort wizards are coming as a follow-up — for the
        pilot, contact the platform team for any change to the org record.
      </p>
    </div>
  );
}

function SettingLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas-banded focus-visible:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="grid h-9 w-9 place-items-center rounded-md bg-canvas-banded text-ink-tertiary">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-body font-semibold text-ink-primary">{title}</div>
          <div className="truncate text-caption text-ink-tertiary">{description}</div>
        </div>
      </Link>
    </li>
  );
}
