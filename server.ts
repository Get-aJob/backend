// require("ts-node/register");
import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./src/app";

const port = Number(process.env.PORT) || 3000;

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  path: "/socket.io",
  cors: {
    origin: [
      "https://job-moa-fe.vercel.app",
      "http://localhost:5173",
      "http://localhost:3009",
    ],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("connected", socket.id);
  socket.on("disconnect", () => {
    console.log("disconnected", socket.id);
  });
});

httpServer.listen(port, () => {
  console.log(`서버 가동 중 ${port}`);
});
