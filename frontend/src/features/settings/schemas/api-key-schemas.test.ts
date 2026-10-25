import { describe, it, expect } from "vitest";
import { createApiKeySchema } from "./api-key-schemas";

describe("createApiKeySchema validation", () => {
  it("accepts valid name and empty collectionId (tenant-wide scope)", () => {
    const result = createApiKeySchema.safeParse({
      name: "CI/CD Pipeline Key",
      collectionId: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid name and valid collection UUID", () => {
    const result = createApiKeySchema.safeParse({
      name: "Scoped Ingestion Key",
      collectionId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createApiKeySchema.safeParse({
      name: "   ",
      collectionId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid collection UUID", () => {
    const result = createApiKeySchema.safeParse({
      name: "Test Key",
      collectionId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
