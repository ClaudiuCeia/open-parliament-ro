import { isStale } from "../lib/isStale";
import type { ScraperJob } from "../lib/ScraperJob";
import {
  type FullDeputy,
  getDeputy,
  getDeputyIds,
} from "../lib/scrapers/deputies";

export const DEPUTIES_DETAIL_CACHE_PATH = "./data/2024/full-deputies";
export const DEPUTIES_DETAIL_VERSION = "0.0.3";

const job: ScraperJob<FullDeputy, string> = {
  isAtomic: false,
  version: DEPUTIES_DETAIL_VERSION,
  listItems: async () => {
    const ids = await getDeputyIds();
    return ids.map(({ idm }) => idm);
  },
  fetchItem: getDeputy,
  getPath: (idm) => `${DEPUTIES_DETAIL_CACHE_PATH}/${idm}.json`,
  isItemStale: isStale,
  datapackage: {
    name: "deputy-details",
    title: "Full Deputies",
    description:
      "Detailed information for each deputy including full biography, committee memberships, contact information, and parliamentary activity",
  },
};

export default job;
