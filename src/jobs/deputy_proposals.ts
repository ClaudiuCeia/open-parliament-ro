import { isStale } from "../lib/isStale";
import type { ScraperJob } from "../lib/ScraperJob";
import { getDeputyIds } from "../lib/scrapers/deputies";
import {
  getDeputyLegislativeProposals,
  type LegislativeProposal,
} from "../lib/scrapers/proposals";

export const DEPUTIES_PROPOSALS_CACHE_PATH = "./data/2024/proposals/deputies";
export const DEPUTIES_PROPOSALS_VERSION = "0.0.2";

const job: ScraperJob<LegislativeProposal[], string> = {
  isAtomic: false,
  name: "Deputy legislative proposals",
  version: DEPUTIES_PROPOSALS_VERSION,
  listItems: async () => {
    const ids = await getDeputyIds();
    return ids.map(({ idm }) => idm);
  },
  fetchItem: getDeputyLegislativeProposals,
  getPath: (idm) => `${DEPUTIES_PROPOSALS_CACHE_PATH}/${idm}.json`,
  isItemStale: isStale,
};

export default job;
