import type {
  CapabilityBlocker,
  CapabilityBlockerCode,
  CapabilityCheck,
  CapabilityCheckStatus,
  CapabilityContract,
  CapabilityEvidence,
  CapabilityProfile,
  CapabilityProfileStatus,
  CapabilityRequirement,
  CapabilitySignal,
  CapabilitySubject,
  VerifiedCapabilityEvidence,
} from "@/lib/products/capabilities/types";

export class CapabilityScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityScopeError";
  }
}

type RequirementResult = Readonly<{
  check: CapabilityCheck;
  blockerCode: CapabilityBlockerCode | null;
  verifiedEvidence: VerifiedCapabilityEvidence | null;
}>;

type SignalResult = Readonly<{
  status: CapabilityCheckStatus;
  blockerCode: CapabilityBlockerCode | null;
  evidence: readonly CapabilityEvidence[];
}>;

const STATUS_PRIORITY: readonly CapabilityCheckStatus[] = [
  "needs_attention",
  "backfilling",
  "verifying",
  "partial",
  "disconnected",
  "passed",
];

export function evaluateCapabilityProfile(
  contract: CapabilityContract,
  subject: CapabilitySubject,
  signals: readonly CapabilitySignal[],
  now: Date,
): CapabilityProfile {
  assertContractAcceptsSubject(contract, subject);
  assertSignalsInScope(subject, signals);

  const results = contract.requirements.map((requirement) =>
    evaluateRequirement(requirement, subject, signals, now),
  );
  const checks = results.map(({ check }) => check);

  return Object.freeze({
    productKey: contract.productKey,
    subject,
    status: deriveCapabilityStatus(checks),
    checks: Object.freeze(checks),
    evidence: Object.freeze(
      results.flatMap(({ verifiedEvidence }) =>
        verifiedEvidence ? [verifiedEvidence] : [],
      ),
    ),
    blockers: Object.freeze(deriveCapabilityBlockers(contract, results)),
    evaluatedAt: new Date(now.getTime()),
  });
}

export function assertSignalsInScope(
  subject: CapabilitySubject,
  signals: readonly CapabilitySignal[],
): void {
  for (const signal of signals) {
    if (signal.subject.orgId !== subject.orgId) {
      throw new CapabilityScopeError(
        "Capability signal belongs to a foreign organization.",
      );
    }
    if (subject.scope === "organization" && signal.subject.scope === "property") {
      throw new CapabilityScopeError(
        "Property evidence requires an exact-property evaluation.",
      );
    }
    if (
      subject.scope === "property" &&
      signal.subject.scope === "property" &&
      signal.subject.propertyId !== subject.propertyId
    ) {
      throw new CapabilityScopeError(
        "Capability signal belongs to a sibling property.",
      );
    }
  }
}

export function evaluateRequirement(
  requirement: CapabilityRequirement,
  subject: CapabilitySubject,
  signals: readonly CapabilitySignal[],
  now: Date,
): RequirementResult {
  const candidates = signals
    .filter((signal) => requirement.signalKeys.includes(signal.key))
    .filter((signal) => scopeAccepted(requirement, subject, signal.subject))
    .sort((a, b) => a.key.localeCompare(b.key));
  const byKey = requirement.signalKeys.map((key) => ({
    key,
    result: bestSignalResult(
      candidates.filter((signal) => signal.key === key),
      requirement,
      now,
    ),
  }));
  const selected = selectRequirementResult(requirement, byKey);
  const matchedSignalKeys = byKey
    .filter(({ result }) => result !== null)
    .map(({ key }) => key);

  return {
    check: Object.freeze({
      requirementKey: requirement.key,
      label: requirement.label,
      kind: requirement.kind,
      impact: requirement.impact,
      status: selected.status,
      matchedSignalKeys: Object.freeze(matchedSignalKeys),
    }),
    blockerCode: selected.blockerCode,
    verifiedEvidence:
      selected.status === "passed"
        ? buildVerifiedEvidence(requirement, selected.evidence)
        : null,
  };
}

export function deriveCapabilityStatus(
  checks: readonly CapabilityCheck[],
): CapabilityProfileStatus {
  const required = checks.filter(({ impact }) => impact === "required");
  if (required.some(({ status }) => status === "needs_attention" || status === "partial")) {
    return "needs_attention";
  }
  if (required.some(({ status }) => status === "backfilling")) {
    return "backfilling";
  }
  if (required.some(({ status }) => status === "verifying")) {
    return "verifying";
  }
  if (required.some(({ status }) => status === "disconnected")) {
    return "disconnected";
  }
  const degraded = checks.filter(({ impact }) => impact === "degraded");
  if (degraded.some(({ status }) => status !== "passed")) {
    return "partially_ready";
  }
  return "ready";
}

export function deriveCapabilityBlockers(
  contract: CapabilityContract,
  results: readonly RequirementResult[],
): CapabilityBlocker[] {
  const requirements = new Map(
    contract.requirements.map((requirement) => [requirement.key, requirement]),
  );
  const unique = new Map<string, CapabilityBlocker>();
  for (const result of results) {
    if (!result.blockerCode) continue;
    const requirement = requirements.get(result.check.requirementKey);
    if (!requirement) continue;
    const blocker: CapabilityBlocker = Object.freeze({
      code: result.blockerCode,
      requirementKey: requirement.key,
      severity: requirement.impact === "required" ? "blocking" : "degraded",
      summary: requirement.blockerSummary,
      actionHref: requirement.actionHref,
    });
    unique.set(`${blocker.code}:${blocker.requirementKey}`, blocker);
  }
  return [...unique.values()].sort(
    (a, b) =>
      a.requirementKey.localeCompare(b.requirementKey) ||
      a.code.localeCompare(b.code),
  );
}

function assertContractAcceptsSubject(
  contract: CapabilityContract,
  subject: CapabilitySubject,
): void {
  if (!contract.subjectScopes.includes(subject.scope)) {
    throw new CapabilityScopeError(
      "Capability contract does not accept this subject scope.",
    );
  }
}

function scopeAccepted(
  requirement: CapabilityRequirement,
  subject: CapabilitySubject,
  signalSubject: CapabilitySubject,
): boolean {
  if (requirement.acceptedScope === "organization") {
    return signalSubject.scope === "organization";
  }
  if (requirement.acceptedScope === "exact_property") {
    return (
      subject.scope === "property" &&
      signalSubject.scope === "property" &&
      signalSubject.propertyId === subject.propertyId
    );
  }
  return (
    signalSubject.scope === "organization" ||
    (subject.scope === "property" &&
      signalSubject.scope === "property" &&
      signalSubject.propertyId === subject.propertyId)
  );
}

function bestSignalResult(
  signals: readonly CapabilitySignal[],
  requirement: CapabilityRequirement,
  now: Date,
): SignalResult | null {
  if (signals.length === 0) return null;
  const evaluated = signals.map((signal) =>
    evaluateSignal(signal, requirement, now),
  );
  return [...evaluated].sort(
    (a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status),
  )[0];
}

function evaluateSignal(
  signal: CapabilitySignal,
  requirement: CapabilityRequirement,
  now: Date,
): SignalResult {
  if (signal.state === "ready") {
    const missingEvidence = requirement.requiredEvidence.some(
      (kind) => !signal.evidence.some((item) => item.kind === kind),
    );
    if (missingEvidence) {
      return result("disconnected", "missing_evidence", signal.evidence);
    }
    if (evidenceIsStale(requirement, signal.evidence, now)) {
      return result("needs_attention", "stale", signal.evidence);
    }
    return result("passed", null, signal.evidence);
  }
  if (signal.state === "error") {
    return result("needs_attention", "source_error", signal.evidence);
  }
  if (signal.state === "stale") {
    return result("needs_attention", "stale", signal.evidence);
  }
  if (signal.state === "backfilling") {
    return result("backfilling", "backfilling", signal.evidence);
  }
  if (signal.state === "verifying") {
    return result("verifying", "verifying", signal.evidence);
  }
  if (signal.state === "unsupported") {
    return result("partial", "unsupported", signal.evidence);
  }
  if (signal.state === "partial") {
    return result("partial", "partial", signal.evidence);
  }
  return result("disconnected", "disconnected", signal.evidence);
}

function result(
  status: CapabilityCheckStatus,
  blockerCode: CapabilityBlockerCode | null,
  evidence: readonly CapabilityEvidence[],
): SignalResult {
  return { status, blockerCode, evidence };
}

function selectRequirementResult(
  requirement: CapabilityRequirement,
  byKey: ReadonlyArray<{
    key: CapabilitySignal["key"];
    result: SignalResult | null;
  }>,
): SignalResult {
  const actual = byKey.flatMap(({ result: value }) => (value ? [value] : []));
  if (requirement.satisfaction === "any") {
    const passed = actual.find(({ status }) => status === "passed");
    if (passed) return passed;
    return highestPriority(actual);
  }
  if (byKey.some(({ result: value }) => value === null)) {
    const inProgressOrAttention = highestPriority(actual);
    return inProgressOrAttention.status === "passed"
      ? result("disconnected", "disconnected", [])
      : inProgressOrAttention;
  }
  const nonPassed = highestPriority(
    actual.filter(({ status }) => status !== "passed"),
  );
  if (nonPassed.status !== "disconnected" || actual.some(({ status }) => status !== "passed")) {
    return nonPassed;
  }
  return {
    status: "passed",
    blockerCode: null,
    evidence: actual.flatMap(({ evidence }) => evidence),
  };
}

function highestPriority(results: readonly SignalResult[]): SignalResult {
  if (results.length === 0) {
    return result("disconnected", "disconnected", []);
  }
  return [...results].sort(
    (a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status),
  )[0];
}

function evidenceIsStale(
  requirement: CapabilityRequirement,
  evidence: readonly CapabilityEvidence[],
  now: Date,
): boolean {
  if (requirement.maxEvidenceAgeMs == null) return false;
  return requirement.requiredEvidence.some((kind) => {
    const timestamps = evidence
      .filter((item) => item.kind === kind)
      .map((item) => item.observedAt.getTime());
    return (
      timestamps.length === 0 ||
      now.getTime() - Math.max(...timestamps) > requirement.maxEvidenceAgeMs!
    );
  });
}

function buildVerifiedEvidence(
  requirement: CapabilityRequirement,
  evidence: readonly CapabilityEvidence[],
): VerifiedCapabilityEvidence {
  const relevant = evidence.filter((item) =>
    requirement.requiredEvidence.includes(item.kind),
  );
  const latest = Math.max(...relevant.map((item) => item.observedAt.getTime()));
  return Object.freeze({
    requirementKey: requirement.key,
    summary: requirement.proofSummary,
    kinds: Object.freeze([...new Set(relevant.map(({ kind }) => kind))]),
    observedAt: new Date(latest),
  });
}
