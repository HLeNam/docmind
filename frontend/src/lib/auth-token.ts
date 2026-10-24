// Quản lý Access Token trong bộ nhớ (Memory only) theo AGENTS.md mục 4.
// KHÔNG lưu trong localStorage, sessionStorage hay cookie JS.

let accessToken: string | null = null;
let lastRefreshedAt = 0;

// BroadcastChannel để đồng bộ token giữa các tab khi 1 tab refresh thành công
let authChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  authChannel = new BroadcastChannel("docmind-auth");
  authChannel.onmessage = (event) => {
    if (event.data?.type === "TOKEN_REFRESHED") {
      accessToken = event.data.token;
      lastRefreshedAt = event.data.timestamp;
    } else if (event.data?.type === "LOGOUT") {
      accessToken = null;
      lastRefreshedAt = 0;
    }
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  lastRefreshedAt = token ? Date.now() : 0;
  if (authChannel) {
    authChannel.postMessage({
      type: token ? "TOKEN_REFRESHED" : "LOGOUT",
      token,
      timestamp: lastRefreshedAt,
    });
  }
}

export function getLastRefreshedAt(): number {
  return lastRefreshedAt;
}

export function clearAccessToken(): void {
  setAccessToken(null);
}
