import { describe, it, expect } from "vitest";
import {
  createCollectionSchema,
  updateCollectionSchema,
} from "./collection-schemas";

describe("Collection Schemas", () => {
  describe("createCollectionSchema", () => {
    it("validates valid collection creation data", () => {
      const data = {
        name: "Dự án DocMind",
        description: "Tài liệu kỹ thuật và thiết kế",
        instructions: "Đóng vai kiến trúc sư giải pháp phần mềm",
      };

      const result = createCollectionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("requires collection name to be non-empty", () => {
      const data = {
        name: "",
        description: "Mô tả",
      };

      const result = createCollectionSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("không được để trống");
      }
    });

    it("rejects collection name longer than 200 characters", () => {
      const data = {
        name: "a".repeat(201),
      };

      const result = createCollectionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("allows optional description and instructions", () => {
      const data = {
        name: "Bộ sưu tập tối giản",
      };

      const result = createCollectionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("updateCollectionSchema", () => {
    it("validates partial update data", () => {
      const data = {
        instructions: "Hướng dẫn AI mới",
      };

      const result = updateCollectionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects empty name if name is provided", () => {
      const data = {
        name: "",
      };

      const result = updateCollectionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
