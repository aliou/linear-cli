#!/usr/bin/env bun
/**
 * Custom version script that:
 * 1. Runs changeset version (bumps version, updates changelog)
 * 2. Updates schema metadata
 * 3. Builds binaries
 * 4. Computes hashes
 * 5. Updates flake.nix
 */
import { $ } from "bun";

type PackageJson = {
  version: string;
};

await $`bunx changeset version`;

const pkg = (await Bun.file("package.json").json()) as PackageJson;
const version = pkg.version;
console.log(`Version: ${version}`);

const schemaUrl = `https://raw.githubusercontent.com/aliou/linear-cli/v${version}/schemas/config.schema.json`;
const schema = (await Bun.file("schemas/config.schema.json").json()) as Record<
  string,
  unknown
>;
schema.$id = schemaUrl;
await Bun.write(
  "schemas/config.schema.json",
  `${JSON.stringify(schema, null, 2)}\n`,
);
console.log("Updated schemas/config.schema.json");

console.log("Building binaries...");
await $`bun run build`;

console.log("Computing hashes...");
const darwinArmHash = (
  await $`nix hash file --sri dist/linear-darwin-arm64`.text()
).trim();
const linuxArmHash = (
  await $`nix hash file --sri dist/linear-linux-arm64`.text()
).trim();
const linuxX64Hash = (
  await $`nix hash file --sri dist/linear-linux-x64`.text()
).trim();

console.log(`Darwin ARM64 hash: ${darwinArmHash}`);
console.log(`Linux ARM64 hash: ${linuxArmHash}`);
console.log(`Linux x64 hash: ${linuxX64Hash}`);

let flake = await Bun.file("flake.nix").text();
flake = flake.replace(/version = "[^"]*";/, `version = "${version}";`);
flake = flake.replace(
  /("aarch64-darwin"[\s\S]*?hash = )"sha256-[^"]*"/,
  `$1"${darwinArmHash}"`,
);
flake = flake.replace(
  /("aarch64-linux"[\s\S]*?hash = )"sha256-[^"]*"/,
  `$1"${linuxArmHash}"`,
);
flake = flake.replace(
  /("x86_64-linux"[\s\S]*?hash = )"sha256-[^"]*"/,
  `$1"${linuxX64Hash}"`,
);

await Bun.write("flake.nix", flake);
console.log("Updated flake.nix");

await $`rm -rf dist`;

console.log(`Ready to release v${version}`);
