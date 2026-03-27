"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SetupPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code)) {
      setError("Access code must be exactly 6 digits");
      return;
    }
    if (code !== confirm) {
      setError("Access codes don't match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to set access code");
        setLoading(false);
        return;
      }

      // Force session refresh to update needsSetup in token
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30">
      <div className="mb-8">
        <Image src="/lapc-logo.png" alt="Los Angeles Pierce College" className="h-20 mx-auto" width={80} height={80} />
      </div>
      <Card className="w-full max-w-sm shadow-lg border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            Set Your Access Code
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Choose a 6-digit code you&apos;ll use to log in
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">New Access Code</Label>
              <Input
                id="code"
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                required
                autoFocus
                className="h-11 text-center tracking-[0.5em] text-lg"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Access Code</Label>
              <Input
                id="confirm"
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                required
                className="h-11 text-center tracking-[0.5em] text-lg"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-11 font-semibold bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white"
              disabled={loading}
            >
              {loading ? "Setting up…" : "Set Access Code"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
