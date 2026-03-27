import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30">
      <div className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lapc-logo.png" alt="Los Angeles Pierce College" className="mx-auto" style={{ height: 80, width: "auto" }} />
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
