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
  version: DEPUTIES_PROPOSALS_VERSION,
  listItems: async () => {
    const ids = await getDeputyIds();
    return ids.map(({ idm }) => idm);
  },
  fetchItem: getDeputyLegislativeProposals,
  getPath: (idm) => `${DEPUTIES_PROPOSALS_CACHE_PATH}/${idm}.json`,
  isItemStale: isStale,
  datapackage: {
    name: "deputy-proposals",
    title: "Deputy Legislative Proposals",
    description:
      "Legislative proposals initiated or co-initiated by each deputy, including proposal details, status, documents, and public consultation information",
  },
};

export default job;
