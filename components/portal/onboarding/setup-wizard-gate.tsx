"use client";

import * as React from "react";
import { SetupWizard, type WizardStep } from "./setup-wizard";

const STORAGE_KEY = "ls_setup_dismissed";

type SetupWizardGateProps = {
  shouldShow: boolean;
  steps: WizardStep[];
};

export function SetupWizardGate({ shouldShow, steps }: SetupWizardGateProps) {
  const [dismissed, setDismissed] = React.useState<boolean>(true);

  // Read localStorage only after mount (avoids SSR mismatch).
  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setDismissed(stored === "1");
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  if (dismissed || !shouldShow) {
    return null;
  }

  return <SetupWizard steps={steps} onDismiss={handleDismiss} />;
}
