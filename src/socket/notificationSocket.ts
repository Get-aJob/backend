import type { Server } from "socket.io";

let ioInstance: Server | null = null;

/**
 * server.ts에서 Socket.IO Server 생성 직후 한 번 호출합니다.
 */
export function attachNotificationIo(io: Server) {
  ioInstance = io;
}

/**
 * 지원자(userId) 방으로 실시간 알림을 브로드캐스트합니다.
 * 프론트는 연결 후 `socket.emit("notification:subscribe", userId)` 로 동일 userId 방에 join 해야 합니다.
 */
export function emitNotificationNew(
  userId: string,
  payload: Record<string, unknown>,
) {
  if (!ioInstance) {
    return;
  }
  ioInstance.to(`user:${userId}`).emit("notification:new", payload);
}
