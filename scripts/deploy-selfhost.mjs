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
// migration image reuses the locked dependency layer without exporting the
// full application builder filesystem.
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
// Caddy's configuration is bind-mounted, so Compose does not recreate the
// container when only the Caddyfile changes. Reload it explicitly on every
// release to ensure redirects and response headers take effect immediately.
run("docker", [
  ...composeBaseArgs,
  "exec",
  "-T",
  "caddy",
  "caddy",
  "reload",
  "--config",
  "/etc/caddy/Caddyfile",
  "--adapter",
  "caddyfile",
]);
run("docker", [
  ...composeBaseArgs,
  ...(hasTunnelToken ? ["--profile", "tunnel"] : []),
  "ps",
]);
