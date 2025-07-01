import { existsSync } from "node:fs";
import type { ScraperRunResult } from "../runScraper";
import type { ScraperJob } from "../ScraperJob";
import {
  loadVersionInfo,
  updateVersionInfo,
  type VersionBumpType,
} from "../versioning";

type DataPackageLicense = {
  title?: string;
} & ({ name: string } | { path: string } | { name: string; path: string });

type DataPackageSource = {
  title: string;
  path?: string;
  email?: string;
  version?: string;
};

type DataPackageContributor = {
  title: string;
  givenName?: string;
  familyName?: string;
  path?: string;
  email?: string;
  roles?: string[];
  organization?: string;
};

type DataPackageResource = {
  name: string;
  path: string; // Path to the Data Resource descriptor file
};

// Individual Data Resource descriptor (saved as separate files)
export interface DataResourceDescriptor {
  $schema: string;
  name: string;
  path: string | string[];
  format: string;
  mediatype: string;
  encoding: string;
  title: string;
  description: string;
  schema?: object;
  sources?: DataPackageSource[];
  licenses?: DataPackageLicense[];
}

export interface DataPackage {
  $schema: string;
  name: string;
  title?: string;
  description?: string;
  version?: string;
  id?: string;
  homepage?: string;
  image?: string;
  keywords?: string[];
  licenses: DataPackageLicense[];
  sources?: DataPackageSource[];
  contributors?: DataPackageContributor[];
  resources: DataPackageResource[];
  created: string;
}

async function getJobPaths(
  job: ScraperJob<unknown, unknown>,
): Promise<string[]> {
  if (job.isAtomic) {
    return [job.outputPath.replace("./", "")];
  } else {
    const items = await job.listItems();
    const allPaths = items.map((item) => job.getPath(item).replace("./", ""));
    const uniquePaths = Array.from(new Set(allPaths)); // Deduplicate paths

    // Sort paths properly - first by year, then numerically by filename
    return uniquePaths.sort((a, b) => {
      // Extract year from path (e.g., "2024" from "data/2024/...")
      const yearA = a.match(/(\d{4})/)?.[1];
      const yearB = b.match(/(\d{4})/)?.[1];

      if (yearA && yearB && yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }

      // For same year or no year, sort by filename numerically
      const filenameA = a.split("/").pop()?.replace(".json", "") || "";
      const filenameB = b.split("/").pop()?.replace(".json", "") || "";

      // If both are numeric, sort numerically
      const numA = parseInt(filenameA);
      const numB = parseInt(filenameB);

      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
      }

      // Otherwise, sort alphabetically
      return a.localeCompare(b);
    });
  }
}

export async function generateDataPackage(
  jobs: Map<string, ScraperJob<unknown, unknown>>,
  preserveCreatedDate?: string,
): Promise<DataPackage> {
  const resources: DataPackageResource[] = [];

  for (const [jobName, job] of jobs) {
    // Create Data Resource descriptor
    const dataResourceDescriptor: DataResourceDescriptor = {
      $schema: "https://datapackage.org/profiles/2.0/dataresource.json",
      name: job.datapackage.name,
      title: job.datapackage.title,
      description: job.datapackage.description,
      format: "json",
      mediatype: "application/json",
      encoding: "utf-8",
      path: job.isAtomic
        ? job.outputPath.replace("./", "")
        : await getJobPaths(job),
    };

    // Save the Data Resource descriptor
    const descriptorPath = `./data/resources/${jobName}.json`;
    await Bun.write(
      descriptorPath,
      JSON.stringify(dataResourceDescriptor, null, 2),
    );

    // Add reference to the descriptor in the main datapackage
    resources.push({
      name: job.datapackage.name,
      path: descriptorPath.replace("./", ""),
    });
  }

  // Get version from version tracking system
  const versionInfo = await loadVersionInfo();

  const dataPackage: DataPackage = {
    $schema: "https://datapackage.org/profiles/2.0/datapackage.json",
    name: "open-parliament-romania",
    title: "Open Parliament Romania Data",
    description:
      "Legislative data from the Romanian Chamber of Deputies, including deputy information, proposals, interpellations, motions, and speeches collected from the official parliamentary website.",
    version: versionInfo.version,
    homepage: "https://github.com/ClaudiuCeia/open-parliament-ro",
    keywords: [
      "parliament",
      "romania",
      "deputies",
      "legislation",
      "government",
      "politics",
      "open-data",
    ],
    licenses: [
      {
        name: "CC-BY-4.0",
        title: "Creative Commons Attribution 4.0 International",
        path: "https://creativecommons.org/licenses/by/4.0/",
      },
    ],
    sources: [
      {
        title: "Romanian Chamber of Deputies",
        path: "https://www.cdep.ro/",
      },
    ],
    contributors: [
      {
        title: "Open Parliament Romania",
        roles: ["creator"],
      },
    ],
    resources,
    created: preserveCreatedDate || new Date().toISOString(),
  };

  return dataPackage;
}

export async function writeDataPackage(
  jobs: Map<string, ScraperJob<unknown, unknown>>,
  outputPath = "./data/datapackage.json",
): Promise<void> {
  // Check if datapackage.json already exists and preserve its created date
  let existingCreatedDate: string | undefined;
  if (existsSync(outputPath)) {
    try {
      const existingContent = await Bun.file(outputPath).text();
      const existingPackage = JSON.parse(existingContent);
      existingCreatedDate = existingPackage.created;
    } catch (_error) {
      // If we can't read the existing file, continue with new created date
      console.warn(
        "[datapackage] Could not read existing datapackage.json, using new created date",
      );
    }
  }

  const dataPackage = await generateDataPackage(jobs, existingCreatedDate);
  await Bun.write(outputPath, JSON.stringify(dataPackage, null, 2));
}

/**
 * Update version and write datapackage after scraping
 */
export async function writeDataPackageWithVersionUpdate(
  jobs: Map<string, ScraperJob<unknown, unknown>>,
  outputPath = "./data/datapackage.json",
  jobResults?: ScraperRunResult[],
  forceBumpType?: VersionBumpType,
  customReason?: string,
): Promise<void> {
  await updateVersionInfo(jobs, jobResults, forceBumpType, customReason);

  // Check if datapackage.json already exists and preserve its created date
  let existingCreatedDate: string | undefined;
  if (existsSync(outputPath)) {
    try {
      const existingContent = await Bun.file(outputPath).text();
      const existingPackage = JSON.parse(existingContent);
      existingCreatedDate = existingPackage.created;
    } catch (_error) {
      // If we can't read the existing file, continue with new created date
      console.warn(
        "[datapackage] Could not read existing datapackage.json, using new created date",
      );
    }
  }

  const dataPackage = await generateDataPackage(jobs, existingCreatedDate);
  await Bun.write(outputPath, JSON.stringify(dataPackage, null, 2));
}
