import { describe, expect, it } from "vitest";
import { monthlyAmountFromLines, type OrderLine } from "./monthly-amount.js";

const line = (patch: Partial<OrderLine>): OrderLine => ({
  description: "Servicio",
  quantity: 1,
  unitPrice: 100,
  amount: 100,
  deliveryDate: null,
  ...patch,
});

const march = new Date(Date.UTC(2030, 2, 1));

describe("monthlyAmountFromLines", () => {
  it("uses the line delivered in that month", () => {
    const lines = [
      line({ amount: 100, deliveryDate: new Date(Date.UTC(2030, 1, 28)) }),
      line({ amount: 200, deliveryDate: new Date(Date.UTC(2030, 2, 31)) }),
    ];
    expect(monthlyAmountFromLines(lines, march)).toEqual({ amount: 200, source: "deliveryDate" });
  });

  it("falls back to the line that names the month", () => {
    const lines = [line({ description: "Servicio febrero", amount: 100 }), line({ description: "Servicio MARZO", amount: 300 })];
    expect(monthlyAmountFromLines(lines, march)).toEqual({ amount: 300, source: "description" });
  });

  it("uses the unit price of a single multi-month line", () => {
    expect(monthlyAmountFromLines([line({ quantity: 12, unitPrice: 50, amount: 600 })], march)).toEqual({
      amount: 50,
      source: "unitPrice",
    });
  });

  it("returns null when nothing matches", () => {
    expect(monthlyAmountFromLines([line({}), line({})], march)).toBeNull();
  });
});
