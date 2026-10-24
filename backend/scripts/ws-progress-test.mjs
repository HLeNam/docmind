// scripts/ws-progress-test.mjs — thử tay xác thực WebSocket tiến độ tài liệu.
//
// Cài (1 lần):   npm i -D socket.io-client
// Chạy:          ACCESS_TOKEN=<jwt> node scripts/ws-progress-test.mjs            # token hợp lệ
//                ACCESS_TOKEN=sai node scripts/ws-progress-test.mjs               # phải bị từ chối
//                node scripts/ws-progress-test.mjs                                # không token: bị từ chối
// Sau khi kết nối OK, upload 1 tài liệu (POST /documents) ở terminal khác và xem các event document.progress.
import { io } from 'socket.io-client';

const url = process.env.WS_URL ?? 'http://localhost:3000/realtime';
const token = process.env.ACCESS_TOKEN;

const socket = io(url, {
  auth: token ? { token } : {},
  transports: ['websocket'],
  reconnection: false,
});

socket.on('connect', () =>
  console.log(
    'connected',
    socket.id,
    '(đợi vài giây: nếu bị từ chối sẽ có auth_error)',
  ),
);
socket.on('auth_error', (e) => console.log('auth_error:', e));
socket.on('document.progress', (p) => console.log('progress:', p));
socket.on('disconnect', (reason) => {
  console.log('disconnected:', reason);
  process.exit(0);
});
socket.on('connect_error', (e) => console.log('connect_error:', e.message));
