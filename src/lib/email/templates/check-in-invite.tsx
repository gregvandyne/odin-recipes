import * as React from "react";
import { Button, Heading, Text } from "@react-email/components";
import { EmailShell } from "./shell";

export function CheckInInviteEmail({
  veteranName,
  weekNumber,
  url,
}: {
  veteranName: string;
  weekNumber: number;
  url: string;
}) {
  return (
    <EmailShell preview={`Five-minute check-in — week ${weekNumber}`}>
      <Heading style={{ fontSize: 22, fontWeight: 600, margin: "8px 0 16px", color: "#1A1A1A" }}>
        Hi {veteranName} — week {weekNumber}.
      </Heading>
      <Text style={{ fontSize: 16, lineHeight: "1.6", color: "#1A1A1A", margin: 0 }}>
        About five minutes. Skip what you want. You can stop anytime — what you've answered is saved.
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
        Open this week's check-in
      </Button>
    </EmailShell>
  );
}
