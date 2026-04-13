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
import { ChatSidebarShell } from "@/components/chat/chat-sidebar-shell";
import { readBuildMeta } from "@/lib/build-meta";
import { siteIconsMetadata } from "@/lib/site-icons";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "LAPortal",
  description: "Operations portal for Los Angeles Pierce College",
  icons: siteIconsMetadata,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildMeta = await readBuildMeta();

  return (
    <html lang="en" className={cn(dmSans.variable, jetbrainsMono.variable)} suppressHydrationWarning>
      <body className="min-h-dvh overflow-x-hidden antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground">Skip to main content</a>
        <AuthSessionProvider>
          <ThemeProviderWrapper>
            <UIScaleProvider>
              <div className="flex min-h-dvh flex-col lg:h-screen lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col">
                  <Nav />
                  <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">{children}</main>
                </div>
                <ChatSidebarShell />
              </div>
              <RepoLink buildSha={buildMeta?.buildSha ?? null} />
              <Toaster />
            </UIScaleProvider>
          </ThemeProviderWrapper>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
