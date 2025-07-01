import { existsSync } from "node:fs";
import type { ScraperRunResult } from "./runScraper";
import type { ScraperJob } from "./ScraperJob";

export interface VersionInfo {
  version: string;
  lastUpdated: string;
  jobVersions: Record<string, string>;
  isInitialRelease?: boolean;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
  type: "major" | "minor" | "patch";
}

export enum VersionBumpType {
  PATCH = "patch",
  MINOR = "minor",
  MAJOR = "major",
}

const VERSION_FILE_PATH = "./data/version.json";
const CHANGELOG_FILE_PATH = "./data/CHANGELOG.md";

function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  if (!version || typeof version !== "string") {
    throw new Error(`Invalid version format: ${version}`);
  }

  const parts = version.split(".").map(Number);
  if (parts.length !== 3) {
    throw new Error(
      `Invalid semantic version format: ${version} (expected X.Y.Z)`,
    );
  }

  const major = parts[0];
  const minor = parts[1];
  const patch = parts[2];

  if (
    typeof major !== "number" ||
    typeof minor !== "number" ||
    typeof patch !== "number" ||
    Number.isNaN(major) ||
    Number.isNaN(minor) ||
    Number.isNaN(patch) ||
    major < 0 ||
    minor < 0 ||
    patch < 0
  ) {
    throw new Error(`Invalid semantic version format: ${version}`);
  }

  return { major, minor, patch };
}

function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

export async function loadVersionInfo(): Promise<VersionInfo> {
  if (!existsSync(VERSION_FILE_PATH)) {
    return {
      version: "0.0.0",
      lastUpdated: new Date().toISOString(),
      jobVersions: {},
      isInitialRelease: true,
    };
  }

  try {
    const content = await Bun.file(VERSION_FILE_PATH).text();
    const parsed = JSON.parse(content) as VersionInfo;

    if (!parsed.version || !parsed.lastUpdated || !parsed.jobVersions) {
      throw new Error("Missing required fields in version.json");
    }

    const versionParts = parsed.version.split(".").map(Number);
    if (versionParts.length !== 3 || versionParts.some(Number.isNaN)) {
      throw new Error(`Invalid semantic version format: ${parsed.version}`);
    }

    return parsed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[versioning] Error reading ${VERSION_FILE_PATH}:`,
      errorMessage,
    );
    console.log(`[versioning] Creating new version file with default values`);

    const defaultVersion: VersionInfo = {
      version: "0.0.0",
      lastUpdated: new Date().toISOString(),
      jobVersions: {},
      isInitialRelease: true,
    };

    await saveVersionInfo(defaultVersion);
    return defaultVersion;
  }
}

export async function saveVersionInfo(versionInfo: VersionInfo): Promise<void> {
  try {
    await Bun.write(VERSION_FILE_PATH, JSON.stringify(versionInfo, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to save version info to ${VERSION_FILE_PATH}: ${errorMessage}`,
    );
  }
}

export function determineVersionBumpType(
  currentVersionInfo: VersionInfo,
  newJobVersions: Record<string, string>,
  jobResults?: ScraperRunResult[],
): { bumpType: VersionBumpType; reasons: string[] } {
  const reasons: string[] = [];

  if (currentVersionInfo.isInitialRelease) {
    const jobNames = Object.keys(newJobVersions);
    if (jobNames.length > 0) {
      reasons.push(`Initial release with scrapers: ${jobNames.join(", ")}`);
    } else {
      reasons.push("Initial data package release");
    }
    return { bumpType: VersionBumpType.MINOR, reasons };
  }

  const currentJobNames = new Set(Object.keys(currentVersionInfo.jobVersions));
  const newJobNames = new Set(Object.keys(newJobVersions));

  const addedJobs = [...newJobNames].filter(
    (name) => !currentJobNames.has(name),
  );
  const removedJobs = [...currentJobNames].filter(
    (name) => !newJobNames.has(name),
  );

  if (addedJobs.length > 0) {
    reasons.push(`Added new scraper jobs: ${addedJobs.join(", ")}`);
    return { bumpType: VersionBumpType.MAJOR, reasons };
  }

  if (removedJobs.length > 0) {
    reasons.push(`Removed scraper jobs: ${removedJobs.join(", ")}`);
    return { bumpType: VersionBumpType.MAJOR, reasons };
  }

  const versionChanges: string[] = [];
  for (const [jobName, newVersion] of Object.entries(newJobVersions)) {
    const currentVersion = currentVersionInfo.jobVersions[jobName];
    if (currentVersion && currentVersion !== newVersion) {
      versionChanges.push(`${jobName}: ${currentVersion} → ${newVersion}`);
    }
  }

  if (versionChanges.length > 0) {
    reasons.push(`Updated scraper versions: ${versionChanges.join(", ")}`);
    return { bumpType: VersionBumpType.MAJOR, reasons };
  }

  const daysSinceLastUpdate =
    (Date.now() - new Date(currentVersionInfo.lastUpdated).getTime()) /
    (1000 * 60 * 60 * 24);
  if (daysSinceLastUpdate > 30) {
    const modifiedJobs =
      jobResults?.filter((r) => r.wasModified).map((r) => r.jobName) || [];
    if (modifiedJobs.length > 0) {
      reasons.push(
        `Backfilling data after ${Math.round(daysSinceLastUpdate)} days hiatus (${modifiedJobs.join(", ")})`,
      );
    } else {
      reasons.push(
        `Backfilling data after ${Math.round(daysSinceLastUpdate)} days hiatus`,
      );
    }
    return { bumpType: VersionBumpType.MINOR, reasons };
  }

  if (jobResults) {
    const modifiedJobs = jobResults.filter((r) => r.wasModified);

    if (modifiedJobs.length > 0) {
      reasons.push(
        `Updated data in ${modifiedJobs.length} scraper(s): ${modifiedJobs.map((r) => `${r.jobName} (${r.processed} items)`).join(", ")}`,
      );
      return { bumpType: VersionBumpType.PATCH, reasons };
    }

    reasons.push("No data changes detected");
    return { bumpType: VersionBumpType.PATCH, reasons };
  }

  reasons.push("Regular data update");
  return { bumpType: VersionBumpType.PATCH, reasons };
}

export function bumpVersion(
  currentVersion: string,
  bumpType: VersionBumpType,
): string {
  if (!currentVersion) {
    throw new Error("Current version cannot be empty");
  }

  const { major, minor, patch } = parseVersion(currentVersion);

  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error(`Invalid version components: ${currentVersion}`);
  }

  switch (bumpType) {
    case VersionBumpType.MAJOR:
      return formatVersion(major + 1, 0, 0);
    case VersionBumpType.MINOR:
      return formatVersion(major, minor + 1, 0);
    case VersionBumpType.PATCH:
      return formatVersion(major, minor, patch + 1);
    default:
      throw new Error(`Unknown version bump type: ${bumpType}`);
  }
}

export function createJobVersionsMap(
  jobs: Map<string, ScraperJob<unknown, unknown>>,
): Record<string, string> {
  const jobVersions: Record<string, string> = {};
  for (const [jobName, job] of jobs) {
    jobVersions[jobName] = job.version;
  }
  return jobVersions;
}

export async function updateVersionInfo(
  jobs: Map<string, ScraperJob<unknown, unknown>>,
  jobResults?: ScraperRunResult[],
  forceBumpType?: VersionBumpType,
  customReason?: string,
): Promise<VersionInfo> {
  const currentVersionInfo = await loadVersionInfo();
  const newJobVersions = createJobVersionsMap(jobs);

  const { bumpType, reasons } = forceBumpType
    ? {
        bumpType: forceBumpType,
        reasons: customReason
          ? [customReason]
          : [`Forced ${forceBumpType} version bump`],
      }
    : determineVersionBumpType(currentVersionInfo, newJobVersions, jobResults);

  const newVersion = bumpVersion(currentVersionInfo.version, bumpType);
  const now = new Date();

  const newVersionInfo: VersionInfo = {
    version: newVersion,
    lastUpdated: now.toISOString(),
    jobVersions: newJobVersions,
    isInitialRelease: false,
  };

  await saveVersionInfo(newVersionInfo);
  await updateChangelog(newVersion, reasons, bumpType, now);

  return newVersionInfo;
}

export async function updateChangelog(
  version: string,
  changes: string[],
  _bumpType: VersionBumpType,
  date: Date,
): Promise<void> {
  try {
    const dateString =
      date.toISOString().split("T")[0] || date.toISOString().substring(0, 10);

    const newEntry = [
      `## [${version}] - ${dateString}`,
      "",
      ...changes.map((change) => `- ${change}`),
      "",
    ].join("\n");

    let existingContent = "";
    if (existsSync(CHANGELOG_FILE_PATH)) {
      existingContent = await Bun.file(CHANGELOG_FILE_PATH).text();

      const headerEndIndex = existingContent.indexOf("\n## ");
      if (headerEndIndex !== -1) {
        const header = existingContent.substring(0, headerEndIndex + 1);
        const existingEntries = existingContent.substring(headerEndIndex + 1);
        existingContent = `${header + newEntry}\n${existingEntries}`;
      } else {
        existingContent = `${existingContent.trim()}\n\n${newEntry}`;
      }
    } else {
      existingContent = [
        "# Changelog",
        "",
        "All notable changes to the Open Parliament Romania dataset will be documented in this file.",
        "",
        "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),",
        "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).",
        "",
        newEntry,
      ].join("\n");
    }

    await Bun.write(CHANGELOG_FILE_PATH, existingContent);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update changelog: ${errorMessage}`);
  }
}
