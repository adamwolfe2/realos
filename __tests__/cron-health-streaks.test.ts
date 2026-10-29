import { describe, it, expect } from "vitest";
import { findFailingCrons, splitChronic, type CronRunRow } from "../lib/health/cron-streaks";

const NOW = new Date("2026-09-26T14:07:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const run = (jobName: string, min: number, status: string): CronRunRow => ({
  jobName,
  startedAt: ago(min),
  status,
});

describe("findFailingCrons", () => {
  it("reports a job whose failing streak is over an hour old", () => {
    const runs = [run("seo-sync", 200, "ok")];
    for (let m = 65; m >= 0; m -= 5) runs.push(run("seo-sync", m, "partial"));
    expect(findFailingCrons(runs, NOW)).toMatchObject([{ jobName: "seo-sync", status: "partial", badRuns: 14 }]);
  });

  it("ignores a streak younger than an hour", () => {
    expect(findFailingCrons([run("a", 120, "ok"), run("a", 30, "partial")], NOW)).toEqual([]);
  });

  it("ignores a job whose latest run recovered", () => {
    expect(findFailingCrons([run("a", 200, "ok"), run("a", 90, "partial"), run("a", 5, "ok")], NOW)).toEqual([]);
  });

  it("ignores in-flight running rows and treats stale running as timeout", () => {
    const runs = [run("a", 200, "ok"), run("a", 70, "error"), run("a", 30, "running"), run("a", 0, "running")];
    expect(findFailingCrons(runs, NOW)).toMatchObject([{ jobName: "a", status: "timeout", badRuns: 2 }]);
  });
});

describe("splitChronic", () => {
  it("keeps jobs with a clean run this week, drops ones broken all week", () => {
    const failing = findFailingCrons(
      [run("flaky", 120, "error"), run("broken", 120, "error")],
      NOW,
    );
    const { fresh, chronic } = splitChronic(failing, new Set(["flaky"]));
    expect(fresh.map((s) => s.jobName)).toEqual(["flaky"]);
    expect(chronic.map((s) => s.jobName)).toEqual(["broken"]);
  });
});
