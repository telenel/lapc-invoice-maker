"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import { CheckIcon, LogOutIcon, MoonIcon, PaletteIcon, SunIcon, ZoomInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { HelpModal } from "@/components/help-modal";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useUIScale } from "@/components/ui-scale-provider";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/quotes", label: "Quotes" },
  { href: "/calendar", label: "Calendar" },
  { href: "/staff", label: "Staff" },
  { href: "/quick-picks", label: "Quick Picks" },
  { href: "/pricing-calculator", label: "Print Pricing" },
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
  const [logoutOpen, setLogoutOpen] = useState(false);
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
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-bold tracking-tight text-lg"><span className="text-red-600">LA</span>Portal</span>
          {process.env.NEXT_PUBLIC_BUILD_SHA && (
            <span className="text-[10px] text-muted-foreground/50 font-mono -ml-1 mt-1.5 select-all" title={`Built ${process.env.NEXT_PUBLIC_BUILD_TIME ?? ""}`}>
              {process.env.NEXT_PUBLIC_BUILD_SHA}
            </span>
          )}
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
                  "relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {role === "admin" && (
            <>
              <Link
                href="/admin/settings"
                className={cn(
                  "relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  pathname === "/admin/settings" || pathname === "/admin/users"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                Admin
              </Link>
              <Link
                href="/admin/pricing"
                className={cn(
                  "relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  pathname === "/admin/pricing"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                Print Admin
              </Link>
            </>
          )}
        </div>
        <div ref={menuRef} className="ml-auto flex items-center gap-1">
          <HelpModal />
          <NotificationBell />

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
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {session?.user?.name
              ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
              : "??"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setLogoutOpen(true)}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOutIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>Are you sure you want to sign out?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => signOut()}>Sign out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
