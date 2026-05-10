import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/invitation";
import { AcceptForm } from "./accept-form";

export default async function AcceptInvitationPage({
  params,
}: {
  params: { token: string };
}) {
  const tokenHash = hashToken(params.token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      expiresAt: true,
      status: true,
      organization: { select: { name: true } },
    },
  });

  if (!invitation) notFound();

  const now = new Date();
  const isExpired =
    invitation.expiresAt < now ||
    invitation.status === "EXPIRED" ||
    invitation.status === "REVOKED";
  const isAccepted = invitation.status === "ACCEPTED";

  // Mark as VIEWED on first GET (idempotent).
  if (invitation.status === "SENT") {
    await prisma.invitation
      .update({
        where: { id: invitation.id },
        data: { status: "VIEWED", viewedAt: new Date() },
      })
      .catch(() => undefined);
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <p className="text-caption uppercase tracking-wide text-ink-tertiary">
        Sentinel · {invitation.organization.name}
      </p>
      <h1 className="mt-2 text-display font-semibold text-ink-primary">
        You're invited.
      </h1>
      {isExpired && (
        <p className="mt-3 rounded-md border border-border bg-canvas-banded p-4 text-body text-ink-secondary">
          This invitation has expired. Ask your program manager to send a new one.
        </p>
      )}
      {isAccepted && (
        <p className="mt-3 rounded-md border border-border bg-canvas-banded p-4 text-body text-ink-secondary">
          This invitation has already been accepted. Sign in instead.
        </p>
      )}
      {!isExpired && !isAccepted && (
        <AcceptForm
          token={params.token}
          email={invitation.email}
          role={invitation.role}
        />
      )}
    </div>
  );
}
