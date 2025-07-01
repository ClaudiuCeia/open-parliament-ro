import {
  writeDataPackage,
  writeDataPackageWithVersionUpdate,
} from "./src/lib/datapackage";
import { logger } from "./src/lib/log";
import { runScraper, type ScraperRunResult } from "./src/lib/runScraper";
import { updateVersionInfo, type VersionBumpType } from "./src/lib/versioning";

// Load available jobs
const jobDir = `${import.meta.dir}/src/jobs`;
const files = await Array.fromAsync(
  new Bun.Glob("*.{ts,js}").scan({ cwd: jobDir }),
);

const availableJobs = new Map();
for (const file of files) {
  const jobName = file.replace(/\.(ts|js)$/, "");
  const mod = await import(`./src/jobs/${file}`);
  if (mod?.default) {
    availableJobs.set(jobName, mod.default);
  }
}

if (availableJobs.size === 0) {
  console.error("[runner] No jobs found!");
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0];

const isVerbose = args.includes("--verbose") || args.includes("-v");
if (isVerbose) {
  logger.level = "debug";
  console.log("[debug] Verbose mode enabled");
} else {
  logger.level = "info";
}

const isForce = args.includes("--force") || args.includes("-f");

function showHelp() {
  console.log("Romania Parliament Data Scraper\n");
  console.log("USAGE");
  console.log(
    "  bun scrape jobs [--verbose|-v] [--force|-f] <job1> <job2> ...",
  );
  console.log("  bun scrape jobs [--verbose|-v] [--force|-f] --all");
  console.log("  bun scrape generate-manifest [--verbose|-v]");
  console.log("  bun scrape bump-version [--verbose|-v] <major|minor|patch>");
  console.log("  bun scrape --help");
  console.log("");
  console.log("COMMANDS");
  console.log("  jobs              Run scraping jobs");
  console.log("  generate-manifest Generate datapackage.json manifest only");
  console.log("  bump-version      Manually bump version (for damage control)");
  console.log("");
  console.log("FLAGS");
  console.log("  -v --verbose      Enable debug logging");
  console.log("  -f --force        Force scrape even if cached (jobs only)");
  console.log("  -h --help         Print this help information and exit");
  console.log("");
  console.log("VERSION BUMPING");
  console.log("  Jobs command automatically determines version bumps:");
  console.log("  - MAJOR: New scraper jobs or job version changes");
  console.log("  - MINOR: Backfilling data after 30+ day hiatus");
  console.log(
    "  - PATCH: Regular data updates (only when data actually changes)",
  );
  console.log("  - NO BUMP: When no data changes are detected");
  console.log("");
  console.log("  Manual version bumps are for damage control only.");
  console.log("  Use: bun scrape bump-version <major|minor|patch>");
  console.log("");
  console.log("Available jobs:");
  for (const [jobName, job] of availableJobs) {
    console.log(
      `  ${jobName.padEnd(20)} ${job.datapackage.title} (version: ${job.version})`,
    );
  }
}

if (args.includes("--help") || args.includes("-h") || !command) {
  showHelp();
  process.exit(0);
}

if (command === "jobs") {
  if (isForce) {
    console.log("[debug] Force mode enabled");
  }

  const jobArgs = args.slice(1).filter((arg) => !arg.startsWith("-"));
  const hasAllFlag = args.includes("--all");

  let jobsToRun: string[];

  if (hasAllFlag) {
    jobsToRun = Array.from(availableJobs.keys());
    console.log(`[runner] Running all ${jobsToRun.length} job(s):`);
  } else if (jobArgs.length > 0) {
    const invalidJobs = jobArgs.filter(
      (jobName) => !availableJobs.has(jobName),
    );
    if (invalidJobs.length > 0) {
      console.error(`[runner] Unknown jobs: ${invalidJobs.join(", ")}`);
      console.log("\nAvailable jobs:");
      for (const [jobName, job] of availableJobs) {
        console.log(
          `  ${jobName} (${job.datapackage.title}, version: ${job.version})`,
        );
      }
      process.exit(1);
    }
    jobsToRun = jobArgs;
    console.log(`[runner] Running ${jobsToRun.length} job(s):`);
  } else {
    console.log("[runner] No jobs specified. Available jobs:");
    for (const [jobName, job] of availableJobs) {
      console.log(
        `  ${jobName} (${job.datapackage.title}, version: ${job.version})`,
      );
    }
    console.log(
      "\nUsage: bun scrape jobs [--verbose|-v] [--force|-f] <job1> <job2> ...",
    );
    console.log("       bun scrape jobs [--verbose|-v] [--force|-f] --all");
    process.exit(0);
  }

  const jobResults: ScraperRunResult[] = [];

  for (const jobName of jobsToRun) {
    const job = availableJobs.get(jobName);
    console.log(
      `\n[runner] Running: ${job.datapackage.title} (version: ${job.version})`,
    );

    // If force flag is set, use maxAge of 0 to bypass cache
    const maxAge = isForce ? 0 : undefined;
    const result = await runScraper(job, maxAge);
    jobResults.push(result);
  }

  const modifiedJobs = jobResults.filter((r) => r.wasModified);

  if (modifiedJobs.length === 0) {
    console.log(
      "\n[runner] No data changes detected. Skipping version update.",
    );
    process.exit(0);
  }

  console.log(
    "\n[runner] Updating version and generating Data Package manifest...",
  );
  console.log(
    `[runner] Data changes detected in: ${modifiedJobs.map((r) => r.jobName).join(", ")}`,
  );
  try {
    await writeDataPackageWithVersionUpdate(
      availableJobs,
      "./data/datapackage.json",
      jobResults,
    );
    console.log(
      "[runner] Generated data/datapackage.json with updated version",
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      "[runner] Failed to generate datapackage.json:",
      errorMessage,
    );
    process.exit(1);
  }
} else if (command === "generate-manifest") {
  console.log("[runner] Generating Data Package manifest...");
  try {
    await writeDataPackage(availableJobs, "./data/datapackage.json");
    console.log("[runner] Generated data/datapackage.json");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      "[runner] Failed to generate datapackage.json:",
      errorMessage,
    );
    process.exit(1);
  }
} else if (command === "bump-version") {
  await handleBumpVersion(args, availableJobs);
} else {
  console.error(`[runner] Unknown command: ${command}`);
  console.log("");
  showHelp();
  process.exit(1);
}

async function handleBumpVersion(
  args: string[],
  // biome-ignore lint/suspicious/noExplicitAny: Complex type from Map, safe for internal use
  availableJobs: Map<string, any>,
) {
  const bumpTypeArg = args[1];

  if (!bumpTypeArg || !["major", "minor", "patch"].includes(bumpTypeArg)) {
    console.error("[runner] Error: bump-version requires a valid bump type");
    console.log("[runner] Usage: bun scrape bump-version <major|minor|patch>");
    process.exit(1);
  }

  const bumpType = bumpTypeArg as VersionBumpType;

  console.log(
    `\n[runner] Manual ${bumpType.toUpperCase()} version bump requested`,
  );
  console.log(
    "[runner] This should only be used for damage control after issues.",
  );

  const confirm = prompt("Are you sure you want to proceed? (y/N):");

  if (confirm?.toLowerCase() !== "y" && confirm?.toLowerCase() !== "yes") {
    console.log("[runner] Version bump cancelled");
    process.exit(0);
  }

  const reason = prompt("Please provide a reason for this version bump:");

  if (!reason || reason.trim() === "") {
    console.log("[runner] Version bump cancelled: reason is required");
    process.exit(0);
  }

  try {
    await updateVersionInfo(
      // biome-ignore lint/suspicious/noExplicitAny: Type cast for internal Map structure
      availableJobs as any,
      undefined,
      bumpType,
      reason.trim(),
    );
    // biome-ignore lint/suspicious/noExplicitAny: Type cast for internal Map structure
    await writeDataPackage(availableJobs as any, "./data/datapackage.json");

    console.log(
      `[runner] Successfully bumped version to ${bumpType} with reason: ${reason.trim()}`,
    );
    console.log("[runner] Updated datapackage.json with new version");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[runner] Failed to bump version:", errorMessage);
    process.exit(1);
  }
}
