import { Suspense } from "react";
import { SignUpFlow } from "@/components/auth/SignUpFlow";

export default function Page() {
  return (
    <Suspense>
      <SignUpFlow />
    </Suspense>
  );
}
