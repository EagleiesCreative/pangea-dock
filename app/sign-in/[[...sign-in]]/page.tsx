import { Suspense } from "react";
import { SignInFlow } from "@/components/auth/SignInFlow";

export default function Page() {
  return (
    <Suspense>
      <SignInFlow />
    </Suspense>
  );
}
