#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";

const port = process.env.TUNNEL_PORT || process.env.PORT || "3000";
const forceDocker = process.argv.includes("--docker");
const localOrigin = `http://localhost:${port}`;
const dockerOrigin = `http://host.docker.internal:${port}`;
const tunnelUrlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
let printedUrl = false;

function hasCommand(command) {
  const result = spawnSync("command", ["-v", command], {
    shell: true,
    stdio: "ignore",
  });

  return result.status === 0;
}

function printIntro(origin, runner) {
  console.log(`Starting Cloudflare Quick Tunnel via ${runner}.`);
  console.log(`Forwarding public HTTPS traffic to ${origin}.`);
  console.log("");
  console.log("When the trycloudflare.com URL appears, use:");
  console.log("  https://<your-tunnel>.trycloudflare.com/api/webhooks/whatsapp");
  console.log("");
  console.log("For WhatsApp checkout links, set APP_URL to the same tunnel URL");
  console.log("and restart the local dev server.");
  console.log("");
}

function onOutput(chunk) {
  const text = chunk.toString();
  const tunnelUrl = text.match(tunnelUrlPattern)?.[0];

  if (tunnelUrl && !printedUrl) {
    printedUrl = true;
    console.log("");
    console.log("Cloudflare tunnel is live:");
    console.log(`  ${tunnelUrl}`);
    console.log("");
    console.log("360dialog webhook URL:");
    console.log(`  ${tunnelUrl}/api/webhooks/whatsapp`);
    console.log("");
    console.log("Local .env while testing:");
    console.log(`  APP_URL=${tunnelUrl}`);
    console.log("");
  }
}

function run(command, args, origin, runner) {
  printIntro(origin, runner);

  const child = spawn(command, args, {
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    onOutput(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    onOutput(chunk);
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(0);
    }

    process.exit(code ?? 0);
  });
}

if (!forceDocker && hasCommand("cloudflared")) {
  run(
    "cloudflared",
    ["tunnel", "--url", localOrigin],
    localOrigin,
    "cloudflared",
  );
} else if (hasCommand("docker")) {
  run(
    "docker",
    [
      "run",
      "--rm",
      "cloudflare/cloudflared:latest",
      "tunnel",
      "--no-autoupdate",
      "--url",
      dockerOrigin,
    ],
    dockerOrigin,
    "Docker",
  );
} else {
  console.error("Could not find cloudflared or Docker.");
  console.error("");
  console.error("Install cloudflared with:");
  console.error("  brew install cloudflared");
  console.error("");
  console.error("Then run:");
  console.error("  npm run tunnel:cloudflare");
  process.exit(1);
}
