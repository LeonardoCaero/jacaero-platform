import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let root: string;
let docs: typeof import("./nas-documents.service.js");

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "docs-"));
  const folder = path.join(root, "2030", "Presupuestos");
  await fs.mkdir(folder, { recursive: true });
  for (const f of [
    "001 PRESUPUESTO EJEMPLO A.pdf",
    "001 PRESUPUESTO EJEMPLO A.docx",
    "001 PRESUPUESTO EJEMPLO B.pdf",
    "002 PRESUPUESTO EJEMPLO C.docx",
  ]) {
    await fs.writeFile(path.join(folder, f), f);
  }
  process.env.DATABASE_URL ??= "postgresql://test@localhost/test";
  process.env.JWT_SECRET ??= "x".repeat(32);
  process.env.DOCS_ROOT_PATH = root;
  docs = await import("./nas-documents.service.js");
});

afterAll(() => fs.rm(root, { recursive: true, force: true }));

describe("documents with the same number", () => {
  it("lists each file name as its own row", async () => {
    const files = await docs.listCategory("presupuesto", 2030);
    expect(files.map((f) => [f.name, f.hasPdf, f.hasDocx])).toEqual([
      ["002 PRESUPUESTO EJEMPLO C", false, true],
      ["001 PRESUPUESTO EJEMPLO A", true, true],
      ["001 PRESUPUESTO EJEMPLO B", true, false],
    ]);
  });

  it("opens the named file, or the first one by number without a name", async () => {
    const byName = await docs.getCategoryFile("presupuesto", 2030, "1", "pdf", "001 PRESUPUESTO EJEMPLO B");
    expect(path.basename(byName)).toBe("001 PRESUPUESTO EJEMPLO B.pdf");
    const byNumber = await docs.getCategoryFile("presupuesto", 2030, "1", "pdf");
    expect(path.basename(byNumber)).toMatch(/^001 PRESUPUESTO EJEMPLO [AB]\.pdf$/);
    await expect(docs.getCategoryFile("presupuesto", 2030, "1", "pdf", "../../fuera")).rejects.toThrow();
  });
});
