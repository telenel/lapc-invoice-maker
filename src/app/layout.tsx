import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Nav } from "@/components/nav";
import { AuthSessionProvider } from "@/components/session-provider";
import { ThemeProviderWrapper } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "LAPC InvoiceMaker",
  description: "Invoice generation for Los Angeles Pierce College",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(dmSans.variable, jetbrainsMono.variable)} suppressHydrationWarning>
      <body className="antialiased">
        <AuthSessionProvider>
          <ThemeProviderWrapper>
            <Nav />
            <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
            <Toaster />
          </ThemeProviderWrapper>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
