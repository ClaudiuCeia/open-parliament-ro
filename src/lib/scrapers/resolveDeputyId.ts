import Fuse from "fuse.js";
import { logger } from "../log";
import { getDeputyIds, type MinimalDeputy } from "./deputies";

let cache: {
  deputies: MinimalDeputy[];
  fuse: Fuse<MinimalDeputy>;
} | null = null;

/**
 * Deputy names are incosistent, mixing casing as well as ordering (e.g. "Ion Popescu" vs "Popescu Ion").
 * This function normalizes names for use in fuzzy search.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().split(/\s+/).sort().join(" ");
}

export async function resolveDeputyId(rawName: string): Promise<string | null> {
  const log = logger.child({
    module: "scraper",
    job: "resolveDeputyId",
  });

  if (!cache) {
    const deputiesCache = await getDeputyIds();
    const fuseCache = new Fuse(
      deputiesCache.map((d) => ({
        ...d,
        normalizedName: normalizeName(d.name),
      })),
      {
        keys: ["normalizedName"],
        threshold: 0.3,
        includeScore: true,
      },
    );

    cache = {
      deputies: deputiesCache,
      fuse: fuseCache,
    };
  }

  const results = cache.fuse.search(normalizeName(rawName));
  if (results.length === 0) {
    log.warn(`No match for "${rawName}"`);
    return null;
  }

  const best = results[0];
  if (!best) {
    log.warn(`No best match found for "${rawName}"`);
    return null;
  }

  log.debug(
    `Matched "${rawName}" to "${best.item.name}" (idm ${best.item.idm}) [score: ${best.score}]`,
  );

  return best.item.idm;
}
