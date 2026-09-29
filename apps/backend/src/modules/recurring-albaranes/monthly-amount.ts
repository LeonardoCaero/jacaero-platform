import { monthName } from "./docx-fields.js";

export type OrderLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  deliveryDate: Date | null;
};

export type AmountSource = "deliveryDate" | "description" | "unitPrice";

// Picks the base amount for one month out of a yearly order's lines.
export function monthlyAmountFromLines(lines: OrderLine[], period: Date): { amount: number; source: AmountSource } | null {
  const year = period.getUTCFullYear();
  const month = period.getUTCMonth();

  const byDate = lines.find(
    (l) => l.deliveryDate && l.deliveryDate.getUTCFullYear() === year && l.deliveryDate.getUTCMonth() === month,
  );
  if (byDate) return { amount: byDate.amount, source: "deliveryDate" };

  const name = monthName(month);
  const byName = lines.find((l) => new RegExp(`\\b${name}\\b`, "i").test(l.description));
  if (byName) return { amount: byName.amount, source: "description" };

  if (lines.length === 1 && lines[0].quantity > 1) return { amount: lines[0].unitPrice, source: "unitPrice" };

  return null;
}
