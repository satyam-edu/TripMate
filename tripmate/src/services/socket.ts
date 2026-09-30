import { io, type Socket } from 'socket.io-client';

// One shared live connection per login. Pages add/remove their own listeners
// with socket.on / socket.off; they never disconnect it themselves.
let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(token: string): Socket {
  if (!socket || socketToken !== token) {
    socket?.disconnect();
    socket = io(import.meta.env.VITE_API_URL, { auth: { token } });
    socketToken = token;
  }
  return socket;
}

// Called on logout.
export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
