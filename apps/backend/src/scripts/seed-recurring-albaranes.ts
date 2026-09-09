import fs from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

// ponytail: one-off migration, hand-verified against the real August 2026 docx
// XML for these two specific files (Word splits typed text across multiple
// <w:r> runs, so a plain string replace on the raw XML doesn't work — this
// merges each paragraph's text before searching/replacing). Not a generic docx
// templater; the actual monthly fill lives in recurring-albaranes.service.ts
// and uses docxtemplater against the clean {TAG} placeholders this produces.
// Run once after deploy: `node dist/scripts/seed-recurring-albaranes.js`.

function rebuildParagraph(para: string, newText: string): string {
  const pPr = para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const firstRun = para.match(/<w:r[ >][\s\S]*?<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  const rPr = firstRun.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  const openTag = para.match(/^<w:p[^>]*>/)?.[0] ?? "<w:p>";
  return `${openTag}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${newText}</w:t></w:r></w:p>`;
}

function normalizeAndReplace(xml: string, replacements: Record<string, string>): string {
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);

  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
    const texts = [...para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
    if (texts.length === 0) return para;

    let text = texts.join("");
    let changed = false;
    for (const key of keys) {
      if (text.includes(key)) {
        text = text.split(key).join(replacements[key]);
        changed = true;
      }
    }
    return changed ? rebuildParagraph(para, text) : para;
  });
}

function forceParagraphById(xml: string, paraId: string, newText: string): string {
  const pattern = new RegExp(`<w:p w14:paraId="${paraId}"[^>]*>[\\s\\S]*?<\\/w:p>`);
  if (!pattern.test(xml)) throw new Error(`paraId ${paraId} not found`);
  return xml.replace(pattern, (para) => rebuildParagraph(para, newText));
}

async function buildTemplate(
  relPath: string,
  dateText: string,
  monthLower: string,
  monthUpper: string,
  numberParaId: string,
): Promise<Buffer> {
  const fullPath = path.join(env.DOCS_ROOT_PATH!, relPath);
  const buffer = await fs.readFile(fullPath);
  const zip = new PizZip(buffer);
  let xml = zip.file("word/document.xml")!.asText();

  xml = normalizeAndReplace(xml, {
    [dateText]: "{FECHA}",
    [monthUpper]: "{MES_MAYUS}",
    [monthLower]: "{MES}",
  });
  xml = forceParagraphById(xml, numberParaId, "{ALBARAN_NUM}");

  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

const JOBS = [
  {
    relPath: "2026/Albaran/070 ALBARÁN MES DE AGOSTO.docx",
    orderNumber: "4500079112",
    label: "Coord. Mante. Integral",
    titleTemplate: "ALBARÁN MES DE {MES_MAYUS}",
    numberParaId: "7D182E56",
  },
  {
    relPath: "2026/Albaran/071 ALBARÁN MES DE AGOSTO (Operario Technical Services).docx",
    orderNumber: "4500079114",
    label: "Technical Services",
    titleTemplate: "ALBARÁN MES DE {MES_MAYUS} (Operario Technical Services)",
    numberParaId: "59672C99",
  },
];

async function main() {
  const clients = await prisma.client.findMany({ where: { name: { contains: "SIEGFRIED", mode: "insensitive" } } });
  if (clients.length === 0) throw new Error("Cliente Siegfried no encontrado — créalo antes de correr este script");
  if (clients.length > 1) {
    throw new Error(
      `Hay ${clients.length} clientes que coinciden con "Siegfried" (${clients.map((c) => c.id).join(", ")}) — ` +
        "borra el duplicado o ajusta este script para apuntar al id correcto antes de correrlo",
    );
  }
  const [client] = clients;

  for (const job of JOBS) {
    const templateDocx = new Uint8Array(
      await buildTemplate(job.relPath, "25 de agosto de 2026", "agosto", "AGOSTO", job.numberParaId),
    );
    await prisma.recurringAlbaranTemplate.upsert({
      where: { orderNumber: job.orderNumber },
      create: {
        clientId: client.id,
        orderNumber: job.orderNumber,
        label: job.label,
        titleTemplate: job.titleTemplate,
        templateDocx,
      },
      update: { templateDocx, titleTemplate: job.titleTemplate, label: job.label },
    });
    console.log(`Plantilla lista para el pedido ${job.orderNumber}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
