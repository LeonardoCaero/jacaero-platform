import { describe, expect, it } from "vitest";
import { applyReplacements, extractFields, formatAmount, formatDateEs, paragraphTexts, withMonth } from "./docx-fields.js";

const p = (...runs: string[]) => `<w:p><w:pPr/>${runs.map((r) => `<w:r><w:t>${r}</w:t></w:r>`).join("")}</w:p>`;

const factura = [
  p("FACTURA Nº  0", "01"),
  `<w:p><w:r><w:t>FECHA : 1 de sept</w:t></w:r><w:r><w:tab/><w:t>iembre 2026</w:t></w:r></w:p>`,
  p("TRABAJOS MANTENIMIENTO MES DE AGO", "STO"),
  p("Servicio mensual agosto"),
  p("Nº de pedido: 12345"),
  p("1000,00€"),
  p("IVA 21%   210,00€"),
  p("1210,00€"),
].join("");

describe("docx fields", () => {
  it("extracts the monthly values from a split-run invoice", () => {
    const f = extractFields(factura, "factura");
    expect(f.number.value).toBe("001");
    expect(f.month).toBe("agosto");
    expect(f.conceptLines.map((c) => c.value)).toEqual(["TRABAJOS MANTENIMIENTO MES DE AGOSTO", "Servicio mensual agosto"]);
    expect(f.amounts.map((a) => a.value)).toEqual(["1000,00€", "210,00€", "1210,00€"]);
  });

  it("replaces across runs without dropping tabs or other paragraphs", () => {
    const xml = p("x") + factura;
    const f = extractFields(xml, "factura");
    const out = applyReplacements(xml, [
      { paragraph: f.number.paragraph, from: "001", to: "002" },
      { paragraph: f.conceptLines[0].paragraph, from: f.conceptLines[0].value, to: withMonth(f.conceptLines[0].value, "agosto", "septiembre") },
      { paragraph: f.amounts[1].paragraph, from: "210,00€", to: formatAmount(300, "210,00€") },
    ]);
    expect(paragraphTexts(out)).toEqual([
      "x",
      "FACTURA Nº  002",
      "FECHA : 1 de septiembre 2026",
      "TRABAJOS MANTENIMIENTO MES DE SEPTIEMBRE",
      "Servicio mensual agosto",
      "Nº de pedido: 12345",
      "1000,00€",
      "IVA 21%   300,00€",
      "1210,00€",
    ]);
    expect(out).toContain("<w:tab/>");
  });

  it("formats dates and amounts like the originals", () => {
    expect(formatDateEs("2026-01-05")).toBe("5 de enero de 2026");
    expect(formatAmount(1500, "1.234,00€")).toBe("1.500,00€");
    expect(formatAmount(210.5, "12,00 €")).toBe("210,50 €");
  });
});
