import type { ScraperJob } from "../lib/ScraperJob";
import { type Deputy, getDeputies } from "../lib/scrapers/deputies";

export const DEPUTIES_CACHE_PATH = "./data/2024/deputies.json";
export const DEPUTIES_VERSION = "0.0.2";

const job: ScraperJob<Deputy[], never> = {
  name: "Deputy List",
  version: DEPUTIES_VERSION,
  isAtomic: true,
  outputPath: DEPUTIES_CACHE_PATH,
  fetchAll: getDeputies,
};

export default job;
