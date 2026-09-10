import fs from "fs";
import path from "path";
import { getDbModule } from "./_db_helper";

const CATALOGUE_FILE = path.join(process.cwd(), "catalogue.json");
const TMP_CATALOGUE_FILE = path.join("/tmp", "catalogue.json");

function readCatalogueFromFile(): any[] {
  try {
    if (fs.existsSync(TMP_CATALOGUE_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_CATALOGUE_FILE, "utf8"));
    }
    if (fs.existsSync(CATALOGUE_FILE)) {
      return JSON.parse(fs.readFileSync(CATALOGUE_FILE, "utf8"));
    }
  } catch (e) {}
  return [];
}

function writeCatalogueToFile(catalogue: any[]) {
  try {
    fs.writeFileSync(TMP_CATALOGUE_FILE, JSON.stringify(catalogue));
  } catch (e) {}
  try {
    fs.writeFileSync(CATALOGUE_FILE, JSON.stringify(catalogue));
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
      let catalogue: any[] = [];
      if (db.isPostgresActive()) {
        try {
          catalogue = await db.getCatalogueFromDb();
        } catch (e) {
          console.error("[Vercel catalogue.ts] DB read error:", e);
        }
      }
      if (!catalogue || catalogue.length === 0) {
        catalogue = readCatalogueFromFile();
      }
      return res.status(200).json(catalogue || []);
    }

    if (req.method === "POST") {
      const incoming = Array.isArray(req.body) ? req.body : [];
      if (db.isPostgresActive() && incoming.length > 0) {
        try {
          await db.saveCatalogueToDb(incoming);
        } catch (e) {
          console.error("[Vercel catalogue.ts] DB write error:", e);
        }
      }
      if (incoming.length > 0) {
        writeCatalogueToFile(incoming);
      }
      return res.status(200).json({ success: true, catalogue: incoming });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[Vercel catalogue.ts] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
