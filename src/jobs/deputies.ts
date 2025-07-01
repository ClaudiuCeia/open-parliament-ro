import type { ScraperJob } from "../lib/ScraperJob";
import { type Deputy, getDeputies } from "../lib/scrapers/deputies";

export const DEPUTIES_CACHE_PATH = "./data/2024/deputies.json";
export const DEPUTIES_VERSION = "0.0.2";

const job: ScraperJob<Deputy[], never> = {
  isAtomic: true,
  version: DEPUTIES_VERSION,
  outputPath: DEPUTIES_CACHE_PATH,
  fetchAll: getDeputies,
  datapackage: {
    name: "deputies",
    title: "Deputy List",
    description:
      "Complete list of deputies in the Romanian Chamber of Deputies with basic information including names, constituencies, and party affiliations",
  },
};

export default job;
