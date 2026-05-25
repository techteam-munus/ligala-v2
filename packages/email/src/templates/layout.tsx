import { Body, Container, Head, Hr, Html, Section, Text } from "@react-email/components";
import * as React from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f6f6f6", fontFamily: "Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 8, maxWidth: 560, margin: "0 auto", padding: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>Ligala</Text>
          <Hr style={{ borderColor: "#eee", margin: "16px 0" }} />
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#eee", margin: "24px 0 16px" }} />
          <Text style={{ fontSize: 12, color: "#888", margin: 0 }}>
            Ligala by Munus · This is a transactional message. Replies go to support@mymunus.com.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
