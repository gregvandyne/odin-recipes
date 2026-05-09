import * as React from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

/**
 * Shared shell for every Sentinel email.
 * Plain typography, restrained palette, persistent crisis-line footer.
 */
export function EmailShell({
  preview,
  children,
  orgName = "Sentinel",
}: {
  preview: string;
  children: React.ReactNode;
  orgName?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#FAFAF7", fontFamily: "Inter,Helvetica,Arial,sans-serif", color: "#1A1A1A", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
          <Text style={{ fontSize: 13, color: "#737373", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {orgName}
          </Text>
          <Section style={{ marginTop: 16 }}>{children}</Section>
          <Hr style={{ borderColor: "#E5E5E5", margin: "32px 0 16px" }} />
          <Text style={{ fontSize: 13, color: "#737373", lineHeight: "1.5", margin: 0 }}>
            In crisis?{" "}
            <a href="tel:988" style={{ color: "#8B1A1A", fontWeight: 600, textDecoration: "underline" }}>Call 988, press 1</a>{" "}
            — Veterans Crisis Line, 24/7. You don't have to be in crisis to call.
          </Text>
          <Text style={{ fontSize: 12, color: "#A0A0A0", margin: "12px 0 0" }}>
            This message is part of Sentinel's first-year support program. Replies don't go to a monitored inbox; use the app to message your coordinator.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
