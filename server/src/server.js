import "dotenv/config";
import http from "http";
import app from "./app.js";
import { initSocket } from "./sockets/index.js";
import { connectDB } from "./config/db.js";
import { startLockSweeper } from "./utils/lockSweeper.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing in server/.env");
  process.exit(1);
}
const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = initSocket(httpServer, process.env.CLIENT_URL);
app.set("io", io);

connectDB().then(() => {
  startLockSweeper(io);
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
