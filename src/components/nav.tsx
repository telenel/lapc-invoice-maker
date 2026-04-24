"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import { CheckIcon, LogOutIcon, MenuIcon, MoonIcon, PaletteIcon, SunIcon, XIcon, ZoomInIcon } from "lucide-react";
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
import { useUIScale } from "@/components/ui-scale-provider";

const NotificationBell = dynamic(
  () => import("@/components/notifications/notification-bell").then((m) => m.NotificationBell),
  { ssr: false },
);

type NavLink = {
  href: string;
  label: string;
  matchPrefix?: string;
};

const links: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/quotes", label: "Quotes" },
  { href: "/textbook-requisitions", label: "Requisitions", matchPrefix: "/textbook-requisitions" },
  { href: "/products", label: "Products" },
  { href: "/copytech/import", label: "CopyTech", matchPrefix: "/copytech" },
  { href: "/calendar", label: "Calendar" },
  { href: "/staff", label: "Staff" },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  useEffect(() => {
    setMobileNavOpen(false);
    setMenuOpen(null);
  }, [pathname]);

  if (status !== "authenticated") return null;

  const role = (session?.user as { role?: string } | undefined)?.role;
  const adminLink: NavLink = { href: "/admin/settings", label: "Admin", matchPrefix: "/admin" };
  const allLinks = [
    ...links,
    { href: "/archive", label: "Archive", matchPrefix: "/archive" },
    { href: "/analytics", label: "Analytics" },
    ...(role === "admin" ? [adminLink] : []),
  ];

  function isLinkActive(link: NavLink) {
    const matchTarget = link.matchPrefix ?? link.href;
    return matchTarget === "/"
      ? pathname === "/"
      : pathname === matchTarget || pathname.startsWith(matchTarget + "/");
  }

  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-5 sm:gap-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 shrink-0">
          <span className="font-bold tracking-tight text-xl"><span className="text-red-600">LA</span>Portal</span>
        </Link>
        <div className="hidden gap-1 md:flex">
          {allLinks.map((link) => {
            const isActive = isLinkActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-3.5 py-2 text-[0.9375rem] font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div ref={menuRef} className="ml-auto flex items-center gap-1">
          <NotificationBell />

          {/* Theme picker */}
          <div className="relative hidden sm:block">
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
          <div className="relative hidden sm:block">
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

          <div className="hidden h-5 w-px bg-border/60 sm:block" />
          <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground sm:flex">
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
            className="hidden sm:inline-flex"
          >
            <LogOutIcon className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            title="Menu"
            className="md:hidden"
          >
            {mobileNavOpen ? <XIcon className="size-4" aria-hidden="true" /> : <MenuIcon className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="border-t border-border/60 bg-background/95 px-4 py-4 md:hidden">
          <div className="grid gap-2">
            {allLinks.map((link) => {
              const isActive = isLinkActive(link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 grid gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {session?.user?.name
                  ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                  : "??"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{session?.user?.name ?? "Signed in"}</p>
                <p className="truncate text-xs text-muted-foreground">{session?.user?.email ?? ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {themeOptions.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-left text-sm",
                      theme === t.value && "border-primary/40 bg-background font-medium"
                    )}
                    onClick={() => setTheme(t.value)}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    <span className="truncate">{t.label}</span>
                    {theme === t.value && <CheckIcon className="ml-auto size-3.5" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">UI scale</p>
              <div className="flex flex-wrap gap-2">
                {scales.map((s) => (
                  <button
                    key={s.value}
                    className={cn(
                      "rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium",
                      scale === s.value && "border-primary/40 bg-background text-foreground"
                    )}
                    onClick={() => setScale(s.value as typeof scale)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="destructive" onClick={() => setLogoutOpen(true)}>
              <LogOutIcon className="mr-2 size-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      )}

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
