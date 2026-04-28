"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  Save,
  Trash2,
  Plug,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  setOrgAlApiKey,
  clearOrgAlApiKey,
  testOrgAlApiKey,
} from "@/lib/actions/audiences";

type TestResult =
  | { kind: "ok"; segmentCount: number; usingOverride: boolean }
  | { kind: "error"; message: string };

export function ApiKeySettings({
  hasOverride,
  keyHint,
  inheritedFromPlatform,
}: {
  hasOverride: boolean;
  keyHint: string | null;
  inheritedFromPlatform: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [showing, setShowing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [savePending, startSave] = useTransition();
  const [clearPending, startClear] = useTransition();
  const [testPending, startTest] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTestResult(null);
    const raw = value;
    startSave(async () => {
      const result = await setOrgAlApiKey(raw);
      if (result.ok) {
        toast.success(`Saved. Last 4: ${result.keyHint}`);
        setValue("");
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  function handleClear() {
    setError(null);
    setTestResult(null);
    startClear(async () => {
      const result = await clearOrgAlApiKey();
      if (result.ok) {
        toast.success("Cleared. Falling back to the platform key.");
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  function handleTest() {
    setError(null);
    setTestResult(null);
    startTest(async () => {
      const result = await testOrgAlApiKey();
      if (result.ok) {
        setTestResult({
          kind: "ok",
          segmentCount: result.segmentCount,
          usingOverride: result.usingOverride,
        });
      } else {
        setTestResult({ kind: "error", message: result.error });
      }
    });
  }

  const status = resolveStatus({ hasOverride, keyHint, inheritedFromPlatform });

  return (
    <div className="space-y-5">
      {/* Status block */}
      <div
        className={`rounded-md border p-3 flex items-start gap-3 ${status.bgClass}`}
      >
        <span className="shrink-0 mt-0.5">{status.icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{status.title}</p>
          {status.detail ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {status.detail}
            </p>
          ) : null}
        </div>
      </div>

      {/* Save form */}
      <form onSubmit={handleSave} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="al-api-key" className="text-xs">
            {hasOverride ? "Replace AudienceLab key" : "AudienceLab API key"}
          </Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                id="al-api-key"
                name="al-api-key"
                type={showing ? "text" : "password"}
                placeholder="sk_..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={savePending || clearPending}
                className="font-mono pr-10 rounded-md"
              />
              <button
                type="button"
                onClick={() => setShowing((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showing ? "Hide key" : "Show key"}
                tabIndex={-1}
              >
                {showing ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              type="submit"
              size="sm"
              className="rounded-md"
              disabled={savePending || !value.trim()}
            >
              <Save />
              {savePending ? "Saving…" : "Save key"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Stored encrypted at rest. Only the last four characters are ever
            shown back to you.
          </p>
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-md"
          onClick={handleTest}
          disabled={testPending}
        >
          <Plug className={testPending ? "animate-pulse" : ""} />
          {testPending ? "Testing…" : "Test connection"}
        </Button>
        {hasOverride ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-md text-destructive hover:text-destructive"
            onClick={handleClear}
            disabled={clearPending}
          >
            <Trash2 />
            {clearPending ? "Clearing…" : "Clear key"}
          </Button>
        ) : null}
      </div>

      {/* Test result */}
      {testResult ? (
        <div
          className={`rounded-md border p-3 flex items-start gap-3 ${
            testResult.kind === "ok"
              ? "border-emerald-200 bg-emerald-50/40"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <span className="shrink-0 mt-0.5">
            {testResult.kind === "ok" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </span>
          <div className="text-xs text-foreground">
            {testResult.kind === "ok" ? (
              <>
                <p className="font-medium">
                  Connected. AL returned {testResult.segmentCount} segment
                  {testResult.segmentCount === 1 ? "" : "s"}.
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Used the {testResult.usingOverride
                    ? "org override"
                    : "platform default"}{" "}
                  key.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-destructive">
                  Connection failed: {testResult.message}
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function resolveStatus({
  hasOverride,
  keyHint,
  inheritedFromPlatform,
}: {
  hasOverride: boolean;
  keyHint: string | null;
  inheritedFromPlatform: boolean;
}): {
  title: string;
  detail?: string;
  icon: React.ReactNode;
  bgClass: string;
} {
  if (hasOverride) {
    return {
      title: `Using your AL key (last 4: ${keyHint ?? "----"})`,
      detail: "Segments and pushes for this org use this key.",
      icon: <KeyRound className="h-4 w-4 text-emerald-600" />,
      bgClass: "border-emerald-200 bg-emerald-50/40",
    };
  }
  if (inheritedFromPlatform) {
    return {
      title: "Using the platform AudienceLab key",
      detail:
        "Save a key below to override the shared platform key for this org.",
      icon: <ShieldCheck className="h-4 w-4 text-muted-foreground" />,
      bgClass: "border-border bg-muted/30",
    };
  }
  return {
    title: "No AL key configured — segments cannot be loaded",
    detail:
      "Save an AudienceLab key below, or ask the platform admin to set CURSIVE_API_KEY.",
    icon: <AlertCircle className="h-4 w-4 text-destructive" />,
    bgClass: "border-destructive/30 bg-destructive/5",
  };
}
