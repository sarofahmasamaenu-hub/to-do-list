import fs from "fs";
import path from "path";
import { getDbModule } from "./_db_helper";

const REVIEWS_FILE = path.join(process.cwd(), "reviews.json");
const TMP_REVIEWS_FILE = path.join("/tmp", "reviews.json");

function readReviewsFromFile(): any[] {
  try {
    if (fs.existsSync(TMP_REVIEWS_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_REVIEWS_FILE, "utf8"));
    }
    if (fs.existsSync(REVIEWS_FILE)) {
      return JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf8"));
    }
  } catch (e) {}
  return [];
}

function writeReviewsToFile(reviews: any[]) {
  try {
    fs.writeFileSync(TMP_REVIEWS_FILE, JSON.stringify(reviews));
  } catch (e) {}
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews));
  } catch (e) {}
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = await getDbModule();

    if (db.isPostgresActive()) {
      await db.initDb().catch(() => {});
    }

    if (req.method === "GET") {
      let reviews: any[] = [];
      if (db.isPostgresActive()) {
        try {
          reviews = await db.getReviewsFromDb();
        } catch (e) {
          console.error("[Vercel reviews.ts] DB read error:", e);
        }
      }
      if (!reviews || reviews.length === 0) {
        reviews = readReviewsFromFile();
      }
      return res.status(200).json(reviews || []);
    }

    if (req.method === "POST") {
      const incoming = Array.isArray(req.body) ? req.body : [];
      if (db.isPostgresActive() && incoming.length > 0) {
        try {
          await db.saveReviewsToDb(incoming);
        } catch (e) {
          console.error("[Vercel reviews.ts] DB write error:", e);
        }
      }
      if (incoming.length > 0) {
        writeReviewsToFile(incoming);
      }
      return res.status(200).json({ success: true, reviews: incoming });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[Vercel reviews.ts] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
