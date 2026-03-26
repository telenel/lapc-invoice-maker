"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import { CheckIcon, MoonIcon, PaletteIcon, SunIcon, ZoomInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HelpModal } from "@/components/help-modal";
import { useUIScale } from "@/components/ui-scale-provider";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/staff", label: "Staff" },
  { href: "/quick-picks", label: "Quick Picks" },
  { href: "/analytics", label: "Analytics" },
];

const themeOptions = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "theme-mocha", label: "Catppuccin", icon: PaletteIcon },
];

export function Nav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const { scale, setScale, scales } = useUIScale();
  const [menuOpen, setMenuOpen] = useState<"theme" | "scale" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close any open menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  if (status !== "authenticated") return null;

  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lapc-logo.png" alt="LAPC" width={32} style={{ height: "32px" }} />
          <span className="font-semibold tracking-tight text-lg">InvoiceMaker</span>
        </Link>
        <div className="flex gap-0.5">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium tracking-wide uppercase transition-colors",
                  isActive
                    ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {role === "admin" && (
            <Link
              href="/admin/settings"
              className={cn(
                "relative px-3 py-2 text-sm font-medium tracking-wide uppercase transition-colors",
                pathname.startsWith("/admin")
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Admin
            </Link>
          )}
        </div>
        <div ref={menuRef} className="ml-auto flex items-center gap-1">
          <HelpModal />

          {/* Theme picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Select theme"
              onClick={() => setMenuOpen(menuOpen === "theme" ? null : "theme")}
            >
              <PaletteIcon className="size-4" aria-hidden="true" />
            </Button>
            {menuOpen === "theme" && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[150px] rounded-lg border border-border bg-popover p-1 shadow-lg">
                {themeOptions.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        theme === t.value && "font-medium"
                      )}
                      onClick={() => { setTheme(t.value); setMenuOpen(null); }}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      <span>{t.label}</span>
                      {theme === t.value && <CheckIcon className="ml-auto size-3.5" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scale picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="UI scale"
              onClick={() => setMenuOpen(menuOpen === "scale" ? null : "scale")}
            >
              <ZoomInIcon className="size-4" aria-hidden="true" />
            </Button>
            {menuOpen === "scale" && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[150px] rounded-lg border border-border bg-popover p-1 shadow-lg">
                <p className="px-2.5 py-1 text-xs font-medium text-muted-foreground">UI Scale</p>
                {scales.map((s) => (
                  <button
                    key={s.value}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                      scale === s.value && "font-medium"
                    )}
                    onClick={() => { setScale(s.value as typeof scale); setMenuOpen(null); }}
                  >
                    <span>{s.label}</span>
                    {scale === s.value && <CheckIcon className="ml-auto size-3.5" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-border/60" />
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  );
}
