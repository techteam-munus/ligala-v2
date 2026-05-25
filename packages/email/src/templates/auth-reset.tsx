import { Button, Text } from "@react-email/components";
import * as React from "react";
import { Layout } from "./layout";

export function AuthReset({ name, resetUrl }: { name: string; resetUrl: string }) {
  return (
    <Layout>
      <Text style={{ fontSize: 16, color: "#111" }}>Hi {name},</Text>
      <Text style={{ fontSize: 14, color: "#333" }}>Reset your Ligala password.</Text>
      <Button href={resetUrl} style={{ backgroundColor: "#111", color: "#fff", borderRadius: 6, padding: "12px 20px", fontSize: 14 }}>Reset password</Button>
      <Text style={{ fontSize: 12, color: "#888" }}>Or paste this link: {resetUrl}</Text>
      <Text style={{ fontSize: 12, color: "#888" }}>If you didn&apos;t request this, you can ignore this email.</Text>
    </Layout>
  );
}
