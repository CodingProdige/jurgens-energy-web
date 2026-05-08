import { execFile } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function killPid(pid, label) {
  if (!pid || Number.isNaN(pid)) {
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
    console.log(`Stopped ${label} process ${pid}.`);
  } catch (error) {
    if (error.code === "ESRCH") {
      console.log(`${label} process ${pid} was not running.`);
      return;
    }

    throw error;
  }
}

async function killByPattern(pattern, label) {
  try {
    await execFileAsync("pkill", ["-f", pattern]);
    console.log(`Stopped ${label}.`);
  } catch (error) {
    if (error.code === 1) {
      console.log(`${label} was not running.`);
      return;
    }

    throw error;
  }
}

const lockPath = ".next/dev/lock";

if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  await killPid(Number(lock.pid), "Next dev server");

  try {
    unlinkSync(lockPath);
  } catch {
    // Next may remove the lock itself during shutdown.
  }
} else {
  console.log("Next dev server lock not found.");
}

await killByPattern("drizzle-kit.*studio", "Drizzle Studio");
