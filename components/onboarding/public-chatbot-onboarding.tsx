"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  Globe,
  Mail,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type StepId = "property" | "answers" | "preview";

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "property", label: "Property" },
  { id: "answers", label: "Answers" },
  { id: "preview", label: "Preview" },
];

export function PublicChatbotOnboarding() {
  const [step, setStep] = React.useState<StepId>("property");
  const [propertyName, setPropertyName] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [primaryGoal, setPrimaryGoal] = React.useState("Capture leads and invite tours");
  const [keyFacts, setKeyFacts] = React.useState(
    "Private rooms, fall availability, furnished units, tour scheduling, application next steps",
  );

  const activeIndex = STEPS.findIndex((item) => item.id === step);
  const displayName = propertyName.trim() || "your property";
  const signupHref = buildSignupHref(email);

  React.useEffect(() => {
    const payload = {
      propertyName,
      websiteUrl,
      email,
      primaryGoal,
      keyFacts,
    };
    window.localStorage.setItem(
      "leasestack:public-chatbot-onboarding",
      JSON.stringify(payload),
    );
  }, [email, keyFacts, primaryGoal, propertyName, websiteUrl]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex h-12 items-center justify-between">
          <Link href="/" className="text-[15px] font-semibold tracking-[-0.01em]">
            {BRAND_NAME}
          </Link>
          <Link
            href="/sign-in"
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(420px,1.04fr)] lg:py-10">
          <div className="mx-auto w-full max-w-[560px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Chatbot setup preview
            </p>
            <h1 className="mt-3 text-[38px] font-semibold leading-[1.02] tracking-[-0.02em] text-foreground sm:text-[48px]">
              Configure the chatbot before creating an account.
            </h1>
            <p className="mt-4 max-w-[500px] text-[15px] leading-6 text-muted-foreground">
              Try the setup flow, preview the leasing assistant, and create an account only when you are ready to save it.
            </p>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
              {[
                ["No card", "Start without billing"],
                ["Human-reviewed", "Nothing auto-sends"],
                ["Install later", "Copy the snippet after signup"],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-[2px] border border-border bg-card p-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-[12px] font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[620px]">
            <div className="rounded-[2px] border border-border bg-card shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
              <div className="border-b border-border px-4 py-4 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-[2px] bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">AI leasing chatbot</p>
                      <p className="text-[11px] text-muted-foreground">Draft setup, no account required</p>
                    </div>
                  </div>
                  <span className="hidden rounded-[2px] border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:inline-flex">
                    Step {activeIndex + 1} of {STEPS.length}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {STEPS.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <button
                        type="button"
                        onClick={() => setStep(item.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-[2px] px-2 py-1 text-[11px] font-semibold",
                          index <= activeIndex
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {index + 1}
                        <span className="hidden sm:inline">{item.label}</span>
                      </button>
                      {index < STEPS.length - 1 ? (
                        <span className="h-px flex-1 bg-border" />
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {step === "property" ? (
                  <div className="space-y-4">
                    <Field
                      icon={<Building2 className="h-4 w-4" />}
                      label="Property name"
                      value={propertyName}
                      onChange={setPropertyName}
                      placeholder="Telegraph Commons"
                    />
                    <Field
                      icon={<Globe className="h-4 w-4" />}
                      label="Website"
                      value={websiteUrl}
                      onChange={setWebsiteUrl}
                      placeholder="https://yourproperty.com"
                    />
                    <Field
                      icon={<Mail className="h-4 w-4" />}
                      label="Work email"
                      value={email}
                      onChange={setEmail}
                      placeholder="you@company.com"
                    />
                    <NavButtons onNext={() => setStep("answers")} />
                  </div>
                ) : null}

                {step === "answers" ? (
                  <div className="space-y-4">
                    <Field
                      icon={<ClipboardList className="h-4 w-4" />}
                      label="Main chatbot job"
                      value={primaryGoal}
                      onChange={setPrimaryGoal}
                      placeholder="Capture leads and invite tours"
                    />
                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        Facts it should know
                      </span>
                      <textarea
                        value={keyFacts}
                        onChange={(event) => setKeyFacts(event.target.value)}
                        rows={5}
                        className="w-full resize-none rounded-[2px] border border-border bg-background px-3 py-2 text-[13px] leading-5 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                    <NavButtons
                      onBack={() => setStep("property")}
                      onNext={() => setStep("preview")}
                    />
                  </div>
                ) : null}

                {step === "preview" ? (
                  <div className="space-y-4">
                    <div className="rounded-[2px] border border-border bg-background">
                      <div className="border-b border-border px-3 py-2">
                        <p className="text-[12px] font-semibold text-foreground">
                          Preview for {displayName}
                        </p>
                      </div>
                      <div className="space-y-3 p-3">
                        <ChatBubble
                          role="assistant"
                          text={`Hi, I can help with ${displayName} availability, tours, and application next steps. What are you looking for?`}
                        />
                        <ChatBubble
                          role="visitor"
                          text="Do you have private rooms for fall?"
                        />
                        <ChatBubble
                          role="assistant"
                          text={`I can help with that. Based on what the team provided, I should ask about room type, move-in timing, and the best email or phone number so leasing can confirm current options.`}
                        />
                      </div>
                    </div>

                    <div className="rounded-[2px] border border-border bg-muted p-3">
                      <p className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Account needed only to save and install
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                        Your draft stays in this browser for now. Create an account when you are ready to continue into the saved workspace, install snippet, inbox, and learning loop.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setStep("answers")}
                        className="inline-flex h-11 items-center justify-center rounded-[2px] border border-border px-4 text-[13px] font-semibold text-foreground hover:bg-muted"
                      >
                        Back
                      </button>
                      <Link
                        href={signupHref}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[2px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Continue to account
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[2px] border border-border bg-background px-3 text-[13px] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function NavButtons({
  onBack,
  onNext,
}: {
  onBack?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center justify-center rounded-[2px] border border-border px-4 text-[13px] font-semibold text-foreground hover:bg-muted"
        >
          Back
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[2px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function ChatBubble({ role, text }: { role: "assistant" | "visitor"; text: string }) {
  const visitor = role === "visitor";
  return (
    <div className={cn("flex", visitor ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[86%] rounded-[2px] px-3 py-2 text-[12px] leading-5",
          visitor
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-foreground",
        )}
      >
        <span className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] opacity-70">
          {visitor ? <Send className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
          {visitor ? "Visitor" : "Assistant"}
        </span>
        {text}
      </div>
    </div>
  );
}

function buildSignupHref(email: string): string {
  const params = new URLSearchParams();
  params.set("redirect_url", "/onboarding");
  const trimmed = email.trim();
  if (trimmed && /.+@.+\..+/.test(trimmed)) params.set("email", trimmed);
  return `/sign-up?${params.toString()}`;
}
