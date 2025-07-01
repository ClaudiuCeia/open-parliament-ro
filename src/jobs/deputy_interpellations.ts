import { isStale } from "../lib/isStale";
import type { ScraperJob } from "../lib/ScraperJob";
import { getDeputyIds } from "../lib/scrapers/deputies";
import {
  getInterpellations,
  type Interpellation,
} from "../lib/scrapers/interpellations";

export const DEPUTIES_INTERPELLATIONS_CACHE_PATH =
  "./data/2024/interpellations/deputies";
export const DEPUTIES_INTERPELLATIONS_VERSION = "0.0.1";

const job: ScraperJob<Interpellation[], string> = {
  isAtomic: false,
  version: DEPUTIES_INTERPELLATIONS_VERSION,
  listItems: async () => {
    const ids = await getDeputyIds();
    return ids.map(({ idm }) => idm);
  },
  fetchItem: getInterpellations,
  getPath: (idm) => `${DEPUTIES_INTERPELLATIONS_CACHE_PATH}/${idm}.json`,
  isItemStale: isStale,
  datapackage: {
    name: "deputy-interpellations",
    title: "Deputy Interpellations",
    description:
      "Interpellations submitted by each deputy to government ministers and officials",
  },
};

export default job;
