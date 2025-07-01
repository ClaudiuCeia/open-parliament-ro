import * as cheerio from "cheerio";
import { TextDecoder } from "text-decoding";
import { logger } from "../log";

const MAX_CACHE_SIZE = 100;
const Cache: Record<
  string,
  { html: string; $: cheerio.CheerioAPI; lastUsed: number }
> = {};
const cacheKeys: string[] = [];

const cleanupCache = () => {
  if (cacheKeys.length >= MAX_CACHE_SIZE) {
    const keysToRemove = cacheKeys.splice(
      0,
      cacheKeys.length - MAX_CACHE_SIZE + 10,
    );
    for (const key of keysToRemove) {
      delete Cache[key];
    }
  }
};

const addToCache = (
  url: string,
  result: { html: string; $: cheerio.CheerioAPI },
) => {
  cleanupCache();

  Cache[url] = { ...result, lastUsed: Date.now() };

  const existingIndex = cacheKeys.indexOf(url);
  if (existingIndex !== -1) {
    cacheKeys.splice(existingIndex, 1);
  }
  cacheKeys.push(url);
};

export const $fetch = async (
  url: string,
  retries = 3,
  delay = 50,
  timeout = 30000,
): Promise<{ html: string; $: cheerio.CheerioAPI }> => {
  const log = logger.child({ module: "$fetch" });

  if (Cache[url]) {
    log.debug(`Cache HIT ${url}`);
    Cache[url].lastUsed = Date.now(); // Update last used time
    return { html: Cache[url].html, $: Cache[url].$ };
  } else {
    log.debug(`Cache MISS ${url}`);
  }

  for (let i = 0; i <= retries; i++) {
    try {
      log.debug(`GET ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Open Parliament Romania Bot (github.com/ClaudiuCeia/open-parliament-ro)",
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const buffer = await res.arrayBuffer();
      const html = new TextDecoder("ISO-8859-2").decode(buffer);
      const $ = cheerio.load(html);
      const result = { html, $ };

      addToCache(url, result);
      return result;
    } catch (err) {
      const jitter = Math.random() * 100;
      const wait = delay * 2 ** i + jitter;

      if (err instanceof Error && err.name === "AbortError") {
        log.warn(
          `[retry:${i}] Timeout after ${timeout}ms for ${url}. Waiting ${wait.toFixed(0)}ms…`,
        );
      } else {
        log.debug(`[retry:${i}] ${err}. Waiting ${wait.toFixed(0)}ms…`);
      }

      if (i === retries) {
        throw new Error(
          `Failed after ${retries} retries: ${url} (last error: ${err})`,
        );
      }

      await new Promise((r) => setTimeout(r, wait));
    }
  }

  throw new Error(`Unreachable retry loop: ${url}`);
};
