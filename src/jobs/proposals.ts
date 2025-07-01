import { isStale } from "../lib/isStale";
import { logger } from "../lib/log";
import type { ScraperJob } from "../lib/ScraperJob";
import {
  getAllLegislativeProposalIdsByYear,
  getLegislativeProposalById,
  type LegislativeProposal,
} from "../lib/scrapers/proposals";

export const PROPOSALS_CACHE_PATH = "./data/2024/proposals";
export const PROPOSALS_VERSION = "0.1.0";

let proposalIds: string[] | null = null;

async function getAllProposalIds(): Promise<string[]> {
  if (proposalIds) {
    return proposalIds;
  }

  const log = logger.child({
    module: "scraper",
    job: "proposals",
  });

  // Fetch proposal IDs for current legislature (2024 onwards)
  // Legislature runs 2024-2028, then 2028-2032, etc.
  // We fetch all years from 2024 to current year to get complete coverage
  const currentYear = new Date().getFullYear();
  const legislatureStartYear = 2024;

  const years: number[] = [];
  for (let year = legislatureStartYear; year <= currentYear; year++) {
    years.push(year);
  }

  log.info(
    `Fetching proposal IDs from official lists for years: ${years.join(", ")}`,
  );

  const allIds = new Set<string>();

  for (const year of years) {
    try {
      log.info(`Fetching proposal IDs for year ${year}...`);
      const yearIds = await getAllLegislativeProposalIdsByYear(year);

      for (const id of yearIds) {
        allIds.add(id);
      }

      log.info(`Added ${yearIds.length} proposal IDs from year ${year}`);
    } catch (error) {
      log.error(`Failed to get proposal IDs for year ${year}:`, error);
    }
  }

  proposalIds = Array.from(allIds);
  log.info(`Built list with ${proposalIds.length} unique proposal IDs`);
  return proposalIds;
}

const job: ScraperJob<LegislativeProposal, string> = {
  isAtomic: false,
  version: PROPOSALS_VERSION,
  listItems: async () => {
    return await getAllProposalIds();
  },
  fetchItem: async (idp: string) => {
    return await getLegislativeProposalById(idp);
  },
  getPath: (idp) => `${PROPOSALS_CACHE_PATH}/${idp}.json`,
  isItemStale: isStale,
  datapackage: {
    name: "proposals",
    title: "Legislative Proposals",
    description:
      "All legislative proposals in the Chamber of Deputies, including proposal details, status, documents, and initiator information",
  },
};

export default job;
