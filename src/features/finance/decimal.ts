// Decimal fixed point. Money and quantities are never persisted as floats.
export const SCALE = 100_000_000n;
export function decimal(value: string): bigint {
  // Public inputs are bounded in validation.ts. Intermediate products can be larger.
  if (!/^-?\d{1,100}(?:\.\d{1,8})?$/.test(value))
    throw new Error("Usa un decimal de hasta ocho cifras, sin exponentes.");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const amount = BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, "0"));
  return negative ? -amount : amount;
}
export function formatted(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const n = value < 0n ? -value : value;
  const fraction = (n % SCALE).toString().padStart(8, "0").replace(/0+$/, "");
  return `${sign}${n / SCALE}${fraction ? `.${fraction}` : ""}`;
}
function rounded(n: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) throw new Error("Divisor inválido.");
  const sign = n < 0n ? -1n : 1n;
  const a = n < 0n ? -n : n;
  return sign * ((a + divisor / 2n) / divisor);
}
export const multiply = (a: bigint, b: bigint) => rounded(a * b, SCALE);
export const divide = (a: bigint, b: bigint) => rounded(a * SCALE, b);
export const ratio = (a: bigint, b: bigint) =>
  b === 0n ? 0 : Number((a * 1_000_000n) / b) / 10_000;
