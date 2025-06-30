import { logger } from "../log";
import { $fetch } from "../net/$fetch";

export type Interpellation = {
  idi: string; // Interpellation ID
  title: string;
  description: string;
  addressee: {
    idm: string;
  };
  recipient: string;
  dates: {
    registration: Date;
    presentation: Date;
    communication: Date;
    responseDue: Date;
  };
  mode: string; // "written" | "oral";
  textUrl: string;
  url: string;
  registrationId: string;
  requestedResponseType: string; // "written" | "oral";
  answers: InterpellationAnswer[];
};

export type InterpellationAnswer = {
  registrationId: string;
  date: Date;
  responseType: string; // "written" | "oral";
  author: string;
  textUrl: string;
};

export const getInterpellations = async (
  idm: string,
): Promise<Interpellation[]> => {
  const log = logger.child({
    module: "scraper",
    job: "interpellations",
    idm,
  });
  const { $ } = await $fetch(
    `https://www.cdep.ro/pls/parlam/structura2015.mp?idm=${idm}&cam=2&leg=2024&pag=3`,
  );

  const rows = $(".grup-parlamentar-list table tbody tr").get();

  const interpellations: Interpellation[] = [];
  for (const el of rows) {
    const title = $(el).find("td:nth-child(2) a").text().trim();
    const descriptionRaw = $(el).find("td:nth-child(2)").text().trim();
    const description = descriptionRaw
      .replace(title, "")
      .replace(/^\s*:\s*/, "")
      .trim();

    const url = $(el).find("td:nth-child(2) a").attr("href");
    if (!url) {
      log.warn(`[skip] Missing URL in interpellation row for title: ${title}`);
      continue;
    }

    // Suddenly, relative URLs...
    const fullUrl = `https://www.cdep.ro/pls/parlam/${url}`;
    const idi = new URL(fullUrl).searchParams.get("idi");
    if (!idi) {
      log.warn(
        `[skip] No interpellation ID found in URL for title: ${title} at ${url}`,
      );
      continue; // Skip if no ID
    }

    const ilog = log.child({
      idi,
      title,
      url: fullUrl,
    });

    const { $: $$ } = await $fetch(fullUrl);
    const registrationId = $$("td:contains('Nr.înregistrare:') + td")
      .text()
      .trim();
    const registrationDateStr = $$("td:contains('Data înregistrarii:') + td")
      .text()
      .trim();
    const presentationDateStr = $$("td:contains('Data prezentării:') + td")
      .text()
      .trim();
    const communicationDateStr = $$("td:contains('Data comunicării:') + td")
      .text()
      .trim();
    const responseDueDateStr = $$("td:contains('Termen primire răspuns:') + td")
      .text()
      .trim();

    const mode = $$("td:contains('Mod adresare:') + td")
      .text()
      .trim()
      .toLowerCase();
    const recipient = $$("td:contains('Destinatar:') + td").text().trim();
    const textUrl = $$("td:contains('Textul intervenţiei:') + td a").attr(
      "href",
    );
    const requestedResponseType = $$("td:contains('Răspuns solicitat:') + td")
      .text()
      .trim()
      .toLowerCase();

    const answerTables = $$(
      'div:contains("Informaţii privind răspunsul") + p + table',
    );

    ilog.debug(`Found ${answerTables.length} answers for "${title}"`);

    const answers: InterpellationAnswer[] = [];
    answerTables.each((_, table) => {
      const registrationId = $$(table)
        .find("td:contains('Nr.înregistrare:') + td")
        .text()
        .trim();
      const dateStr = $$(table)
        .find("td:contains('Data înregistrării:') + td")
        .text()
        .trim();
      const responseType = $$(table)
        .find("td:contains('Răspuns primit:') + td")
        .text()
        .trim()
        .toLowerCase();
      const author = $$(table)
        .find("td:contains('Răspuns primit de la:') + td")
        .text()
        .trim();
      const textUrl = $$(table)
        .find("td:contains('Textul răspunsului:') + td a")
        .attr("href");

      if (!registrationId || !dateStr || !responseType || !author) {
        ilog.warn(
          `[skip] Missing required fields in interpellation answer for title: ${title}`,
        );
        return; // Skip if any required field is missing
      }

      answers.push({
        registrationId,
        date: new Date(dateStr || 0),
        responseType,
        author,
        textUrl: textUrl ? new URL(`https://www.cdep.ro${textUrl}`).href : "",
      });
    });

    interpellations.push({
      idi,
      title,
      description,
      addressee: { idm },
      recipient,
      dates: {
        registration: new Date(registrationDateStr || 0),
        presentation: new Date(presentationDateStr || 0),
        communication: new Date(communicationDateStr || 0),
        responseDue: new Date(responseDueDateStr || 0),
      },
      mode,
      textUrl: textUrl ? new URL(`https://www.cdep.ro${textUrl}`).href : "",
      url: `https://www.cdep.ro${url}`,
      registrationId,
      requestedResponseType,
      answers,
    });
  }

  return interpellations;
};
