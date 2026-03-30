"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function safeRedirectUrl(url: string | null): string {
  if (!url) return "/";
  // Only allow relative paths starting with / (not // or javascript:)
  if (!url.startsWith("/") || url.startsWith("//")) return "/";
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "/";
  } catch {
    return "/";
  }
  return url;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("laportal-remember-me");
    if (stored !== null) setRememberMe(stored === "true");
    // Auto-focus username on desktop only (avoid forcing keyboard on mobile)
    if (window.matchMedia("(pointer: fine)").matches) {
      usernameRef.current?.focus();
    }
  }, []);

  function handleCapsLock(e: React.KeyboardEvent) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      rememberMe: String(rememberMe),
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
      usernameRef.current?.focus();
    } else {
      router.push(safeRedirectUrl(searchParams.get("callbackUrl")));
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-lg border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl font-bold tracking-tight text-center">
          <span className="text-red-600">LA</span>Portal
        </CardTitle>
        <p className="text-sm text-muted-foreground text-center">Los Angeles Pierce College</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Email</Label>
            <Input
              ref={usernameRef}
              id="username"
              name="username"
              required
              className="h-11"
              type="email"
              inputMode="email"
              placeholder="you@piercecollege.edu…"
              autoComplete="username"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                className="h-11 pr-10"
                autoComplete="current-password"
                onKeyDown={handleCapsLock}
                onKeyUp={handleCapsLock}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            <p
              className={`text-xs text-amber-500${capsLock ? "" : " invisible"}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              Caps Lock is on
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => {
                const checked = e.target.checked;
                setRememberMe(checked);
                localStorage.setItem("laportal-remember-me", String(checked));
              }}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
              Remember me
            </Label>
          </div>
          {error && (
            <div aria-live="polite">
              <div className="border-t border-border/50" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          <Button type="submit" className="w-full h-11 font-semibold uppercase tracking-wide bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Los Angeles Pierce College Bookstore
        </p>
      </CardContent>
    </Card>
  );
}
