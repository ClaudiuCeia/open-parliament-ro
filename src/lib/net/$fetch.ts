import * as cheerio from "cheerio";
import { TextDecoder } from "text-decoding";
import { logger } from "../log";

const Cache: Record<string, { html: string; $: cheerio.CheerioAPI }> = {};

export const $fetch = async (
  url: string,
  retries = 3,
  delay = 50,
): Promise<{ html: string; $: cheerio.CheerioAPI }> => {
  const log = logger.child({ module: "$fetch" });

  if (Cache[url]) {
    log.debug(`Cache HIT ${url}`);
    return Cache[url];
  } else {
    log.debug(`Cache MISS ${url}`);
  }

  for (let i = 0; i <= retries; i++) {
    try {
      log.debug(`GET ${url}`);
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const buffer = await res.arrayBuffer();
      const html = new TextDecoder("ISO-8859-2").decode(buffer);
      const $ = cheerio.load(html);
      const result = { html, $ };

      Cache[url] = result;
      return result;
    } catch (err) {
      const jitter = Math.random() * 500;
      const wait = delay * 2 ** i + jitter;
      log.debug(`[retry:${i}] ${err}. Waiting ${wait.toFixed(0)}ms…`);

      if (i === retries) {
        throw new Error(`Failed after ${retries} retries: ${url}`);
      }

      await new Promise((r) => setTimeout(r, wait));
    }
  }

  throw new Error(`Unreachable retry loop: ${url}`);
};
