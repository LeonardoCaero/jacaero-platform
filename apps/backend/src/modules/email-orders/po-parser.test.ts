import { describe, expect, it } from "vitest";
import { esNumber, extractOrderNumber, extractDeclaredNumber, extractDocumentTotal, documentNumberFromFilename } from "./po-parser.js";

describe("esNumber", () => {
  it("parses Spanish thousand/decimal separators", () => {
    expect(esNumber("1.234,50")).toBe(1234.5);
    expect(esNumber("100")).toBe(100);
    expect(esNumber(undefined)).toBeUndefined();
  });
});

describe("extractOrderNumber", () => {
  it("matches 'Nº de pedido' with any of the accepted ordinal glyphs", () => {
    expect(extractOrderNumber("Nº de pedido: 12345")).toBe("12345");
    expect(extractOrderNumber("No de pedido 999")).toBe("999");
    expect(extractOrderNumber("no order number here")).toBeUndefined();
  });
});

describe("extractDeclaredNumber", () => {
  it("pads presupuesto numbers to 3 digits, tolerating a header/filename mismatch", () => {
    expect(extractDeclaredNumber("presupuesto", "Nº presupuesto 2")).toBe("002");
  });

  it("returns undefined when the category keyword isn't present", () => {
    expect(extractDeclaredNumber("pedidoMaterial", "no reference here")).toBeUndefined();
  });
});

describe("extractDocumentTotal", () => {
  it("sums totals split across more than one 'TOTAL SIN IVA' section", () => {
    const text = "TOTAL SIN IVA... 1.000,00 €\nMATERIAL Y MANO DE OBRA... 500,00 €";
    expect(extractDocumentTotal(text)).toBeCloseTo(1500, 0);
  });

  it("reads a single 'Total horas' figure directly", () => {
    expect(extractDocumentTotal("Total horas (1.500,00 €)")).toBe(1500);
  });

  it("returns undefined when no total pattern matches", () => {
    expect(extractDocumentTotal("nothing relevant")).toBeUndefined();
  });
});

describe("documentNumberFromFilename", () => {
  it("reads the number off sent albarán attachments", () => {
    expect(documentNumberFromFilename("001 ALBARÁN TRABAJOS EJEMPLO.pdf", "albaran")).toBe(1);
    expect(documentNumberFromFilename("002 ALBARÁN MES DE ENERO(Extra).pdf", "albaran")).toBe(2);
    expect(documentNumberFromFilename("003 HORAS ENERO.pdf", "albaran")).toBeUndefined();
    expect(documentNumberFromFilename("image001.png", "albaran")).toBeUndefined();
    expect(documentNumberFromFilename("004 PRESUPUESTO EJEMPLO.pdf", "presupuesto")).toBe(4);
    expect(documentNumberFromFilename("005 Presupuesto obra ejemplo.pdf", "presupuesto")).toBe(5);
    expect(documentNumberFromFilename("001 ALBARÁN TRABAJOS EJEMPLO.pdf", "presupuesto")).toBeUndefined();
  });
});
