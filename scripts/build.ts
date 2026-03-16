#!/usr/bin/env bun
import { cp, mkdir, rename, rm } from "node:fs/promises";

type PackageJson = {
  version: string;
};

type BuildTarget = "bun-darwin-arm64" | "bun-linux-arm64" | "bun-linux-x64";

const pkg = (await Bun.file("package.json").json()) as PackageJson;
const version = pkg.version;

const targets: Array<{ target: BuildTarget; outfile: string }> = [
  { target: "bun-darwin-arm64", outfile: "dist/linear-darwin-arm64" },
  { target: "bun-linux-arm64", outfile: "dist/linear-linux-arm64" },
  { target: "bun-linux-x64", outfile: "dist/linear-linux-x64" },
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const { target, outfile } of targets) {
  console.log(`Building for ${target}...`);

  const tempOutdir = `dist/.tmp-${target}`;
  await rm(tempOutdir, { recursive: true, force: true });

  const result = await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: tempOutdir,
    compile: true,
    target: target as never,
    minify: true,
    define: {
      BUILD_VERSION: JSON.stringify(version),
    },
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log.message);
    }
    process.exit(1);
  }

  const builtOutput = result.outputs[0]?.path;
  if (!builtOutput) {
    console.error(`Build for ${target} did not produce an output file.`);
    process.exit(1);
  }

  await rename(builtOutput, outfile);
  await rm(tempOutdir, { recursive: true, force: true });

  console.log(`Built ${outfile}`);
}

await cp("SKILL.md", "dist/SKILL.md");
console.log("Copied SKILL.md to dist/");

console.log("Build complete!");
