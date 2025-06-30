import {
  anyChar,
  eof,
  horizontalSpace,
  int,
  many1,
  manyTill,
  map,
  oneOf,
  optional,
  seq,
  str,
} from "@claudiu-ceia/combine";
import { logger } from "../log";
import { $fetch } from "../net/$fetch";
import { resolveDeputyId } from "./resolveDeputyId";

export type Transcript = {
  fullTextUrl: string;
  relevantSectionUrl: string;
  description: string;
};

export type SpeechEntry = {
  ids: string;
  idv: string;
  idm: string;
  date: Date;
  title: string;
  link: string;
  transcripts: Transcript[];
};
export const dateParser = (title: string): Date | null => {
  const log = logger.child({
    module: "scraper",
    job: "speeches",
    title,
  });

  const monthNames = [
    "ianuarie",
    "februarie",
    "martie",
    "aprilie",
    "mai",
    "iunie",
    "iulie",
    "august",
    "septembrie",
    "octombrie",
    "noiembrie",
    "decembrie",
  ];

  const dateP = map(
    seq(
      int(),
      horizontalSpace(),
      oneOf(...monthNames.map((month) => seq(str(month), horizontalSpace()))),
      int(),
    ),
    ([day, _, [month, __], year]) => {
      const monthIndex = monthNames.indexOf(month);
      return new Date(year, monthIndex, day);
    },
  );

  const parser = map(
    seq(manyTill(anyChar(), dateP), optional(many1(anyChar())), eof()),
    ([matches]) => matches.at(-1) as Date,
  );

  const result = parser({ text: title, index: 0 });
  if (result.success) {
    return result.value;
  } else {
    log.warn(
      `Failed to parse date for speech title "${title}", expected "${result.expected}" at index ${result.location}`,
    );
    return null;
  }
};

export async function getSpeeches(idv: string): Promise<SpeechEntry[]> {
  const log = logger.child({
    module: "scraper",
    job: "speeches",
    idv,
  });

  const baseUrl = "https://www.cdep.ro/pls/steno/steno2015.lista";
  // "pag" is the limit, 1000 should be enough.
  // If we need more, we can look into pagination.
  const url = `${baseUrl}?idv=${idv}&idl=1&pag=1000`;
  const { $ } = await $fetch(url);

  // URL has an invalid target and Cheerio removes it when building the DOM, so we have to match by name
  const deputyName = $(
    "table:contains('Criteriile de interogare selectate:') tbody tr:nth-child(3) td:nth-child(2) b",
  )
    .text()
    .trim();

  const idm = await resolveDeputyId(deputyName);
  if (!idm) {
    log.warn(
      `No deputy ID found for idv ${idv} at ${url}, with name "${deputyName}"`,
    );
    return [];
  }

  const speeches: SpeechEntry[] = [];

  const rows = $(
    "#olddiv .grup-parlamentar-list table.innertable:nth-child(2) > tbody > tr",
  );

  if (rows.length === 0) {
    log.warn(`No speeches found for IDV ${idv} at ${url}`);
    return [];
  }

  for (const el of rows) {
    const idsCell = $(el).find("td:nth-child(1) b a").text().trim();
    // This belongs to the previous parent speech
    if (idsCell === "") {
      const previous = speeches[speeches.length - 1];
      if (previous) {
        // These keep indenting so we need to parse from right to left
        const relevantSectionUrl = $(el)
          .find("td:nth-last-child(1) a")
          .attr("href");
        const description = $(el).find("td:nth-last-child(2)").text().trim();
        const fullTextUrl = $(el).find("td:nth-last-child(3) a").attr("href");

        previous.transcripts.push({
          fullTextUrl: fullTextUrl
            ? new URL(`https://www.cdep.ro${fullTextUrl}`).href
            : "",
          relevantSectionUrl: relevantSectionUrl
            ? new URL(`https://www.cdep.ro${relevantSectionUrl}`).href
            : "",
          description,
        });
      }

      continue;
    }

    const idsUrl = $(el).find("td:nth-child(1) b a").attr("href");
    if (!idsUrl) {
      log.warn(`No URL found for speech ID ${idsCell} at ${url}`);
      continue;
    }

    const ids = new URL(`https://www.cdep.ro${idsUrl}`).searchParams.get("ids");
    if (!ids) {
      log.warn(`No IDs found in URL for speech ID ${idsCell} at ${url}`);
      continue;
    }

    const urlCell = $(el).find("td:nth-child(1) a").attr("href");
    const titleCell = $(el)
      .find("td:nth-child(2) table tr td:nth-child(1)")
      .text()
      .trim();
    const date = dateParser(titleCell);

    if (!date) {
      log.warn(`Invalid date for speech ID ${ids}: ${titleCell}`);
      continue;
    }

    speeches.push({
      ids,
      idv,
      idm,
      date,
      title: titleCell,
      link: new URL(`https://www.cdep.ro${urlCell}`).href,
      transcripts: [],
    });
  }

  return speeches;
}
