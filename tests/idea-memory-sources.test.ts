import { describe, expect, it, vi } from "vitest";
import {
  checkMemorySource,
  refreshMemorySources,
  validMemorySource,
} from "@/features/idea-memory/sources";
import type { IdeaSource, IdeaSourceCheck } from "@/features/idea-memory/types";

const now = new Date("2026-11-16T18:00:00.000Z");
const page: IdeaSource = {
  url: "https://langfuse.com/pricing",
  kind: "competitor",
};
const issue: IdeaSource = {
  url: "https://github.com/n8n-io/n8n/issues/43273",
  kind: "issue",
};
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
const payload = (extra: Record<string, unknown> = {}) => ({
  number: 43273,
  html_url: issue.url,
  state: "closed",
  state_reason: "completed",
  title: "Fixed token usage",
  body: "Original issue. Fix: https://github.com/n8n-io/n8n/pull/43796",
  updated_at: "2026-11-16T12:00:00Z",
  created_at: "2026-11-10T12:00:00Z",
  ...extra,
});
const previous = (
  source: IdeaSource,
  at: string,
  extra: Partial<IdeaSourceCheck> = {},
): IdeaSourceCheck => ({
  id: `old-${at}`,
  ...source,
  checkedAt: at,
  status: "ok",
  contentHash: "old",
  message: "old success",
  ...extra,
});

describe("bounded public sources for idea memory", () => {
  it("rejects arbitrary hosts, credentials, ports, queries and fake GitHub identities before fetching", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const urls = [
      "http://langfuse.com/pricing",
      "https://langfuse.com.evil.example/pricing",
      "https://user:secret@langfuse.com/pricing",
      "https://langfuse.com:8443/pricing",
      "https://127.0.0.1/",
      "https://langfuse.com/pricing?token=private",
      "https://github.com/unknown/private/issues/1",
      "https://github.com/n8n-io/n8n/pull/1",
      "https://github.com/n8n-io/n8n/issues/1?access_token=secret",
      "https://play.google.com/store/apps/details?id=com.unknown.app",
      "https://play.google.com/store/apps/details?id=mx.zenfi.app&token=secret",
    ];
    for (const url of urls) {
      const source: IdeaSource = {
        url,
        kind: url.includes("github.com") ? "issue" : "competitor",
      };
      expect(validMemorySource(source)).toBe(false);
      expect((await checkMemorySource(source, now, fetcher)).status).toBe(
        "error",
      );
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      validMemorySource({
        url: "https://play.google.com/store/apps/details?hl=es&id=mx.zenfi.app",
        kind: "competitor",
      }),
    ).toBe(true);
    expect(validMemorySource({ url: issue.url, kind: "competitor" })).toBe(
      false,
    );
  });

  it("keeps issue reason, reopening and source time without declaring deployed fixes", async () => {
    for (const [state, reason] of [
      ["closed", "completed"],
      ["closed", "not_planned"],
      ["open", "reopened"],
    ] as const) {
      const fetcher = vi.fn<typeof fetch>(async () =>
        json(payload({ state, state_reason: reason })),
      );
      const check = await checkMemorySource(issue, now, fetcher);
      expect(check).toMatchObject({
        status: "ok",
        issueState: state,
        stateReason: reason,
        sourceUpdatedAt: "2026-11-16T12:00:00.000Z",
      });
      expect(check.references).toContain(
        "https://github.com/n8n-io/n8n/pull/43796",
      );
      expect(check.message).not.toMatch(
        /deployed|desplegado|instalaciones.*corregidas/i,
      );
      expect(fetcher.mock.calls[0][0]).toBe(
        "https://api.github.com/repos/n8n-io/n8n/issues/43273",
      );
      const init = fetcher.mock.calls[0][1]!;
      expect(init.redirect).toBe("error");
      expect(init.credentials).toBe("omit");
      expect(JSON.stringify(init.headers)).not.toMatch(/authorization|secret/i);
    }
  });

  it("rejects future/invalid issue dates, identity mismatches and redirected responses", async () => {
    for (const change of [
      { updated_at: "2026-11-17T12:00:00Z" },
      { updated_at: "2026-02-30T12:00:00Z" },
      { html_url: "https://github.com/n8n-io/n8n/issues/1" },
      { number: 9 },
      { created_at: "2026-11-16T16:00:00Z" },
    ]) {
      expect(
        (await checkMemorySource(issue, now, async () => json(payload(change))))
          .status,
      ).toBe("error");
    }
    expect(
      (
        await checkMemorySource(
          page,
          now,
          async () =>
            new Response("", {
              status: 302,
              headers: { location: "https://evil.example" },
            }),
        )
      ).status,
    ).toBe("error");
    const redirected = new Response("<p>Redirected</p>");
    Object.defineProperty(redirected, "redirected", { value: true });
    expect(
      (await checkMemorySource(page, now, async () => redirected)).status,
    ).toBe("error");
  });

  it("hashes visible content excluding executable and navigation noise; change is not verified new functionality", async () => {
    const first = await checkMemorySource(
      page,
      now,
      async () =>
        new Response(
          "<html><nav>Track 1</nav><script>secret()</script><style>x{}</style><main><h1>Cost tracking</h1><p>Free tier</p></main></html>",
          { headers: { "content-type": "text/html" } },
        ),
    );
    const second = await checkMemorySource(
      page,
      now,
      async () =>
        new Response(
          "<html><nav>Track 2</nav><script>different()</script><main><h1>Cost tracking</h1><p>Free tier</p></main></html>",
        ),
    );
    const changed = await checkMemorySource(
      page,
      now,
      async () => new Response("<main>Cost tracking. New text.</main>"),
    );
    expect(first.status).toBe("ok");
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.excerpt).not.toMatch(/secret|Track|different/);
    expect(changed.contentHash).not.toBe(first.contentHash);
    expect(changed.message).toMatch(/no.*(?:confirma|verifica)|revisi[oó]n/i);
  });

  it("enforces byte limits by header and decoded stream and bounds excerpts", async () => {
    for (const response of [
      new Response("<p>Small</p>", { headers: { "content-length": "999999" } }),
      new Response("x".repeat(262145)),
      new Response("🙂".repeat(70000)),
    ]) {
      expect(
        (await checkMemorySource(page, now, async () => response)).status,
      ).toBe("error");
    }
    const check = await checkMemorySource(issue, now, async () =>
      json(payload({ body: "content ".repeat(6000) })),
    );
    expect(check.status).toBe("ok");
    expect(check.excerpt!.length).toBeLessThanOrEqual(1600);
  });

  it("honors rate limiting with bounded retry times and never loses previous successful checks", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response("", {
          status: 429,
          headers: { "retry-after": "999999999" },
        }),
    );
    const check = await checkMemorySource(page, now, fetcher);
    expect(check.status).toBe("rate-limited");
    expect(Date.parse(check.retryAt!) - now.getTime()).toBe(7 * 86400000);
    const old = previous(page, "2026-11-14T18:00:00Z");
    const history = [old, check];
    const frozen = JSON.stringify(history);
    expect(
      await refreshMemorySources(
        [page],
        history,
        new Date(now.getTime() + 86400000),
        async () => {},
        fetcher,
      ),
    ).toEqual([]);
    expect(JSON.stringify(history)).toBe(frozen);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("applies six-hour issue/daily-page cooldowns and retries errors without hot loops", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).includes("api.github")
        ? json(payload())
        : new Response("<main>Price</main>"),
    );
    const old = [
      previous(page, "2026-11-16T01:00:00Z"),
      previous(issue, "2026-11-16T13:00:00Z"),
    ];
    expect(
      await refreshMemorySources(
        [page, issue],
        old,
        now,
        async () => {},
        fetcher,
      ),
    ).toEqual([]);
    const next = await refreshMemorySources(
      [page, issue],
      old,
      new Date("2026-11-16T20:00:00Z"),
      async () => {},
      fetcher,
    );
    expect(next).toHaveLength(1);
    expect(next[0].kind).toBe("issue");
    const failure = previous(page, now.toISOString(), { status: "error" });
    expect(
      await refreshMemorySources(
        [page],
        [failure],
        new Date(now.getTime() + 60000),
        async () => {},
        fetcher,
      ),
    ).toEqual([]);
  });

  it("deduplicates canonical URLs and bounds queries/concurrency while sharing the budget", async () => {
    let active = 0,
      maximum = 0;
    const fetcher = vi.fn<typeof fetch>(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      return new Response("<main>Page</main>");
    });
    const sources: IdeaSource[] = Array.from({ length: 10 }, (_, i) => ({
      url: `https://langfuse.com/docs/source-${i}`,
      kind: "competitor",
    }));
    const guard = vi.fn(async () => {});
    const prior = [
      previous(sources[0], "2026-11-01T00:00:00Z"),
      previous(sources[1], "2026-11-02T00:00:00Z"),
    ];
    const checks = await refreshMemorySources(
      [...sources, sources[2]],
      prior,
      now,
      guard,
      fetcher,
    );
    expect(checks).toHaveLength(6);
    expect(new Set(checks.map((check) => check.url)).size).toBe(6);
    expect(checks.some((check) => check.url === sources[0].url)).toBe(true);
    expect(checks.some((check) => check.url === sources[1].url)).toBe(true);
    expect(maximum).toBeLessThanOrEqual(2);
    expect(guard).toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it("reserves three calls for overdue known sources despite a fresh backlog in each edition", async () => {
    const known: IdeaSource[] = Array.from({ length: 3 }, (_, i) => ({
      url: `https://langfuse.com/a-established-${i}`,
      kind: "competitor",
    }));
    const incoming: IdeaSource[] = Array.from({ length: 12 }, (_, i) => ({
      url: `https://langfuse.com/docs/new-${i}`,
      kind: "competitor",
    }));
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("<main>Page</main>"),
    );
    const firstSources = [...known, ...incoming.slice(0, 6)];
    const original = known.map((source) =>
      previous(source, "2026-11-01T00:00:00Z"),
    );
    const first = await refreshMemorySources(
      firstSources,
      original,
      now,
      async () => {},
      fetcher,
    );
    expect(first).toHaveLength(6);
    expect(
      known.every((source) => first.some((check) => check.url === source.url)),
    ).toBe(true);
    expect(
      first.filter((check) =>
        incoming.some((source) => source.url === check.url),
      ),
    ).toHaveLength(3);
    const second = await refreshMemorySources(
      [...known, ...incoming],
      [...original, ...first],
      new Date(now.getTime() + 86400000 + 1000),
      async () => {},
      fetcher,
    );
    expect(second).toHaveLength(6);
    expect(
      known.every((source) => second.some((check) => check.url === source.url)),
    ).toBe(true);
    expect(
      second.filter((check) => !first.some((old) => old.url === check.url)),
    ).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(12);
  });

  it("borrows unused pending or overdue slots without exceeding six calls", async () => {
    const known: IdeaSource[] = Array.from({ length: 8 }, (_, i) => ({
      url: `https://langfuse.com/docs/known-${i}`,
      kind: "competitor",
    }));
    const unseen: IdeaSource = {
      url: "https://langfuse.com/docs/unseen",
      kind: "competitor",
    };
    const old = known.map((source) => previous(source, "2026-11-01T00:00:00Z"));
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("<main>Page</main>"),
    );
    const mostlyOld = await refreshMemorySources(
      [...known, unseen],
      old,
      now,
      async () => {},
      fetcher,
    );
    expect(mostlyOld).toHaveLength(6);
    expect(mostlyOld.some((check) => check.url === unseen.url)).toBe(true);
    expect(
      mostlyOld.filter((check) =>
        known.some((source) => source.url === check.url),
      ),
    ).toHaveLength(5);
    expect(
      await refreshMemorySources(known, old, now, async () => {}, fetcher),
    ).toHaveLength(6);
    expect(
      await refreshMemorySources(known, [], now, async () => {}, fetcher),
    ).toHaveLength(6);
  });
});
