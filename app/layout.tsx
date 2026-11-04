import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chain Studio — POPUP.NYC",
  description: "Build, run, and review prompt chains.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
