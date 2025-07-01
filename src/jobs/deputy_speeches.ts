import { readCache } from "../lib/cache";
import { isStale } from "../lib/isStale";
import { logger } from "../lib/log";
import type { ScraperJob } from "../lib/ScraperJob";
import { type FullDeputy, getDeputyIds } from "../lib/scrapers/deputies";
import { getSpeeches, type SpeechEntry } from "../lib/scrapers/speeches";

export const SPEECH_CACHE_PATH = "./data/2024/speeches/deputies";
export const SPEECH_VERSION = "0.0.1";

// FIXME:
// We need to redeclare this inside since importing from the other job
// would trigger the side-effect...
const DEPUTIES_DETAIL_CACHE_PATH = "./data/2024/full-deputies";

const job: ScraperJob<SpeechEntry[], { idm: string; idv: string }> = {
  isAtomic: false,
  version: SPEECH_VERSION,
  listItems: async () => {
    const log = logger.child({ module: "deputy_speeches" });
    const deputyIds = await getDeputyIds();
    const result: {
      idm: string;
      idv: string;
    }[] = [];

    for (const { idm } of deputyIds) {
      const cached = await readCache<FullDeputy>(
        `${DEPUTIES_DETAIL_CACHE_PATH}/${idm}.json`,
      );

      if (!cached || !cached.data.activity) {
        log.debug(`No cached activity found for deputy ${idm}. Skipping.`);
        continue;
      }

      // In practice, there should be a 1:1 relation between idv and idm
      const idvs = Array.from(
        new Set(
          Object.values(cached.data.activity)
            .map(
              (activity) =>
                activity.url && new URL(activity.url).searchParams.get("idv"),
            )
            .filter((idv) => idv !== null && idv !== undefined),
        ),
      );

      if (idvs.length === 0) {
        log.debug(`No steno2015 activity found for deputy ${idm}. Skipping.`);
        continue;
      }

      for (const idv of idvs) {
        result.push({
          idm,
          idv,
        });
      }
    }

    return result;
  },
  fetchItem: async ({ idv }) => getSpeeches(idv),
  getPath: (item) => `${SPEECH_CACHE_PATH}/${item.idm}.json`,
  isItemStale: isStale,
  datapackage: {
    name: "deputy-speeches",
    title: "Deputy Speeches",
    description:
      "Parliamentary speeches and interventions made by each deputy during plenary sessions",
  },
};

export default job;
