import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./auth-token";

let socketInstance: Socket | null = null;

export function getRealtimeSocket(): Socket {
  const token = getAccessToken();

  if (socketInstance) {
    if (socketInstance.connected) {
      return socketInstance;
    }
    // Update token before reconnecting if needed
    if (token) {
      socketInstance.auth = { token };
    }
    socketInstance.connect();
    return socketInstance;
  }

  socketInstance = io("/realtime", {
    auth: {
      token: token || "",
    },
    autoConnect: true,
    transports: ["websocket", "polling"],
  });

  socketInstance.on("connect_error", (err) => {
    // Silent debug log or handle auth errors
    if (err.message.includes("token")) {
      // Token might be expired
    }
  });

  return socketInstance;
}

export function updateSocketAuthToken(token: string | null): void {
  if (socketInstance) {
    socketInstance.auth = { token: token || "" };
    if (!socketInstance.connected && token) {
      socketInstance.connect();
    }
  }
}

export function disconnectRealtimeSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
