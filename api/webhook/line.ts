import type { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDbModule } from "../_db_helper";

const STATUS_MAP_TH: Record<string, { label: string; desc: string }> = {
  RECEIVED: { label: "1. รับออเดอร์เรียบร้อย", desc: "บันทึกข้อมูลและสัดส่วนเข้าระบบเรียบร้อยแล้ว" },
  DESIGNING: { label: "2. สรุปแบบ/เตรียมผ้า", desc: "วางแพทเทิร์น ออกแบบ และเตรียมผ้าตัดเย็บ" },
  FABRIC_ORDERED: { label: "สั่งผ้า/อะไหล่", desc: "อยู่ระหว่างรอผ้าหรืออุปกรณ์สั่งพิเศษ" },
  FABRIC_RECEIVED: { label: "ได้รับผ้าแล้ว", desc: "ผ้าและอุปกรณ์จัดเตรียมครบถ้วน พร้อมขึ้นแบบ" },
  PATTERN_MAKING: { label: "สร้างแพทเทิร์น", desc: "สร้างแบบแพทเทิร์นตามสัดส่วนเฉพาะบุคคล" },
  CUTTING: { label: "3. ขึ้นแบบและตัดผ้า", desc: "ช่างตัดผ้าตามแพทเทิร์นเรียบร้อยแล้ว" },
  SEWING: { label: "4. กำลังเย็บประกอบ", desc: "ช่างกำลังเย็บขึ้นโครงชุดและเก็บรายละเอียด" },
  PATTERN_SEWING: { label: "ทำแพทเทิร์น/ตัดเย็บ", desc: "กำลังสร้างแพทเทิร์นและเย็บประกอบชุด" },
  FIRST_FITTING_READY: { label: "พร้อมลองโครงชุด", desc: "โครงชุดพร้อมสำหรับการลองโครงครั้งที่ 1" },
  FIRST_FITTING_DONE: { label: "ลองโครงเรียบร้อย", desc: "ปรับแก้สัดส่วนตามผลการลองโครงชุด" },
  SECOND_FITTING_READY: { label: "พร้อมลองเก็บทรง", desc: "ชุดพร้อมสำหรับการลองเก็บทรงครั้งที่ 2" },
  SECOND_FITTING_DONE: { label: "ลองเก็บทรงเรียบร้อย", desc: "ปรับแต่งสัดส่วนรอบสุดท้ายก่อนเก็บรายละเอียด" },
  EMBROIDERY: { label: "งานปัก/ลูกไม้", desc: "อยู่ระหว่างงานปัก ประดับคริสตัล หรือติดลูกไม้" },
  HAND_FINISHING: { label: "สอยมือ/เก็บริม", desc: "เก็บรายละเอียดด้วยมือและงานฝีมือประณีต" },
  FITTING: { label: "5. ขั้นตอนฟิตติ้ง", desc: "นัดหมายลองชุดและปรับแต่งทรงตามรูปร่าง" },
  ALTERING: { label: "ปรับแก้ทรง", desc: "ช่างกำลังปรับแก้สัดส่วนตามที่นัดฟิตติ้ง" },
  VERIFY_DETAILS: { label: "ตรวจสอบรายละเอียด", desc: "ตรวจสอบความถูกต้องของแบบชุดและสัดส่วน" },
  QUALITY_CHECK: { label: "ตรวจเช็กคุณภาพ (QC)", desc: "ตรวจสอบความประณีตของตะเข็บ ซิป และทรงชุด" },
  IRONING_PACKING: { label: "รีดอัดและแพ็กชุด", desc: "รีดไอน้ำจัดทรงชุดและแพ็กใส่ถุงคลุมเสื้อผ้า" },
  READY: { label: "6. พร้อมส่งมอบ/รับชุด", desc: "ชุดตัดเย็บเสร็จสมบูรณ์ 100% พร้อมนัดรับชุดหรือจัดส่ง" },
  SHIPPED: { label: "จัดส่งพัสดุแล้ว", desc: "จัดส่งผ่านบริษัทขนส่งเรียบร้อยแล้ว" },
  DELIVERED: { label: "พัสดุถึงผู้รับแล้ว", desc: "พัสดุจัดส่งถึงลูกค้าเรียบร้อยแล้ว" },
  COMPLETED: { label: "7. ส่งมอบสำเร็จ 🎉", desc: "ลูกค้าตรวจรับชุดและเซ็นรับมอบเรียบร้อยแล้ว" },
  CANCELLED: { label: "ยกเลิกออเดอร์", desc: "รายการออเดอร์นี้ถูกยกเลิก" }
};

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-line-signature");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET route for testing / health check
  if (req.method === "GET") {
    const db = await getDbModule();
    return res.status(200).json({
      status: "ok",
      message: "LINE Webhook endpoint is active and ready for Messaging API events on Vercel.",
      hasToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      hasSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
      hasDatabase: db.isPostgresActive()
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await getDbModule();
    const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
    const signature = (req.headers["x-line-signature"] || req.headers["X-Line-Signature"]) as string;

    const body = req.body || {};
    const events = body.events || [];

    console.log(`[Vercel LINE Webhook] Processing ${events.length} event(s)`);

    // Verify signature if secret is provided
    if (LINE_CHANNEL_SECRET && signature) {
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const hash = crypto
        .createHmac("SHA256", LINE_CHANNEL_SECRET)
        .update(rawBody)
        .digest("base64");

      if (hash !== signature) {
        console.warn("[Vercel LINE Webhook] Signature verification mismatch warning");
      }
    }

    // Determine public URL for customer portal
    const host = req.headers["x-forwarded-host"] || req.headers.host || "to-do-list-two-lovat.vercel.app";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const baseAppUrl = `${proto}://${host}`;

    // Read live orders from database if available, or fallback to local orders.json
    let allOrders: any[] = [];
    if (db.isPostgresActive()) {
      try {
        await db.initDb().catch(() => {});
        allOrders = await db.getOrdersFromDb();
        console.log(`[Vercel LINE Webhook] Loaded ${allOrders.length} orders from PostgreSQL database.`);
      } catch (dbErr) {
        console.error("[Vercel LINE Webhook] Database query error:", dbErr);
      }
    }

    // Fallback to orders.json if database returned no orders or DB is inactive
    if (!allOrders || allOrders.length === 0) {
      try {
        const localPath = path.join(process.cwd(), "orders.json");
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, "utf-8");
          allOrders = JSON.parse(raw);
          console.log(`[Vercel LINE Webhook] Loaded ${allOrders.length} orders from orders.json fallback.`);
        }
      } catch (fsErr) {
        console.error("[Vercel LINE Webhook] orders.json read error:", fsErr);
      }
    }

    // Process each incoming event
    for (const event of events) {
      if (event.type === "message" && event.message?.type === "text") {
        const replyToken = event.replyToken;
        const originalText = (event.message.text || "").trim();
        const text = originalText.toLowerCase();
        const userId = event.source?.userId || "";

        const cleanSearch = text.replace(/[-\s]/g, "");

        // Search in real-time orders with smart regex extraction
        const phoneMatch = originalText.match(/0\d{8,9}/);
        const orderNumMatch = originalText.match(/NU-?\d{4,6}/i);
        const extractedPhone = phoneMatch ? phoneMatch[0] : "";
        const extractedOrderNum = orderNumMatch ? orderNumMatch[0].replace(/-/g, "").toLowerCase() : "";

        // Normalize text by removing common Thai titles/prefixes (e.g. คุณ, นาง, น.ส., นางสาว, ด.ญ., ด.ช., พี่, น้อง)
        const strippedTitleText = text.replace(/^(คุณ|นางสาว|น\.ส\.|นาง|นาย|ด\.ญ\.|ด\.ช\.|พี่|น้อง)\s*/i, "").trim();
        const cleanStrippedTitle = strippedTitleText.replace(/[- \s\t\n]/g, "");

        const matchedOrders = allOrders.filter((order: any) => {
          if (!order) return false;
          const phone = (order.customerPhone || "").replace(/[-\s]/g, "").toLowerCase();
          const orderNum = (order.orderNumber || "").replace(/[-\s]/g, "").toLowerCase();
          const name = (order.customerName || "").toLowerCase();
          const nameNoTitle = name.replace(/^(คุณ|นางสาว|น\.ส\.|นาง|นาย|ด\.ญ\.|ด\.ช\.|พี่|น้อง)\s*/i, "").trim();
          const nameNoSpaces = nameNoTitle.replace(/[- \s\t\n]/g, "");
          const nickname = (order.customerNickname || "").toLowerCase();
          const extId = (order.externalOrderId || "").toLowerCase();
          const lineUid = (order.lineUserId || "").toLowerCase();

          const matchesPhone = extractedPhone && phone.includes(extractedPhone);
          const matchesCleanPhone = cleanSearch.length >= 4 && phone.includes(cleanSearch);
          const matchesExtractedOrder = extractedOrderNum && orderNum.includes(extractedOrderNum);
          const matchesCleanOrder = cleanSearch.length >= 3 && orderNum.includes(cleanSearch);

          const matchesDirectName = name.includes(text) || (nameNoTitle && nameNoTitle.includes(strippedTitleText));
          const matchesNickname = nickname && (nickname.includes(text) || nickname.includes(strippedTitleText) || text.includes(nickname));
          const matchesNoSpaceName = cleanStrippedTitle.length >= 2 && nameNoSpaces.includes(cleanStrippedTitle);

          const words = text.split(/\s+/).filter((w: string) => w.length >= 2);
          const matchesNameWords = words.length > 0 && words.some((w: string) => 
            name.includes(w) || 
            nameNoTitle.includes(w) || 
            (nickname && nickname.includes(w))
          );
          
          const matchesLineUid = userId && lineUid === userId.toLowerCase();

          return (
            matchesPhone ||
            matchesCleanPhone ||
            matchesExtractedOrder ||
            matchesCleanOrder ||
            matchesDirectName ||
            matchesNickname ||
            matchesNoSpaceName ||
            matchesNameWords ||
            matchesLineUid ||
            (cleanSearch.length >= 3 && extId.includes(cleanSearch))
          );
        });

        let replyMessage = "";

        if (matchedOrders.length === 1) {
          const order = matchedOrders[0];
          const stCfg = STATUS_MAP_TH[order.status] || { label: order.status, desc: "กำลังดำเนินการ" };

          let formattedDelivery = order.deliveryDate || "-";
          try {
            formattedDelivery = new Date(order.deliveryDate).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "long",
              year: "numeric"
            });
          } catch (e) {}

          const price = Number(order.price || 0);
          const deposit = Number(order.deposit || 0);
          const discount = Number(order.discount || 0);
          const finalPaid = Number(order.finalPaymentAmount || 0);
          const unpaid = Math.max(0, price - deposit - discount - finalPaid);

          const portalUrl = `${baseAppUrl}/?mode=customer&search=${encodeURIComponent(order.customerPhone || order.orderNumber)}`;

          replyMessage = `⚜️ อัปเดตสถานะชุดสั่งตัด NUNUH Boutique ⚜️\n\n` +
            `👤 เรียนคุณ: ${order.customerName}${order.customerNickname ? ` (${order.customerNickname})` : ""}\n` +
            `🧾 รหัสออเดอร์: ${order.orderNumber}\n` +
            `👗 แบบชุด: ${order.dressType}\n` +
            `🧵 ชนิดผ้า: ${order.fabricType || "ตามที่ระบุ"} (${order.fabricColor || "-"})\n\n` +
            `📍 สถานะปัจจุบัน: [${stCfg.label}]\n` +
            `ℹ️ รายละเอียด: "${stCfg.desc}"\n` +
            `📅 วันที่อัปเดตสถานะ: ${order.statusDate || order.orderDate || "-"}\n` +
            `⏳ กำหนดส่งมอบ: ${formattedDelivery}\n\n` +
            `💰 ข้อมูลยอดเงิน:\n` +
            `• ราคารวม: ${price.toLocaleString()} บาท\n` +
            `• มัดจำแล้ว: ${deposit.toLocaleString()} บาท\n` +
            (unpaid === 0 ? `• สถานะชำระ: ชำระครบถ้วนแล้ว ✓\n\n` : `• ยอดคงเหลือวันรับชุด: ${unpaid.toLocaleString()} บาท\n\n`) +
            `🔗 ตรวจสอบรายละเอียด สัดส่วน และติดตามงานตัดเย็บด้วยตนเองได้ที่นี่ค่ะ:\n` +
            `${portalUrl}\n\n` +
            `หากท่านต้องการสอบถามข้อมูลเพิ่มเติม สามารถพิมพ์ข้อความทิ้งไว้ในแชทนี้ได้เลยนะคะ ✨`;

          // Associate lineUserId in database if not already linked
          if (userId && (!order.lineUserId || order.lineUserId !== userId)) {
            try {
              order.lineUserId = userId;
              order.updatedAt = Date.now();
              await db.saveOrderToDb(order);
            } catch (err) {}
          }
        } else if (matchedOrders.length > 1) {
          let listText = "";
          matchedOrders.slice(0, 5).forEach((order: any, idx: number) => {
            const stCfg = STATUS_MAP_TH[order.status] || { label: order.status, desc: "" };
            listText += `${idx + 1}. ออเดอร์ ${order.orderNumber} (${order.dressType})\n   📍 สถานะ: [${stCfg.label}]\n`;
          });

          const portalUrl = `${baseAppUrl}/?mode=customer&search=${encodeURIComponent(matchedOrders[0].customerPhone || matchedOrders[0].orderNumber)}`;

          replyMessage = `⚜️ พบรายการสั่งตัดของคุณทั้งหมด ${matchedOrders.length} ออเดอร์ค่ะ:\n\n${listText}\n` +
            `🔗 เปิดดูรายละเอียด สัดส่วน และสถานะทุกออเดอร์ได้ที่ลิงก์นี้เลยค่ะ:\n` +
            `${portalUrl}\n\n` +
            `ขอบพระคุณที่ไว้วางใจ NUNUH Boutique ค่ะ 💖`;
        } else {
          // No order found or customer greeting - use Gemini AI or welcoming Thai assistant message
          if (process.env.GEMINI_API_KEY) {
            try {
              const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: originalText }] }],
                    systemInstruction: {
                      parts: [
                        {
                          text: `คุณคือผู้ช่วย AI ประจำห้องเสื้อ NUNUH Boutique (ร้านตัดเย็บเสื้อผ้าสตรี ชุดเดรส ชุดราตรี ชุดเจ้าสาว ชุดลูกไม้).
ตอบลูกค้าอย่างสุภาพ อ่อนหวาน ลงท้ายด้วยค่ะ/นะคะ สั้นกระชับ 2-3 ย่อหน้า ใช้ emoji ⚜️✨👗
แจ้งลูกค้าว่าสามารถพิมพ์ "เบอร์โทรศัพท์" หรือ "เลขที่ออเดอร์" เพื่อเช็คสถานะชุดสั่งตัด สัดส่วน และกำหนดส่งมอบได้ทันทีตลอด 24 ชั่วโมงค่ะ`
                        }
                      ]
                    }
                  })
                }
              );

              if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (candidateText) {
                  replyMessage = candidateText.trim();
                }
              }
            } catch (e) {
              console.error("[Vercel LINE Webhook] Gemini AI error:", e);
            }
          }

          if (!replyMessage) {
            replyMessage =
              `สวัสดีค่ะคุณลูกค้า ⚜️ NUNUH Boutique ⚜️ ยินดีให้บริการค่ะ\n\n` +
              `📌 วิธีการตรวจสอบสถานะออเดอร์ตัดเย็บอัตโนมัติ:\n` +
              `• พิมพ์ เบอร์โทรศัพท์ ที่แจ้งไว้ตอนวัดตัว (เช่น 086-555-1234)\n` +
              `• หรือพิมพ์ เลขที่ออเดอร์ (เช่น NU-26008)\n` +
              `• หรือพิมพ์ ชื่อ-นามสกุล ของท่าน\n\n` +
              `ระบบจะส่งสถานะชุด สัดส่วน และกำหนดส่งมอบให้ท่านตรวจสอบทันทีเลยค่ะ ✨`;
          }
        }

        // Send reply to LINE Messaging API
        if (LINE_CHANNEL_ACCESS_TOKEN && replyToken) {
          try {
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
              },
              body: JSON.stringify({
                replyToken: replyToken,
                messages: [{ type: "text", text: replyMessage }]
              })
            });
          } catch (replyErr) {
            console.error("[Vercel LINE Webhook] Error replying to LINE:", replyErr);
          }
        }
      }
    }

    return res.status(200).json({ message: "OK" });
  } catch (err: any) {
    console.error("[Vercel LINE Webhook] Handler error:", err);
    return res.status(200).json({ message: "OK" });
  }
}
