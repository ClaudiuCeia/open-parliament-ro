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
  path: string | string[];
  format?: string;
  mediatype?: string;
  encoding?: string;
  bytes?: number;
  hash?: string;
  title?: string;
  description?: string;
  type?: string;
  sources?: DataPackageSource[];
  licenses?: DataPackageLicense[];
};

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

export async function generateDataPackage(
  jobs: Map<string, ScraperJob<unknown, unknown>>,
  preserveCreatedDate?: string,
): Promise<DataPackage> {
  const resources: DataPackageResource[] = [];

  // Generate individual resource descriptor files and reference them in the main datapackage
  for (const [, job] of jobs) {
    resources.push({
      name: job.datapackage.name,
      path: `data/resources/${job.datapackage.name}.json`,
      format: "json",
      mediatype: "application/json",
      encoding: "utf-8",
      title: job.datapackage.title,
      description: job.datapackage.description,
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
  // Generate individual resource descriptor files
  await writeResourceDescriptors(jobs);

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

  // Generate individual resource descriptor files
  await writeResourceDescriptors(jobs);

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
 * Generate individual resource descriptor files for each job
 */
export async function writeResourceDescriptors(
  jobs: Map<string, ScraperJob<unknown, unknown>>,
  resourcesDir = "./data/resources",
): Promise<void> {
  // Create resources directory if it doesn't exist
  if (!existsSync(resourcesDir)) {
    await Bun.write(`${resourcesDir}/.gitkeep`, "");
  }

  for (const [, job] of jobs) {
    const resourceDescriptor: DataPackageResource & { $schema: string } = {
      $schema: "https://datapackage.org/profiles/2.0/dataresource.json",
      name: job.datapackage.name,
      title: job.datapackage.title,
      description: job.datapackage.description,
      format: "json",
      mediatype: "application/json",
      encoding: "utf-8",
      path: "", // Will be set below
    };

    if (job.isAtomic) {
      // Single file resource
      resourceDescriptor.path = job.outputPath.replace("./", "");
    } else {
      // Multiple files - list actual paths
      const items = await job.listItems();
      const allPaths = items.map((item) => job.getPath(item).replace("./", ""));
      const paths = Array.from(new Set(allPaths)); // Deduplicate paths
      resourceDescriptor.path = paths;
    }

    const resourcePath = `${resourcesDir}/${job.datapackage.name}.json`;
    await Bun.write(resourcePath, JSON.stringify(resourceDescriptor, null, 2));
  }
}
