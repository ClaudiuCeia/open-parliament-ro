import {
  digit,
  either,
  horizontalSpace,
  int,
  many1,
  map,
  seq,
  skip1,
  str,
} from "@claudiu-ceia/combine";
import { logger } from "../log";
import { $fetch } from "../net/$fetch";

export type LegislativeProposal = {
  idp: string;
  title: string;
  registrationNumber: {
    bpi: string; // BPI number??
    deputyChamber?: string;
    senateChamber?: string;
  };
  legislativeProcedure: string;
  decidingChamber: string;
  type: string;
  emergencyProcedure: boolean;
  status: {
    short: string;
    long: string;
  };
  initiators: string[];
  publicConsultation:
    | {
        dueDate: Date;
        count: number;
      }
    | string
    | null;
  documents: {
    textUrl: string;
    title: string;
  }[];
  url: string;
  // TODO: timelines, votes, etc.
};

// Termen: 27.06.2025\nNumar propuneri/sugestii depuse: 1
// Termen: 12.05.2025\nNumar propuneri/sugestii validate: 1
const parsePublicConsultation = (
  text: string,
): LegislativeProposal["publicConsultation"] => {
  // TODO: Should be optional
  if (text.trim() === "") {
    return null;
  }

  const log = logger.child({
    module: "scraper",
    job: "legislativeProposals",
  });
  const consultationParser = map(
    seq(
      skip1(str("Termen:")),
      horizontalSpace(),
      map(
        seq(
          map(many1(digit()), (d) => d.join("")),
          skip1(str(".")),
          map(many1(digit()), (d) => d.join("")),
          skip1(str(".")),
          int(),
        ),
        ([day, , month, , year]) => new Date(`${year}-${month}-${day}`),
      ),
      skip1(
        either(
          str("\nNumar propuneri/sugestii depuse:"),
          str("\nNumar propuneri/sugestii validate:"),
        ),
      ),
      horizontalSpace(),
      int(),
    ),
    ([, , dueDate, , , count]) => [dueDate, count] as const,
  );

  const consultationResult = consultationParser({
    text,
    index: 0,
  });

  let publicConsultation: LegislativeProposal["publicConsultation"];
  if (!consultationResult.success) {
    log.debug(
      `Failed to parse public consultation for proposal: "${text}", expected "${consultationResult.expected}" at "Ln ${consultationResult.location.line}, Col ${consultationResult.location.column}"`,
    );

    publicConsultation = text; // Keep raw text if parsing fails
  } else {
    const [dueDate, count] = consultationResult.value;
    publicConsultation = {
      dueDate,
      count,
    };
  }

  return publicConsultation;
};

// Doesn't include senate proposals
export const getDeputyLegislativeProposals = async (
  idm: string,
): Promise<LegislativeProposal[]> => {
  const log = logger.child({
    module: "scraper",
    job: "legislativeProposals",
    idm,
  });

  const { $ } = await $fetch(
    `https://www.cdep.ro/pls/parlam/structura2015.mp?idm=${idm}&cam=2&leg=2024&idl=1&pag=2`,
  );

  const rows = $(".grup-parlamentar-list table tbody tr").get();

  const proposals: LegislativeProposal[] = [];
  for (const el of rows) {
    const urlEl = $(el).find("td:nth-child(2) a");
    const url = urlEl.attr("href");
    if (!url) {
      log.debug(`[skip] Missing URL in proposal row for: ${urlEl.text()}`);
      continue;
    }

    const statusShort = $(el)
      .find("td:nth-child(5)")
      .text()
      .trim()
      .toLowerCase();

    const fullUrl = `https://www.cdep.ro/${url}`;
    const { $: $$ } = await $fetch(fullUrl);
    const idp = new URL(fullUrl).searchParams.get("idp");
    if (!idp) {
      log.debug(`[skip] No proposal ID found in URL for: ${urlEl.text()}`);
      continue;
    }

    const title = $$("div.detalii-initiativa > h4").first().text().trim();
    const bpiRegistration = $$("td:contains('- B.P.I.:') + td").text().trim();
    const deputyChamberRegistration = $$(
      "td:contains('- Camera Deputaţilor:') + td",
    )
      .text()
      .trim();
    const senateChamberRegistration = $$("td:contains('- Senat:') + td")
      .text()
      .trim();

    const legislativeProcedure = $$(
      "td:contains('Procedura legislativa:') + td",
    )
      .text()
      .trim();
    const decidingChamber = $$("td:contains('Camera decizionala:') + td")
      .text()
      .trim();
    const type = $$("td:contains('Tip initiativa:') + td").text().trim();
    const emergencyProcedure = $$("td:contains('Procedura de urgenta:') + td")
      .text()
      .trim()
      .toLowerCase()
      .includes("da");
    const statusLong = $$("td:contains('Stadiu:') + td")
      .html()
      ?.replace(/<br\s*\/?>/gi, '\n')
      ?.replace(/<[^>]*>/g, '')
      ?.trim() || "";

    const initiatorsContainer = $$(
      "td:contains('Initiator: ') + td table a",
    ).get();
    const initiators: string[] = [];
    for (const initiator of initiatorsContainer) {
      const initiatorUrl = $$(initiator).attr("href");
      if (!initiatorUrl) {
        log.debug(`[skip] Missing initiator URL in proposal row for: ${title}`);
        continue;
      }

      const initiatorChamber = new URL(
        `https://www.cdep.ro${initiatorUrl}`,
      ).searchParams.get("cam");
      if (!initiatorChamber || initiatorChamber !== "2") {
        log.debug(
          `[skip] Invalid initiator chamber for proposal: ${title} at ${fullUrl}`,
        );
        continue;
      }

      const initiatorIdm = new URL(
        `https://www.cdep.ro${initiatorUrl}`,
      ).searchParams.get("idm");
      if (!initiatorIdm) {
        log.debug(
          `[skip] No initiator ID found in URL for proposal: ${title} at ${fullUrl}`,
        );
        continue;
      }

      initiators.push(initiatorIdm);
    }

    if (initiators.length === 0) {
      log.debug(`[skip] No valid initiators for proposal: ${title}`);
      continue;
    }

    const publicConsultationText = $$("td:contains('Consultare publică:') + td")
      .find("br")
      .replaceWith("\n")
      .end()
      .text()
      .trim();

    const publicConsultation = parsePublicConsultation(publicConsultationText);

    const documents: { textUrl: string; title: string }[] = [];
    $$("td:contains('Consultati:') + td table tr").each((_, docRow) => {
      const docTitle = $$(docRow).find("td:nth-child(2)").text().trim();
      const docUrl = $$(docRow).find("td:nth-child(1) a").attr("href");
      if (!docUrl) {
        log.warn(`[skip] Missing document URL in proposal row for: ${title}`);
        return;
      }

      documents.push({
        textUrl: new URL(`https://www.cdep.ro${docUrl}`).href,
        title: docTitle,
      });
    });

    if (documents.length === 0) {
      log.warn(`[skip] No documents found for proposal: ${title}`);
      continue;
    }

    proposals.push({
      idp,
      title,
      registrationNumber: {
        bpi: bpiRegistration,
        deputyChamber: deputyChamberRegistration || undefined,
        senateChamber: senateChamberRegistration || undefined,
      },
      legislativeProcedure,
      decidingChamber,
      type,
      emergencyProcedure,
      status: {
        short: statusShort,
        long: statusLong,
      },
      initiators,
      publicConsultation,
      documents,
      url: fullUrl,
    });
  }

  return proposals;
};
