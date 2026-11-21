// Runs Sagpat locally: `npm run dev` or `npm start`.
import { app, ready } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

await ready;
app.listen(PORT, (error) => {
  if (error) {
    console.error(error.code === "EADDRINUSE"
      ? `\n  Port ${PORT} is already in use. Is Sagpat already running in another terminal?\n  Stop it, or start on another port: PORT=3001 npm run dev\n`
      : error);
    process.exit(1);
  }
  console.log(`\n  Sagpat is running`);
  console.log(`  Shop:   http://localhost:${PORT}/`);
  console.log(`  Admin:  http://localhost:${PORT}/admin\n`);
});
