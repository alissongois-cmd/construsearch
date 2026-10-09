import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../src/lib/cosmos.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function lookup(fetch, env = { COSMOS_API_TOKEN: "test-token", COSMOS_API_USER_AGENT: "documented-agent" }) {
  const exports = {};
  runInNewContext(source, {
    exports, fetch, process: { env }, URL, AbortSignal,
    require(name) { assert.equal(name, "server-only"); },
  });
  return exports.findCosmosThumbnail;
}

const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("uses server credentials, GTIN endpoint, no cache and a five-second timeout", async () => {
  let signal;
  const find = lookup(async (url, options) => {
    assert.equal(url, "https://api.cosmos.bluesoft.com.br/gtins/7891234567890.json");
    assert.equal(options.method, "GET");
    assert.equal(options.headers["X-Cosmos-Token"], "test-token");
    assert.equal(options.headers["User-Agent"], "documented-agent");
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    signal = options.signal;
    return response({ thumbnail: "https://images.example/product.jpg" });
  });
  assert.equal(await find("7891234567890"), "https://images.example/product.jpg");
  const start = Date.now();
  await new Promise((resolve) => {
    const keepAlive = setTimeout(() => assert.fail("timeout did not abort"), 6000);
    signal.addEventListener("abort", () => { clearTimeout(keepAlive); resolve(); }, { once: true });
  });
  assert.ok(Date.now() - start >= 4500);
  assert.equal(signal.reason.name, "TimeoutError");
});

test("missing EAN, token or User-Agent skips the API", async () => {
  const unexpected = () => assert.fail("API must not be called");
  assert.equal(await lookup(unexpected)(""), null);
  for (const env of [{}, { COSMOS_API_TOKEN: "token" }, { COSMOS_API_USER_AGENT: "agent" }, { COSMOS_API_TOKEN: " ", COSMOS_API_USER_AGENT: "agent" }]) {
    assert.equal(await lookup(unexpected, env)("7891234567890"), null);
  }
});

test("HTTP errors and API unavailability are non-fatal", async () => {
  for (const status of [404, 401, 429, 500, 503]) {
    assert.equal(await lookup(async () => response({}, status))("12345678"), null);
  }
  for (const error of [new TypeError("network unavailable"), new DOMException("timeout", "TimeoutError")]) {
    assert.equal(await lookup(async () => { throw error; })("12345678"), null);
  }
});

test("invalid JSON, invalid shape and unsafe image URLs fall back", async () => {
  assert.equal(await lookup(async () => new Response("invalid JSON"))("12345678"), null);
  for (const body of [null, [], 12, "text", {}, { thumbnail: null }, { thumbnail: 12 }, { thumbnail: "" }, { thumbnail: "relative.jpg" }, { thumbnail: "javascript:alert(1)" }, { thumbnail: "data:image/png;base64,AAAA" }, { thumbnail: "ftp://example.com/image.jpg" }]) {
    assert.equal(await lookup(async () => response(body))("12345678"), null);
  }
  assert.equal(await lookup(async () => response({ thumbnail: "http://images.example/product.jpg" }))("12345678"), "http://images.example/product.jpg");
});

const actionsSource = ts.transpileModule(
  readFileSync(new URL("../src/app/(dashboard)/admin/actions.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

async function createWithImage(thumbnail, manualImage) {
  const inserted = [];
  const uploaded = [];
  const bucket = {
    async upload(path, image) { uploaded.push({ path, image }); return { error: null }; },
    getPublicUrl() { return { data: { publicUrl: "https://storage.example/manual.jpg" } }; },
  };
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: "user-id" } } }; } },
    storage: { from() { return bucket; } },
    from(table) {
      assert.equal(table, "materiais");
      return { async insert(material) { inserted.push(material); return { error: null }; } };
    },
  };
  const exports = {};
  runInNewContext(actionsSource, {
    exports, File, crypto,
    require(name) {
      if (name === "next/cache") return { revalidatePath() {} };
      if (name === "next/navigation") return { redirect() { assert.fail("unexpected redirect"); } };
      if (name === "@/lib/cosmos") return { async findCosmosThumbnail(ean) { assert.equal(ean, "0012345678901"); return thumbnail; } };
      if (name === "@/lib/supabase/server") return { async createClient() { return supabase; } };
      assert.fail(`unexpected import: ${name}`);
    },
  });
  const form = new FormData();
  form.set("nome", "Cimento");
  form.set("categoria", "cimento");
  form.set("unidade_medida", "saco");
  form.set("ean", "00 12345-678901");
  if (manualImage) form.set("imagem", new File(["image bytes"], "material.jpg", { type: "image/jpeg" }));
  await exports.createMaterial(form);
  return { inserted, uploaded };
}

test("material registration prefers Cosmos, falls back to upload, or saves without an image", async () => {
  const automatic = await createWithImage("https://images.example/cosmos.jpg", true);
  assert.equal(automatic.inserted[0].imagem_url, "https://images.example/cosmos.jpg");
  assert.equal(automatic.uploaded.length, 0);
  const manual = await createWithImage(null, true);
  assert.equal(manual.inserted[0].imagem_url, "https://storage.example/manual.jpg");
  assert.equal(manual.uploaded.length, 1);
  assert.equal(manual.inserted[0].ean, "0012345678901");
  const noImage = await createWithImage(null, false);
  assert.equal(noImage.inserted[0].imagem_url, null);
  assert.equal(noImage.uploaded.length, 0);
});
