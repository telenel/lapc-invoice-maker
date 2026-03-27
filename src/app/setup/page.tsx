"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Light", icon: SunIcon, description: "Clean and bright" },
  { value: "dark", label: "Dark", icon: MoonIcon, description: "Easy on the eyes" },
  { value: "theme-mocha", label: "Catppuccin", icon: PaletteIcon, description: "Warm and cozy" },
];

export default function SetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Profile
  const [name, setName] = useState(session?.user?.name || "");
  const [email, setEmail] = useState("");

  // Step 2: Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Pre-fill name when session loads
  const sessionName = session?.user?.name || "";
  if (sessionName && !name) setName(sessionName);

  function handleNextProfile() {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    setStep(2);
  }

  function handleNextPassword() {
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setStep(3);
  }

  async function handleComplete() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30">
      <div className="mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lapc-logo.png" alt="Los Angeles Pierce College" style={{ height: 80, width: "auto" }} />
      </div>
      <Card className="w-full max-w-md shadow-lg border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            {step === 1 && "Welcome! Set Up Your Profile"}
            {step === 2 && "Create Your Password"}
            {step === 3 && "Choose Your Theme"}
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Step {step} of 3
          </p>
        </CardHeader>
        <CardContent>
          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-name">Full Name</Label>
                <Input
                  id="setup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name…"
                  autoFocus
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Email</Label>
                <Input
                  id="setup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  This will become your username for future logins.
                </p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button onClick={handleNextProfile} className="w-full h-11 font-semibold bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white">
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Password */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-password">New Password</Label>
                <Input
                  id="setup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters…"
                  autoFocus
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-confirm">Confirm Password</Label>
                <Input
                  id="setup-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password…"
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep(1); setError(""); }} className="flex-1 h-11">
                  Back
                </Button>
                <Button onClick={handleNextPassword} className="flex-1 h-11 font-semibold bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Theme */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3">
                {themeOptions.map((t) => {
                  const Icon = t.icon;
                  const selected = theme === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-4 text-left transition-all hover:bg-accent/50",
                        selected ? "border-primary bg-accent ring-2 ring-primary/20" : "border-border"
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                      {selected && <CheckIcon className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep(2); setError(""); }} className="flex-1 h-11">
                  Back
                </Button>
                <Button onClick={handleComplete} disabled={loading} className="flex-1 h-11 font-semibold bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white">
                  {loading ? "Setting up…" : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
