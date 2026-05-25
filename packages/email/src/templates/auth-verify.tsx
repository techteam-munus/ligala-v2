import { Button, Text } from "@react-email/components";
import * as React from "react";
import { Layout } from "./layout";

export function AuthVerify({ name, verifyUrl }: { name: string; verifyUrl: string }) {
  return (
    <Layout>
      <Text style={{ fontSize: 16, color: "#111" }}>Hi {name},</Text>
      <Text style={{ fontSize: 14, color: "#333" }}>Confirm your email address to activate your Ligala account.</Text>
      <Button href={verifyUrl} style={{ backgroundColor: "#111", color: "#fff", borderRadius: 6, padding: "12px 20px", fontSize: 14 }}>Verify email</Button>
      <Text style={{ fontSize: 12, color: "#888" }}>Or paste this link: {verifyUrl}</Text>
    </Layout>
  );
}
