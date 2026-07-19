import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const composeProject = "jurgens_energy_selfhost";
const composeBaseArgs = ["compose", "-p", composeProject];
const composeOpsArgs = [...composeBaseArgs, "--profile", "ops"];

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(".env")) {
  throw new Error(
    "Missing .env. Copy the production server env file into the repo before deploying.",
  );
}

// Build and verify the release once before touching production data. The
// migration image reuses the exact dependency and builder layers used by web.
run("docker", [...composeOpsArgs, "build", "web", "migrate"]);

run("docker", [...composeBaseArgs, "up", "-d", "postgres", "redis"]);
run("docker", [...composeOpsArgs, "run", "--rm", "migrate"]);
run("docker", [
  ...composeOpsArgs,
  "run",
  "--rm",
  "migrate",
  "node",
  "scripts/seed-catalog.mjs",
]);

const hasTunnelToken = Boolean(process.env.CLOUDFLARE_TUNNEL_TOKEN?.trim());
const upArgs = [...composeBaseArgs];

if (hasTunnelToken) {
  upArgs.push("--profile", "tunnel");
}

// The image was built successfully above; never trigger a second build after
// applying migrations.
upArgs.push("up", "--no-build", "-d");

run("docker", upArgs);
run("docker", [
  ...composeBaseArgs,
  ...(hasTunnelToken ? ["--profile", "tunnel"] : []),
  "ps",
]);
