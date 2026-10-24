// Slack có thể gửi cùng một event nhiều lần (retry khi không nhận được ack trong 3 giây, hoặc gửi trùng).
// Mỗi event có `event_id` duy nhất -> nhớ các id đã thấy trong một khoảng thời gian để không trả lời 2 lần.
//
// In-memory, theo process: đủ cho 1 instance. Chạy nhiều instance thì cần chuyển sang Redis (SET NX EX).
export class EventDeduper {
  private readonly seen = new Map<string, number>(); // id -> thời điểm hết hạn

  constructor(
    private readonly ttlMs = 10 * 60_000,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 5000,
  ) {}

  /** true nếu đây là lần ĐẦU thấy id (được xử lý); false nếu đã thấy (bỏ qua). */
  firstSeen(id: string): boolean {
    const now = this.now();
    const expiresAt = this.seen.get(id);
    if (expiresAt !== undefined && expiresAt > now) return false;

    this.seen.set(id, now + this.ttlMs);
    if (this.seen.size > this.maxEntries) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [id, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(id);
    }
    // Nếu vẫn quá lớn (toàn bộ còn hạn) thì bỏ các mục cũ nhất — Map giữ thứ tự chèn.
    while (this.seen.size > this.maxEntries) {
      const oldest = this.seen.keys().next().value as string;
      this.seen.delete(oldest);
    }
  }
}
