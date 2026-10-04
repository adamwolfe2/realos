"use client";

import { useFormStatus } from "react-dom";

// Submit button for server-action forms: disables while the action is in
// flight so impatient double clicks can't create duplicates. Must render
// inside the <form>.
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ""} disabled:opacity-70 disabled:cursor-not-allowed`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
