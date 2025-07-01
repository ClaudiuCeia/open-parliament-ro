import type { ScraperJob } from "../lib/ScraperJob";
import { getMotions, type Motion } from "../lib/scrapers/motions";

export const DEPUTY_MOTIONS_CACHE_PATH =
  "./data/2024/motions/deputy_motions.json";
export const DEPUTY_MOTIONS_VERSION = "0.0.1";

const job: ScraperJob<Motion[], never> = {
  version: DEPUTY_MOTIONS_VERSION,
  isAtomic: true,
  outputPath: DEPUTY_MOTIONS_CACHE_PATH,
  fetchAll: getMotions,
  datapackage: {
    name: "deputy-motions",
    title: "Deputy Motions",
    description:
      "Simple motions submitted by deputies during parliamentary sessions",
  },
};

export default job;
