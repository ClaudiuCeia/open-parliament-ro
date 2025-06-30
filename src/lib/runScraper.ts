import { isCacheValid, readCache, writeCache } from "./cache";
import { logger } from "./log";
import type { ScraperJob } from "./ScraperJob";

export async function runScraper<T, ID>(
  job: ScraperJob<T, ID>,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
) {
  const log = logger.child({ module: "runner", job: job.name });
  log.info(`Starting scraper: ${job.name}`);

  if (job.isAtomic) {
    // Single atomic
    const existing = await readCache(job.outputPath);
    if (isCacheValid(existing, job.version, maxAgeMs)) {
      log.debug(`Cache valid. Skipping.`);
      log.info(`Completed scraper: ${job.name} (cached)`);
      return;
    }

    const data = await job.fetchAll();
    await writeCache(job.outputPath, {
      version: job.version,
      lastUpdated: new Date().toISOString(),
      data,
    });
    log.info(`Wrote atomic data to ${job.outputPath}`);
    log.info(`Completed scraper: ${job.name}`);
  } else {
    const ids = await job.listItems();
    let processed = 0;
    let skipped = 0;
    const total = ids.length;

    log.info(`Processing ${total} items...`);

    const logProgress = (index: number) => {
      // Show progress for every item
      const progressInterval = 1;

      if ((index + 1) % progressInterval === 0 || index === ids.length - 1) {
        log.info(
          `Progress: ${index + 1}/${total} (${Math.round(((index + 1) / total) * 100)}%) - processed: ${processed}, cached: ${skipped}`,
        );
      }
    };

    for (const [index, id] of ids.entries()) {
      const path = job.getPath(id);
      const existing = await readCache<T>(path);

      if (existing && isCacheValid(existing, job.version, maxAgeMs)) {
        if (!job.isItemStale || !job.isItemStale(existing)) {
          log.debug(`Cache valid for ${path}`);
          skipped++;
          logProgress(index);
          continue;
        }
      }

      log.debug(`Fetching item for ${JSON.stringify(id)}...`);
      const item = await job.fetchItem(id);
      await writeCache(path, {
        version: job.version,
        lastUpdated: new Date().toISOString(),
        data: item,
      });
      processed++;
      logProgress(index);
    }

    log.info(
      `Completed scraper: ${job.name} (processed: ${processed}, cached: ${skipped})`,
    );
  }
}
