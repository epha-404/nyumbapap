import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap(name => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? sourceFiles(child) : [child];
  });
}

describe("document storage cutover", () => {
  it("has no legacy object-storage client or environment references in backend runtime code", () => {
    const files = [...sourceFiles(join(process.cwd(), "src")), join(process.cwd(), "package.json"), join(process.cwd(), ".env.example")];
    const legacyPattern = new RegExp(["@aws-sdk", "client-s3", "S3_", "AWS_ACCESS_KEY"].join("|"), "i");
    const offenders = files.filter(file => legacyPattern.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
