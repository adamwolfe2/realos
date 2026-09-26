import { describe, it, expect } from "vitest";
import { findNewlyStuckCrons, type CronRunRow } from "../lib/health/cron-streaks";

const NOW = new Date("2026-09-26T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const run = (jobName: string, min: number, status: string): CronRunRow => ({
  jobName,
  startedAt: ago(min),
  status,
});

describe("findNewlyStuckCrons", () => {
  it("alerts once a 5-min job has been partial for just over an hour", () => {
    const runs = [run("pixel", 200, "ok")];
    for (let m = 65; m >= 0; m -= 5) runs.push(run("pixel", m, "partial"));
    const out = findNewlyStuckCrons(runs, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ jobName: "pixel", status: "partial", badRuns: 14 });
  });

  it("stays quiet before the hour is up and after the first alert window", () => {
    const young = [run("a", 120, "ok"), run("a", 30, "partial"), run("a", 0, "partial")];
    const old = [run("b", 300, "ok"), run("b", 150, "partial"), run("b", 0, "partial")];
    expect(findNewlyStuckCrons([...young, ...old], NOW)).toEqual([]);
  });

  it("stays quiet when the latest run recovered", () => {
    const runs = [run("a", 200, "ok"), run("a", 90, "partial"), run("a", 5, "ok")];
    expect(findNewlyStuckCrons(runs, NOW)).toEqual([]);
  });

  it("ignores running rows and treats error/timeout as failing", () => {
    const runs = [run("a", 200, "ok"), run("a", 70, "error"), run("a", 10, "timeout"), run("a", 0, "running")];
    expect(findNewlyStuckCrons(runs, NOW)).toMatchObject([{ jobName: "a", status: "timeout", badRuns: 2 }]);
  });

  it("does not re-alert a streak that reaches the lookback edge", () => {
    const runs = [run("daily", 1440, "partial"), run("daily", 90, "partial")];
    expect(findNewlyStuckCrons(runs, NOW)).toEqual([]);
  });
});
