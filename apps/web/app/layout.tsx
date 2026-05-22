import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Fraunces, Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  axes: ["opsz"],
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ligala",
    template: "%s | Ligala",
  },
  description: "Philippine legal services platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", fraunces.variable, geist.variable)}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
