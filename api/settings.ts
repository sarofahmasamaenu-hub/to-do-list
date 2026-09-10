import fs from "fs";
import path from "path";
import { getDbModule } from "./_db_helper";

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");
const TMP_SETTINGS_FILE = path.join("/tmp", "settings.json");

function readSettingsFromFile(): any {
  try {
    if (fs.existsSync(TMP_SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_SETTINGS_FILE, "utf8"));
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    }
  } catch (e) {}
  return {};
}

function writeSettingsToFile(settings: any) {
  try {
    fs.writeFileSync(TMP_SETTINGS_FILE, JSON.stringify(settings));
  } catch (e) {}
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings));
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
      let settings: any = {};
      if (db.isPostgresActive()) {
        try {
          settings = await db.getSettingsFromDb();
        } catch (e) {
          console.error("[Vercel settings.ts] DB read error:", e);
        }
      }
      if (!settings || Object.keys(settings).length === 0) {
        settings = readSettingsFromFile();
      }
      return res.status(200).json(settings || {});
    }

    if (req.method === "POST") {
      const incoming = req.body || {};
      if (db.isPostgresActive()) {
        try {
          await db.saveSettingsToDb(incoming);
        } catch (e) {
          console.error("[Vercel settings.ts] DB write error:", e);
        }
      }
      writeSettingsToFile(incoming);
      return res.status(200).json({ success: true, settings: incoming });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[Vercel settings.ts] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
