import { useEffect, useState } from "react";

const CACHE_KEY = "repruvia.github-stars";
const TTL_MS = 60 * 60 * 1000; // 1h — keeps us well under GitHub's 60 req/hr limit

interface Cached {
  count: number;
  at: number;
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

/**
 * Live GitHub star count for `owner/repo`, fetched from the public (CORS-enabled)
 * REST API and cached in localStorage for an hour. Returns `null` until known /
 * on failure, so the UI can simply hide the count.
 */
export function useGithubStars(repo: string): number | null {
  const [stars, setStars] = useState<number | null>(() => readCache()?.count ?? null);

  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.at < TTL_MS) return; // fresh enough

    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${repo}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { stargazers_count?: number }) => {
        if (typeof data.stargazers_count !== "number") return;
        setStars(data.stargazers_count);
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ count: data.stargazers_count, at: Date.now() }),
          );
        } catch {
          // ignore quota / private mode
        }
      })
      .catch(() => {
        // rate-limited / offline — keep any cached value, hide otherwise
      });

    return () => controller.abort();
  }, [repo]);

  return stars;
}

/** Compact count, e.g. 1234 → "1.2k". */
export function formatStarCount(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}
