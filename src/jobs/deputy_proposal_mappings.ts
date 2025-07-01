import { isStale } from "../lib/isStale";
import { logger } from "../lib/log";
import type { ScraperJob } from "../lib/ScraperJob";
import { getDeputyIds } from "../lib/scrapers/deputies";
import { getDeputyLegislativeProposalIds } from "../lib/scrapers/proposals";

export const DEPUTY_PROPOSAL_MAPPINGS_CACHE_PATH =
  "./data/2024/proposals/deputies";
export const DEPUTY_PROPOSAL_MAPPINGS_VERSION = "0.1.0";
export type DeputyProposalMapping = {
  proposals: string[];
};

// Cache to avoid re-fetching deputy lists
let deputyIdsList: string[] | null = null;

async function getAllDeputyIds(): Promise<string[]> {
  if (deputyIdsList) {
    return deputyIdsList;
  }

  const log = logger.child({
    module: "scraper",
    job: "deputy-proposal-mappings",
  });

  log.info("Fetching all current deputy IDs...");
  const deputies = await getDeputyIds();
  deputyIdsList = deputies.map((deputy) => deputy.idm);
  log.info(`Found ${deputyIdsList.length} current deputies`);

  return deputyIdsList;
}

const job: ScraperJob<DeputyProposalMapping, string> = {
  isAtomic: false,
  version: DEPUTY_PROPOSAL_MAPPINGS_VERSION,
  listItems: async () => {
    return await getAllDeputyIds();
  },
  fetchItem: async (idm: string) => {
    const log = logger.child({
      module: "scraper",
      job: "deputy-proposal-mappings",
      idm,
    });

    log.info(`Fetching proposals for deputy ${idm}...`);
    const proposalIds = await getDeputyLegislativeProposalIds(idm);

    log.info(`Found ${proposalIds.length} proposals for deputy ${idm}`);

    return {
      proposals: proposalIds,
    };
  },
  getPath: (idm) => `${DEPUTY_PROPOSAL_MAPPINGS_CACHE_PATH}/${idm}.json`,
  isItemStale: isStale,
  datapackage: {
    name: "deputy-proposal-mappings",
    title: "Deputy Proposal Mappings",
    description:
      "Mapping of deputies to their legislative proposals, showing which proposals each deputy has initiated",
  },
};

export default job;
