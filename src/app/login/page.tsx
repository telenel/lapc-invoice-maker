import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="login-page relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-red-950/10 dark:to-red-950/20" />
      <div className="absolute inset-0 login-dots" />
      <div className="login-glow" />

      {/* Brahma bull watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brahma-bull.png"
        alt=""
        aria-hidden="true"
        className="absolute right-[-5%] bottom-[-5%] w-[40vw] max-w-[500px] opacity-[0.03] dark:opacity-[0.05] select-none pointer-events-none"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center login-entrance">
        <Suspense>
          <LoginForm />
        </Suspense>
        <div className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lapc-logo.png" alt="Los Angeles Pierce College" className="mx-auto drop-shadow-sm" width={420} height={420} />
        </div>
      </div>
    </div>
  );
}
