"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");

  const isAccessCode = /^\d{6}$/.test(username.trim());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: formData.get("username") as string,
      password: isAccessCode ? "" : (formData.get("password") as string),
      redirect: false,
    });

    if (result?.error) {
      setError(isAccessCode ? "Invalid access code" : "Invalid username or password");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-lg border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl font-bold tracking-tight text-center">
          InvoiceMaker
        </CardTitle>
        <p className="text-sm text-muted-foreground text-center">Los Angeles Pierce College</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">
              {isAccessCode ? "Access Code" : "Username"}
            </Label>
            <Input
              id="username"
              name="username"
              required
              autoFocus
              className="h-11"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or 6-digit code…"
              autoComplete="username"
              spellCheck={false}
            />
          </div>
          {!isAccessCode && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required className="h-11" autoComplete="current-password" />
            </div>
          )}
          {error && (
            <div aria-live="polite">
              <div className="border-t border-border/50" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          <Button type="submit" className="w-full h-11 font-semibold uppercase tracking-wide bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white" disabled={loading}>
            {loading
              ? "Signing in…"
              : isAccessCode
              ? "Log in with access code"
              : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
