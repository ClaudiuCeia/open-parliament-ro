import { logger } from "./src/lib/log";
import { runScraper } from "./src/lib/runScraper";

const args = process.argv.slice(2);

// Expand combined short flags like -vf to -v -f
const expandedArgs: string[] = [];
for (const arg of args) {
  if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 2) {
    // Split combined short flags like -vf into -v -f
    for (let i = 1; i < arg.length; i++) {
      expandedArgs.push(`-${arg[i]}`);
    }
  } else {
    expandedArgs.push(arg);
  }
}

const verboseFlags = ["--verbose", "-v"];
const isVerbose = expandedArgs.some((arg) => verboseFlags.includes(arg));

const forceFlags = ["--force", "-f"];
const isForce = expandedArgs.some((arg) => forceFlags.includes(arg));

const cleanArgs = expandedArgs.filter((arg) => !verboseFlags.includes(arg) && !forceFlags.includes(arg));

if (isVerbose) {
  logger.level = "debug";
} else {
  logger.level = "info";
}

if (isVerbose) {
  console.log("[debug] Verbose mode enabled");
}
if (isForce) {
  console.log("[debug] Force mode enabled");
}

const jobDir = `${import.meta.dir}/src/jobs`;
const files = await Array.fromAsync(
  new Bun.Glob("*.{ts,js}").scan({ cwd: jobDir }),
);

const requestedJobs = cleanArgs
  .filter((arg) => arg.startsWith("--"))
  .map((arg) => arg.slice(2));

const runAll = requestedJobs.includes("all");
const specificJobs = requestedJobs.filter((job) => job !== "all");

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

if (requestedJobs.length === 0) {
  console.log("[runner] No jobs specified. Available jobs:");
  for (const [jobName, job] of availableJobs) {
    console.log(` --${jobName} (${job.name}, version: ${job.version})`);
  }
  console.log(
    "\nUsage: bun scrape [--verbose|-v] [--force|-f] --deputies --deputies_detail ...",
  );
  console.log("       bun scrape [--verbose|-v] [--force|-f] --all");
  console.log("\nOptions:");
  console.log("  --verbose, -v    Enable debug logging");
  console.log("  --force, -f      Force scrape even if cached");
  process.exit(0);
}

let jobsToRun: string[];
if (runAll) {
  jobsToRun = Array.from(availableJobs.keys());
  console.log(`[runner] Running all ${jobsToRun.length} job(s):`);
} else {
  const invalidJobs = specificJobs.filter(
    (jobName) => !availableJobs.has(jobName),
  );
  if (invalidJobs.length > 0) {
    console.error(
      `[runner] Unknown jobs: ${invalidJobs.map((j) => `--${j}`).join(", ")}`,
    );
    console.log("\nAvailable jobs:");
    for (const [jobName, job] of availableJobs) {
      console.log(` --${jobName} (${job.name}, version: ${job.version})`);
    }
    console.log(" --all");
    process.exit(1);
  }
  jobsToRun = specificJobs;
  console.log(`[runner] Running ${jobsToRun.length} job(s):`);
}

for (const jobName of jobsToRun) {
  const job = availableJobs.get(jobName);
  console.log(`\n[runner] Running: ${job.name} (version: ${job.version})`);
  
  // If force flag is set, use maxAge of 0 to bypass cache
  const maxAge = isForce ? 0 : undefined;
  await runScraper(job, maxAge);
}
