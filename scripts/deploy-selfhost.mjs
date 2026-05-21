import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const composeProject = "piessang_selfhost";
const composeBaseArgs = ["compose", "-p", composeProject];

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

run("docker", [...composeBaseArgs, "up", "-d", "postgres", "redis"]);
run("npm", ["run", "db:migrate"]);
run("npm", ["run", "db:seed:catalog"]);

const hasTunnelToken = Boolean(process.env.CLOUDFLARE_TUNNEL_TOKEN?.trim());
const upArgs = [...composeBaseArgs];

if (hasTunnelToken) {
  upArgs.push("--profile", "tunnel");
}

upArgs.push("up", "--build", "-d");

run("docker", upArgs);
run("docker", [
  ...composeBaseArgs,
  ...(hasTunnelToken ? ["--profile", "tunnel"] : []),
  "ps",
]);
