// Vercel entry point. vercel.json sends every request that isn't a static file
// (pages, CSS, JS and images in public/) here, and Express handles it.
import app from "../server/app.js";

export default app;
