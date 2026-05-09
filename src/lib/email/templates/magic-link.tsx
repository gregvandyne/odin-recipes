import * as React from "react";
import { Button, Heading, Text } from "@react-email/components";
import { EmailShell } from "./shell";

export function MagicLinkEmail({ url, expiresMinutes }: { url: string; expiresMinutes: number }) {
  return (
    <EmailShell preview="Your Sentinel sign-in link">
      <Heading style={{ fontSize: 22, fontWeight: 600, margin: "8px 0 16px", color: "#1A1A1A" }}>
        Sign in to Sentinel
      </Heading>
      <Text style={{ fontSize: 16, lineHeight: "1.6", color: "#1A1A1A", margin: 0 }}>
        Click below to sign in. The link works once and expires in {expiresMinutes} minutes.
      </Text>
      <Button
        href={url}
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "12px 20px",
          borderRadius: 6,
          backgroundColor: "#3B5B7E",
          color: "#FFFFFF",
          fontWeight: 600,
          fontSize: 16,
          textDecoration: "none",
        }}
      >
        Sign in
      </Button>
      <Text style={{ marginTop: 24, fontSize: 13, color: "#737373", lineHeight: "1.5" }}>
        Didn't request this? Ignore the email — no action will be taken.
        If you keep seeing these, reply to your coordinator from inside the app or contact support.
      </Text>
    </EmailShell>
  );
}
