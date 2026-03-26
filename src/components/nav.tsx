"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { HelpModal } from "@/components/help-modal";
import { themes } from "@/lib/themes";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/invoices/new", label: "New Invoice" },
  { href: "/staff", label: "Staff Directory" },
  { href: "/quick-picks", label: "Quick Picks" },
  { href: "/analytics", label: "Analytics" },
];

export function Nav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <nav className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lapc-logo.png" alt="LAPC" style={{ height: "28px" }} />
          InvoiceMaker
        </Link>
        <div className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {link.label}
            </Link>
          ))}
          {role === "admin" && (
            <Link
              href="/admin/users"
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === "/admin/users"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              Admin
            </Link>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HelpModal />
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="ghost" size="icon-sm" aria-label="Select theme">
                <Palette />
              </Button>
            } />
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                {themes.map((t) => (
                  <DropdownMenuRadioItem key={t.value} value={t.value}>
                    {t.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  );
}
