// "Ai đang gọi" khi request đi bằng API key (tương đương AccessTokenPayload của JWT). ApiKeyGuard gắn
// object này vào request.apiKey; @CurrentApiKey() lấy ra ở controller.
export interface ApiKeyPrincipal {
  apiKeyId: string;
  keyPrefix: string;
  tenantId: string;
  /** null = key scope toàn bộ tenant; có giá trị = key chỉ được truy cập đúng collection này. */
  collectionId: string | null;
}
