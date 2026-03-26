import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Nav } from "@/components/nav";
import { AuthSessionProvider } from "@/components/session-provider";
import { ThemeProviderWrapper } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
    <html lang="en" className={cn(geistSans.variable, geistMono.variable)} suppressHydrationWarning>
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
