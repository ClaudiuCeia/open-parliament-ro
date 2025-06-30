import { logger } from "../log";
import { $fetch } from "../net/$fetch";
import { resolveDeputyId } from "./resolveDeputyId";
export type Motion = {
  type: "ordinary" | "no-confidence";
  title: string;
  date: Date;
  textUrl: string;
  signatures: string[];
  status: string;
  initiators: string;
  url: string;
};

export const getMotions = async (): Promise<Motion[]> => {
  const log = logger.child({
    module: "scraper",
    job: "motions",
  });

  const motions: Motion[] = [];

  // Define both types to fetch
  const pages = [
    { cam: "0", type: "no-confidence" as const },
    { cam: "2", type: "ordinary" as const },
  ];

  for (const { cam, type } of pages) {
    const camlog = log.child({
      cam,
      type,
    });

    camlog.debug(`Fetching cam=${cam} (${type})`);
    const { $ } = await $fetch(
      `https://www.cdep.ro/pls/parlam/motiuni2015.lista?cam=${cam}`,
    );

    const rows = $("table.video-table tbody > tr").get();

    for (const el of rows) {
      const titleContainer = $(el).find("td:nth-child(2) a");
      const title = titleContainer.text().trim().slice(1, -1).trim();
      const href = titleContainer.attr("href");
      if (!href) {
        camlog.warn(`[skip] Missing href in motion row for title: ${title}`);
        continue;
      }

      const url = new URL(`https://www.cdep.ro${href}`).href;
      const initiators = $(el).find("td:nth-child(3)").text().trim();
      const dateStr = $(el)
        .find("td:nth-child(4)")
        .text()
        .trim()
        .split(" / ")[1];
      const status = $(el).find("td:nth-child(5)").text().trim();

      const relativeTextUrl = $(el).find("td:nth-child(6) a").attr("href");
      if (!relativeTextUrl) {
        camlog.warn(
          `[skip] Missing text URL in motion row for title: ${title}`,
        );
        continue;
      }
      const textUrl = new URL(`https://www.cdep.ro${relativeTextUrl}`).href;

      // Fetch motion detail page
      const { $: $$ } = await $fetch(url);

      const deputySignatories = $$(
        ".program-lucru-detalii > div > div:nth-last-child(1) > div:nth-child(1) ol li",
      ).get();

      camlog.debug(
        `Found ${deputySignatories.length} signatories for "${title}"`,
      );

      const signatures = [];
      // resolveDeputyId does a fetch and cache on the first call, so it's better
      // to call it in a loop rather than fetching all deputies at once
      for (const li of deputySignatories) {
        const text = $$(li).text().trim().toLowerCase();
        const deputyId = await resolveDeputyId(text);
        if (deputyId) {
          signatures.push(deputyId);
        } else {
          camlog.warn(
            `No deputy ID found for signature "${text}" in motion "${title}"`,
          );
        }
      }

      if (signatures.length === 0) {
        camlog.warn(`No valid signatures for "${title}" at ${url}`);
        continue;
      }

      motions.push({
        type,
        title,
        date: new Date(dateStr || 0),
        textUrl,
        signatures,
        status,
        initiators,
        url,
      });
    }
  }

  return motions;
};
