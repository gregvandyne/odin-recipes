import * as React from "react";
import { Button, Heading, Text } from "@react-email/components";
import { EmailShell } from "./shell";

interface Props {
  coordinatorName: string;
  veteranName: string;
  severity: "ORANGE" | "RED";
  explanation: string;
  recommendedTimeframe: string;
  caseUrl: string;
}

/**
 * Coordinator-side alert for ORANGE/RED flags.
 * Per spec: cannot be disabled by the coordinator.
 */
export function FlagAlertEmail({
  coordinatorName,
  veteranName,
  severity,
  explanation,
  recommendedTimeframe,
  caseUrl,
}: Props) {
  const accent = severity === "RED" ? "#A82E2E" : "#C4622D";
  const label  = severity === "RED" ? "Immediate action" : "Outreach within 24 hours";
  return (
    <EmailShell preview={`${severity}: ${veteranName}`}>
      <Text style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: accent }}>
        {label}
      </Text>
      <Heading style={{ fontSize: 22, fontWeight: 600, margin: "4px 0 16px", color: "#1A1A1A" }}>
        {coordinatorName}, {veteranName} needs you.
      </Heading>
      <Text style={{ fontSize: 16, lineHeight: "1.6", color: "#1A1A1A", margin: 0 }}>{explanation}</Text>
      <Text style={{ fontSize: 14, color: "#4A4A4A", margin: "12px 0 0" }}>
        Recommended timeframe: <strong>{recommendedTimeframe}</strong>
      </Text>
      <Button
        href={caseUrl}
        style={{
          display: "inline-block",
          marginTop: 20,
          padding: "12px 20px",
          borderRadius: 6,
          backgroundColor: accent,
          color: "#FFFFFF",
          fontWeight: 600,
          fontSize: 16,
          textDecoration: "none",
        }}
      >
        Open case
      </Button>
    </EmailShell>
  );
}
