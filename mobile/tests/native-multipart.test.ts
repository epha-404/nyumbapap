import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNativeFileFormData } from "@/lib/native-multipart";

type ReactNativeFormData = FormData & { getParts(): Array<Record<string, unknown>> };
const originalFormData = globalThis.FormData;

function loadReactNativeFormData(): typeof FormData {
  const require = createRequire(import.meta.url);
  const { transformSync } = require("@babel/core") as { transformSync(source: string, options: object): { code?: string } | null };
  const flowStripTypes = require("@babel/plugin-transform-flow-strip-types");
  const transformCommonJs = require("@babel/plugin-transform-modules-commonjs");
  const sourcePath = require.resolve("react-native/Libraries/Network/FormData.js");
  const source = readFileSync(sourcePath, "utf8");
  const compiled = transformSync(source, { babelrc: false, configFile: false, plugins: [[flowStripTypes, { all: true }], transformCommonJs] })?.code;
  if (!compiled) throw new Error("Could not compile React Native FormData for the regression test");
  const module = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", "require", compiled)(module, module.exports, require);
  return (module.exports.default ?? module.exports) as typeof FormData;
}

describe("native multipart file parts", () => {
  beforeEach(() => { globalThis.FormData = loadReactNativeFormData(); });
  afterEach(() => { globalThis.FormData = originalFormData; });

  it.each([
    { uri: "file:///cache/passport.pdf", name: "passport.pdf", mimeType: "application/pdf" },
    { uri: "file:///cache/national-id.png", name: "national-id.png", mimeType: "image/png" }
  ])("appends $mimeType picker assets as React Native URI parts", asset => {
    const form = createNativeFileFormData("document", [asset]) as ReactNativeFormData;
    const [part] = form.getParts();
    expect(part).toMatchObject({ uri: asset.uri, name: asset.name, type: asset.mimeType, fieldName: "document" });
    expect(part).not.toHaveProperty("blob");
    expect(part).not.toBeInstanceOf(Blob);
  });
});
