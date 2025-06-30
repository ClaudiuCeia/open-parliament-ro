import {
  anyChar,
  eof,
  horizontalSpace,
  letter,
  manyTill,
  map,
  seq,
  skipMany1,
} from "@claudiu-ceia/combine";
import { logger } from "../log";
import { $fetch } from "../net/$fetch";
import { throttle } from "../net/throttle";

export type ParliamentGroup = {
  idg: string;
  name: string;
  url: string;
};

export type Party = {
  idp: string;
  abbrev: string;
  name: string;
  url: string;
};

export type District = {
  cir: string;
  name: string;
  url: string;
};

export type MinimalDeputy = {
  idm: string;
  name: string;
};

// Shared minimal deputy preview (used in list)
export type Deputy = {
  idm: string;
  name: string;
  url: string;
  group?: ParliamentGroup;
  district?: District;
  lastUpdated?: string; // ISO date string for caching
};

// Full deputy profile (used on individual pages)
export type FullDeputy = {
  idm: string;
  name: string;
  url: string;
  photoUrl?: string;
  party?: Party;
  group?: ParliamentGroup;
  district?: District;
  activity: Record<string, { count: number; url?: string }>;
  lastUpdated?: string; // ISO date string for caching
};

export const getDeputies = async (skip?: Deputy[]): Promise<Deputy[]> => {
  const log = logger.child({ module: "scraper", job: "deputies" });
  const { $ } = await $fetch("https://www.cdep.ro/pls/parlam/structura2015.de");

  const rows = $(".grup-parlamentar-list table tbody tr").get();
  const deputies: Deputy[] = [];

  let count = 1;
  for (const el of rows) {
    const nameEl = $(el).find("td:nth-child(2) a");
    const name = nameEl.text().trim();

    const deputyLog = log.child({
      module: "deputy",
      name,
    });

    const href = nameEl.attr("href");
    if (!href) {
      deputyLog.warn(`[skip] Missing href in row for deputy: ${name}`);
      continue;
    }

    const idm = new URL(`https://www.cdep.ro${href}`).searchParams.get("idm");
    if (!idm) {
      deputyLog.warn({ href }, `[skip] No idm in URL for deputy: ${name}`);
      continue;
    }

    const skippedDeputy = skip?.find((d) => d.idm === idm);
    if (skippedDeputy) {
      deputyLog.warn(`[skip] Deputy ${name} already processed / skipped`);
      deputies.push(skippedDeputy);
      continue;
    }

    const [id] = $(el).find("td:nth-child(3)").text().trim().split(" / ");

    let district: District | undefined;
    if (id) {
      district = await getDistrict(id);
    }

    const groupUrl = $(el).find("td:nth-child(4) a").attr("href");
    const idg = groupUrl
      ? new URL(`https://www.cdep.ro${groupUrl}`).searchParams.get("idg")
      : undefined;

    if (!idg) {
      deputyLog.warn(
        `No parliamentary group ID found for deputy ${name} (${idm})`,
      );
      continue;
    }

    const group = await getParliamentGroup(idg);

    deputies.push({
      idm,
      name,
      url: href,
      group,
      district,
      lastUpdated: new Date().toISOString(),
    });

    deputyLog.info(`[scraped][${count}/${rows.length}] ${name} (${idm})`);

    // Add a polite delay between requests
    await throttle(200);
    count++;
  }

  return deputies;
};

export const getParliamentGroup = async (
  idg: string,
): Promise<ParliamentGroup | undefined> => {
  const url = `https://www.cdep.ro/pls/parlam/structura2015.gp?idg=${idg}`;
  const { $ } = await $fetch(url);

  const name = $(".profile-dep h1").first().text().trim();
  return {
    idg,
    name,
    url,
  };
};

export const getDistrict = async (
  cir: string,
): Promise<District | undefined> => {
  const log = logger.child({ module: "scraper", job: "districts" });
  log.debug(`Fetching district for cir=${cir}`);
  const url = `https://www.cdep.ro/pls/parlam/structura2015.ce?cir=${cir}`;
  const { $ } = await $fetch(url);

  const title = $(".program-lucru-detalii h1").first().text().trim();
  const match = title.match(/Circumscripţia electorală nr\.(\d+) - (.+)/);
  if (!match) {
    log.warn(`Failed to parse district from title: ${title} at ${url}`);
    return undefined;
  }

  const name = match[2]?.trim() || "";

  return {
    cir,
    name,
    url,
  };
};

export const getParty = async (idp: string): Promise<Party | undefined> => {
  const log = logger.child({ module: "scraper", job: "parties" });
  log.debug(`Fetching party for idp=${idp}`);
  const url = `https://www.cdep.ro/pls/parlam/structura2015.fp?idp=${idp}`;
  const { $ } = await $fetch(url);

  const name = $(".profile-dep h1").first().text().trim();
  // XYZ la Senat
  const abbrevText = $(".profile-dep div.boxInfo span.arrowList:nth-child(1)")
    .text()
    .trim();

  const parser = map(
    seq(manyTill(letter(), horizontalSpace()), skipMany1(anyChar()), eof()),
    ([abbrev]) => abbrev.join(""),
  );

  const abbrevResult = parser({ text: abbrevText, index: 0 });
  if (!abbrevResult.success) {
    log.warn(`Failed to parse party abbreviation: ${abbrevText}`);
    return undefined;
  }

  return {
    idp,
    abbrev: abbrevResult.value,
    name,
    url,
  };
};

export const getDeputyIds = async (): Promise<MinimalDeputy[]> => {
  const log = logger.child({ module: "scraper", job: "deputy-ids" });
  const { $ } = await $fetch("https://www.cdep.ro/pls/parlam/structura2015.de");

  const rows = $(".grup-parlamentar-list table tbody tr").get();
  const result: MinimalDeputy[] = [];

  for (const el of rows) {
    const nameEl = $(el).find("td:nth-child(2) a");
    const name = nameEl.text().trim();

    const deputyLog = log.child({
      module: "deputy",
      name,
    });

    const href = nameEl.attr("href");
    if (!href) {
      deputyLog.warn(`[skip] Missing href in row for deputy: ${name}`);
      continue;
    }

    const idm = new URL(`https://www.cdep.ro${href}`).searchParams.get("idm");
    if (!idm) {
      deputyLog.warn({ href }, `[skip] No idm in URL for deputy: ${name}`);
      continue;
    }

    result.push({
      idm,
      name,
    });
  }
  return result;
};

export const getDeputy = async (idm: string): Promise<FullDeputy> => {
  const url = `https://www.cdep.ro/pls/parlam/structura2015.mp?idm=${idm}&cam=2`;
  const { $ } = await $fetch(url);

  const name = $(".profile-dep .boxTitle h1").first().text().trim();
  const log = logger.child({ module: "scraper", job: "deputy", name });
  log.debug(`Fetching full deputy profile for idm=${idm}`);

  const photoEl = $(".profile-pic-dep img");
  const photoUrl = photoEl.attr("src")
    ? `https://www.cdep.ro${photoEl.attr("src")}`
    : undefined;

  const partyEl = $(".boxDep:contains('Formaţiunea politică') a").first();

  const idp = partyEl.attr("href")
    ? new URL(`https://www.cdep.ro${partyEl.attr("href")}`).searchParams.get(
        "idp",
      )
    : undefined;

  let party: Party | undefined;
  if (!idp) {
    log.warn(`[warn] No party ID found for deputy ${name} (${idm})`);
  } else {
    party = await getParty(idp);
  }

  const groupEl = $(".boxDep:contains('Grupul parlamentar') a").first();
  const idg = groupEl.attr("href")
    ? new URL(`https://www.cdep.ro${groupEl.attr("href")}`).searchParams.get(
        "idg",
      )
    : undefined;

  if (!idg) {
    log.warn(`[warn] No group ID found for deputy ${name} (${idm})`);
    throw new Error(`No group ID found for deputy ${name} (${idm})`);
  }

  const group = await getParliamentGroup(idg);

  // Get url that contains `?cir=`
  const districtUrl = $("a[href*='?cir=']").first().attr("href");
  const cir = districtUrl
    ? new URL(`https://www.cdep.ro${districtUrl}`).searchParams.get("cir")
    : undefined;

  let district: District | undefined;
  if (!cir) {
    log.warn(`[warn] No district ID found for deputy ${name} (${idm})`);
  } else {
    log.debug(`Fetching district for cir=${cir}`);
    district = await getDistrict(cir);
  }

  const activity: Record<string, { count: number; url?: string }> = {};
  $(".boxDep:contains('Activitatea parlamentară în cifre') tr").each(
    (_, row) => {
      const label = $(row).find("td").first().text().trim().replace(/:$/, "");
      const valueTd = $(row).find("td").last();
      const linkEl = valueTd.find("a");

      let count = 0;
      let href: string | undefined;

      if (linkEl.length) {
        const match = linkEl.text().match(/\d+/);
        if (match) count = parseInt(match[0]);
        href = linkEl.attr("href") || undefined;
      } else {
        const match = valueTd.text().match(/\d+/);
        if (match) count = parseInt(match[0]);
      }

      if (label && !Number.isNaN(count)) {
        activity[label] = {
          count,
          ...(href && {
            url: new URL(href, "https://www.cdep.ro").toString(),
          }),
        };
      }
    },
  );

  return {
    idm,
    name,
    url,
    photoUrl,
    party,
    group,
    district,
    activity,
  };
};
