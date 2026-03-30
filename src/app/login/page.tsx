import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-red-50/30 login-dots">
      <div className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lapc-logo.png" alt="Los Angeles Pierce College" className="mx-auto" width={80} height={80} />
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
