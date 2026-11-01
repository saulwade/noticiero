import { z } from "zod";
import { decimal, formatted } from "./decimal";
import { financeDay } from "./engine";
import { safePublicUrl } from "@/features/news/normalize";

const number = z
  .string()
  .trim()
  .regex(
    /^\d{1,12}(?:\.\d{1,8})?$/,
    "Usa números positivos con hasta ocho decimales.",
  )
  .transform((v) => formatted(decimal(v)));
const positive = number.refine(
  (v) => decimal(v) > 0n,
  "El valor debe ser mayor que cero.",
);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());
const text = z.string().trim().max(2000).default("");
const url = z
  .string()
  .max(2048)
  .refine((v) => Boolean(safePublicUrl(v)), "Usa un enlace público HTTPS.");
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa fecha AAAA-MM-DD.")
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return (
      !isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === v &&
      v >= "1970-01-01" &&
      v <= financeDay()
    );
  }, "La fecha debe existir y no estar en el futuro.");
const id = z.string().min(1).max(100);
const movement = z
  .object({
    kind: z.enum([
      "deposit",
      "withdrawal",
      "buy",
      "sell",
      "dividend",
      "interest",
      "fee",
      "tax",
      "exchange",
      "split",
    ]),
    date,
    currency: z.enum(["MXN", "USD"]),
    amount: number.default("0"),
    instrumentId: id.optional(),
    quantity: positive.optional(),
    price: positive.optional(),
    fee: number.default("0"),
    fxRate: positive.optional(),
    note: text,
    reference: z.string().trim().min(1).max(160).optional(),
  })
  .superRefine((v, c) => {
    const add = (message: string) => c.addIssue({ code: "custom", message });
    if (
      ["buy", "sell"].includes(v.kind) &&
      (!v.instrumentId || !v.quantity || !v.price)
    )
      add("Compra/venta requiere instrumento, cantidad y precio.");
    if (
      v.kind === "split" &&
      (!v.instrumentId || !v.quantity || v.amount !== "0" || v.fee !== "0")
    )
      add("Split requiere instrumento y ratio; sin importe ni comisión.");
    if (!["buy", "sell", "split"].includes(v.kind) && v.amount === "0")
      add("Falta el importe del movimiento.");
    if (
      (v.kind === "exchange" ||
        (["deposit", "withdrawal"].includes(v.kind) && v.currency === "USD")) &&
      !v.fxRate
    )
      add("Registra el tipo de cambio ejecutado MXN por USD.");
  });
export const financeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("instrument"),
    symbol: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9.^:_-]+$/),
    name: z.string().trim().min(2).max(160),
    kind: z.enum(["stock", "etf", "bond"]),
    currency: z.enum(["MXN", "USD"]),
    exchange: z.string().trim().min(2).max(80),
    fractional: z.boolean(),
    country: optional(z.string().trim().max(80)),
    sector: optional(z.string().trim().max(120)),
    sourceUrl: optional(url),
    cik: optional(
      z.string().regex(/^\d{10}$/, "CIK requiere exactamente diez dígitos."),
    ),
  }),
  movement.safeExtend({ action: z.literal("movement") }),
  z
    .object({
      action: z.literal("mark"),
      kind: z.enum(["price", "fx"]),
      instrumentId: id.optional(),
      value: positive,
      asOf: date,
      source: z.string().trim().min(2).max(160),
      sourceUrl: optional(url),
    })
    .refine(
      (v) => v.kind === "fx" || Boolean(v.instrumentId),
      "Falta el instrumento.",
    ),
  z.object({
    action: z.literal("policy"),
    monthlyContributionMxn: number,
    targets: z
      .array(
        z.object({
          instrumentId: id,
          weight: z
            .number()
            .finite()
            .min(0)
            .max(100)
            .refine(
              (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-8,
              "Máximo dos decimales en porcentajes.",
            ),
        }),
      )
      .max(10),
    approved: z.boolean(),
  }),
  z.object({
    action: z.literal("thesis"),
    instrumentId: id,
    statement: z.string().trim().min(10).max(4000),
    risks: z.string().trim().min(5).max(2000),
    invalidators: z.string().trim().min(5).max(2000),
    horizon: z.string().trim().min(2).max(200),
    sources: z
      .array(z.object({ title: z.string().trim().min(2).max(160), url }))
      .min(1)
      .max(5),
  }),
  z.object({
    action: z.literal("decision"),
    date,
    actionText: z.string().trim().min(2).max(160).optional(),
    decision: z.string().trim().min(2).max(160).optional(),
    reason: z.string().trim().min(5).max(4000),
    alternatives: text,
    revisitWhen: text,
  }),
  z.object({
    action: z.literal("import"),
    csv: z.string().min(1).max(1_000_000),
  }),
  z.object({
    action: z.literal("reverse"),
    movementId: id,
    note: z.string().trim().min(5).max(2000),
  }),
  z.object({ action: z.literal("research"), instrumentId: id }),
]);
export const movementSchema = movement;
