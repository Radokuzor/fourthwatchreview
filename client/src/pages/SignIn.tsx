import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-12">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-2xl",
          },
        }}
        routing="hash"
        signUpUrl="/free-trial"
        fallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/free-trial"
      />
    </div>
  );
}
