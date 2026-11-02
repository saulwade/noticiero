import { describe, expect, it } from "vitest";
import {
  capacityFindings,
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_RECORDS,
  type StorageCapacity,
} from "@/features/storage/capacity";
const base: StorageCapacity = {
  databaseBytes: 16_000_000,
  evidenceBytes: 620_000,
  evidenceRecords: 546,
  checkedAt: "2026-11-01T18:00:00Z",
};
describe("capacidad sin eliminación", () => {
  it("admite crecimiento más allá del límite anterior y avisa antes del nuevo", () => {
    expect(MAX_EVIDENCE_RECORDS).toBe(50_000);
    expect(MAX_EVIDENCE_BYTES).toBe(64_000_000);
    expect(
      capacityFindings({
        ...base,
        evidenceRecords: 10_001,
        evidenceBytes: 16_000_001,
      }),
    ).toEqual([]);
    expect(
      capacityFindings({ ...base, evidenceRecords: 35_000 })[0],
    ).toMatchObject({
      id: "storage-evidence-records",
      message: expect.stringContaining("70%"),
    });
    expect(
      capacityFindings({ ...base, evidenceRecords: 42_500 })[0].message,
    ).toContain("Prioritario");
  });
  it("vigila por separado espacio global, bytes y registros sin modificar los datos", () => {
    const full = {
      ...base,
      databaseBytes: 850_000_000,
      evidenceBytes: 64_000_000,
      evidenceRecords: 50_000,
    };
    const saved = structuredClone(full);
    expect(capacityFindings(full).map((f) => f.id)).toEqual([
      "storage-database",
      "storage-evidence-bytes",
      "storage-evidence-records",
    ]);
    expect(full).toEqual(saved);
    expect(capacityFindings(undefined)[0].id).toBe("storage-check-failed");
  });
});
