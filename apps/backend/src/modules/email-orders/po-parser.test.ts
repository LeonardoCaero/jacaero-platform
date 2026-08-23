import { describe, expect, it } from "vitest";
import { esNumber, extractOrderNumber, extractDeclaredNumber, extractDocumentTotal } from "./po-parser.js";

describe("esNumber", () => {
  it("parses Spanish thousand/decimal separators", () => {
    expect(esNumber("2.991,50")).toBe(2991.5);
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
    expect(extractDeclaredNumber("presupuesto", "Nº presupuesto 21")).toBe("021");
  });

  it("returns undefined when the category keyword isn't present", () => {
    expect(extractDeclaredNumber("pedidoMaterial", "no reference here")).toBeUndefined();
  });
});

describe("extractDocumentTotal", () => {
  it("sums totals split across more than one 'TOTAL SIN IVA' section", () => {
    const text = "TOTAL SIN IVA... 2.089,00 €\nMATERIAL Y MANO DE OBRA... 902,00 €";
    expect(extractDocumentTotal(text)).toBeCloseTo(2991, 0);
  });

  it("reads a single 'Total horas' figure directly", () => {
    expect(extractDocumentTotal("Total horas (1.500,00 €)")).toBe(1500);
  });

  it("returns undefined when no total pattern matches", () => {
    expect(extractDocumentTotal("nothing relevant")).toBeUndefined();
  });
});
