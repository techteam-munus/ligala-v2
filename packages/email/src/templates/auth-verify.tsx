import { Text } from "@react-email/components";
import * as React from "react";
import { Layout } from "./layout";

export function AuthVerify({ code }: { code: string }) {
  return (
    <Layout>
      <Text style={{ fontSize: 16, color: "#111" }}>Hi there,</Text>
      <Text style={{ fontSize: 14, color: "#333" }}>
        Use this code to verify your email address and activate your Ligala account:
      </Text>
      <Text
        style={{
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 8,
          color: "#111",
          backgroundColor: "#f1f1f1",
          borderRadius: 6,
          padding: "16px 0",
          textAlign: "center",
          margin: "8px 0",
        }}
      >
        {code}
      </Text>
      <Text style={{ fontSize: 12, color: "#888" }}>
        This code expires in 10 minutes. If you didn&apos;t create a Ligala account, you can ignore this email.
      </Text>
    </Layout>
  );
}
