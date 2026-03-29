import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Nav } from "@/components/nav";
import { RepoLink } from "@/components/repo-link";
import { AuthSessionProvider } from "@/components/session-provider";
import { ThemeProviderWrapper } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { UIScaleProvider } from "@/components/ui-scale-provider";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(dmSans.variable, jetbrainsMono.variable)} suppressHydrationWarning>
      <body className="antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground">Skip to main content</a>
        <AuthSessionProvider>
          <ThemeProviderWrapper>
            <UIScaleProvider>
              <div className="flex h-screen">
                <div className="flex-1 flex flex-col min-w-0">
                  <Nav />
                  <main id="main-content" className="flex-1 overflow-y-auto mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
                </div>
                <ChatSidebar />
              </div>
              <RepoLink />
              <Toaster />
            </UIScaleProvider>
          </ThemeProviderWrapper>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
