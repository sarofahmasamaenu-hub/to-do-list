/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum OrderStatus {
  RECEIVED = "RECEIVED",                                         // 1. รับออร์เดอร์จากลูกค้าพร้อมลงระบบ
  VERIFY_DETAILS = "VERIFY_DETAILS",                             // 2. ตรวจสอบรายละเอียดพร้อมเข้าสู่การผลิต
  PREPARE_PRODUCTION = "PREPARE_PRODUCTION",                     // 3. เตรียมออร์เดอร์เข้าสู่การผลิต (พิมพ์ใบสั่งตัด)
  PATTERN_SEWING = "PATTERN_SEWING",                             // 4. ระหว่างการทำแพทเทรินและการเย็บชุด
  EMBROIDERY = "EMBROIDERY",                                     // 5. ระหว่างการปัก
  CRYSTAL_BEADING = "CRYSTAL_BEADING",                           // 6. ระหว่างการปักคริสตัล
  QA_PROCESS = "QA_PROCESS",                                     // 7. ขั้นตอนการQA
  SEND_TO_DC = "SEND_TO_DC",                                     // 8. จัดส่งสินค้าให้ศูนย์กระจายสินค้า
  RECEIVED_AT_DC_QC = "RECEIVED_AT_DC_QC",                       // 9. ได้รับสินค้าพร้อมQC
  SEND_TO_BRANCH = "SEND_TO_BRANCH",                             // 10. ส่งสินค้าไปหน้าสาขา
  BRANCH_RECEIVED_CALL_FITTING1 = "BRANCH_RECEIVED_CALL_FITTING1", // 11. ตรวจรับสินค้าพร้อมแจ้งโทรนัดลูกค้าสำหรับ FITTING DAY1
  FITTING_DONE = "FITTING_DONE",                                 // 12. ลูกค้าเข้ามาลองชุดเรียบร้อย
  NEEDS_ALTERATION = "NEEDS_ALTERATION",                         // 13. ลูกค้าต้องการแก้ไขชุด
  SEND_ALTERATION_EMS = "SEND_ALTERATION_EMS",                   // 14. จัดส่งชุดที่ต้องการแก้ไขทางส่งไปรษณีย์ (EMS)
  RECEIVED_FOR_ALTERATION = "RECEIVED_FOR_ALTERATION",           // 15. ได้รับชุดสำหรับแก้ไข Date
  IN_ALTERATION = "IN_ALTERATION",                               // 16. อยู่ระหว่างกการแก้ไขชุด
  SEND_ALTERED_EMS = "SEND_ALTERED_EMS",                         // 17. จัดส่งชุดแก้ไขเรียบร้อยแล้วทางส่งไปรษณีย์ (EMS)
  RECEIVED_ALTERED_DC = "RECEIVED_ALTERED_DC",                   // 18. ตรวจรับชุดที่แก้ไข
  SEND_ALTERED_TO_BRANCH = "SEND_ALTERED_TO_BRANCH",             // 19. จัดส่งชุดที่แก้ไขไปที่สาขา
  BRANCH_RECEIVED_ALTERED_NOTIFIED = "BRANCH_RECEIVED_ALTERED_NOTIFIED", // 20. ตรวจรับชุดที่แก้ไขแล้ว พร้อมโทรแจ้งลูกค้า
  AWAITING_PICKUP = "AWAITING_PICKUP",                           // 21. รอลูกค้ามารับชุดหน้าสาขา
  COMPLETED = "COMPLETED",                                       // 22. ลูกค้ารับชุดและจบงาน
  
  // Legacy aliases to maintain backward compatibility with previous records
  DESIGNING = "DESIGNING",
  CUTTING = "CUTTING",
  SEWING = "SEWING",
  FITTING = "FITTING",
  READY = "READY"
}

export interface StatusHistoryEntry {
  status: OrderStatus | string;
  date: string;              // วันที่เปลี่ยนสถานะ (YYYY-MM-DD)
  note?: string;             // หมายเหตุเพิ่มเติม เช่น เลขพัสดุ EMS หรือผลการฟิตติ้ง
  updatedBy?: string;        // ชื่อพนักงานที่บันทึก
  updatedAt?: string;        // ISO timestamp
}

export const PRODUCTION_PIPELINE_STEPS: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.VERIFY_DETAILS,
  OrderStatus.PREPARE_PRODUCTION,
  OrderStatus.PATTERN_SEWING,
  OrderStatus.EMBROIDERY,
  OrderStatus.CRYSTAL_BEADING,
  OrderStatus.QA_PROCESS,
  OrderStatus.SEND_TO_DC,
  OrderStatus.RECEIVED_AT_DC_QC,
  OrderStatus.SEND_TO_BRANCH,
  OrderStatus.BRANCH_RECEIVED_CALL_FITTING1,
  OrderStatus.FITTING_DONE,
  OrderStatus.NEEDS_ALTERATION,
  OrderStatus.SEND_ALTERATION_EMS,
  OrderStatus.RECEIVED_FOR_ALTERATION,
  OrderStatus.IN_ALTERATION,
  OrderStatus.SEND_ALTERED_EMS,
  OrderStatus.RECEIVED_ALTERED_DC,
  OrderStatus.SEND_ALTERED_TO_BRANCH,
  OrderStatus.BRANCH_RECEIVED_ALTERED_NOTIFIED,
  OrderStatus.AWAITING_PICKUP,
  OrderStatus.COMPLETED
];

export interface Measurements {
  chest: string;        // รอบอก (ซม.)
  waist: string;        // รอบเอว (ซม.)
  hips: string;         // รอบสะโพก (ซม.)
  shoulder: string;     // ไหล่กว้าง (ซม.)
  sleeveLength: string; // ความยาวแขน (ซม.)
  armhole: string;      // รอบวงแขน (ซม.)
  length: string;       // ความยาวชุด (ซม.)
  neck?: string;         // รอบคอ (ซม.)
  height: string;       // ส่วนสูง (ซม.)
  weight: string;       // น้ำหนัก (กก.)
  frontChest?: string;  // บ่าหน้า (ซม.)
  backChest?: string;   // บ่าหลัง (ซม.)
  frontLength?: string; // ยาวหน้า (ซม.)
  backLength?: string;  // ยาวหลัง (ซม.)
  wrist?: string;       // ข้อมือ (ซม.)
  otherNotes: string;   // รายละเอียดการวัดตัวอื่นๆ
  standardSize?: string; // ไซส์มาตรฐาน เช่น SS, S, M, L, XL
}

export interface CustomDesignDetails {
  silhouette: string;   // ทรงชุด (A-Line, Princess, Column, Mermaid, Fitted)
  neckline: string;     // คอเสื้อ (V-Neck, Round, Sweetheart, Off-shoulder, High Neck)
  sleeves: string;      // แขนเสื้อ (Sleeveless, Short, Puff, Long, Bell Sleeves)
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerNickname?: string; // ชื่อเล่น หรือ ชื่อเรียกของลูกค้า (Nickname)
  customerPhone: string;
  customerSocial?: string;    // IG, Line, FB
  dressType: string;         // เดรสราตรี, อาบายะห์, จั๊มสูท, ชุดทำงาน, เดรสสั้น, อื่นๆ
  fabricType: string;        // ชนิดผ้า (ผ้าไหม, ผ้าชีฟอง, ผ้าลูกไม้, ผ้าซาติน, ผ้าลินิน, อื่นๆ)
  fabricColor: string;       // สีผ้า
  orderDate: string;         // วันที่สั่งซื้อ YYYY-MM-DD
  deliveryDate: string;      // วันที่กำหนดส่งมอบ YYYY-MM-DD
  price: number;             // ราคาเต็ม
  deposit: number;           // มัดจำ
  discount?: number;         // ส่วนลดเพิ่มเติม
  finalPaymentAmount?: number; // ยอดเงินที่ลูกค้าชำระส่วนต่างคงเหลือ (บาท)
  finalPaymentDate?: string;   // วันที่ชำระเงินส่วนต่าง (YYYY-MM-DD)
  finalPaymentMethod?: string; // ช่องทางการชำระเงินส่วนต่างคงเหลือ (เงินโอน, เงินสด, บัตรเครดิต)
  measurements: Measurements;
  status: OrderStatus;
  statusDate?: string;       // วันที่เปลี่ยนสถานะล่าสุด (YYYY-MM-DD)
  statusHistory?: StatusHistoryEntry[]; // ประวัติและวันที่ของการเปลี่ยนสถานะในแต่ละขั้นตอน
  notes?: string;
  selectedDesignId?: string; // ไอดีแบบชุดจากแคตตาล็อก (ถ้ามี)
  sku?: string;              // รหัสสินค้า / SKU
  customDesign?: CustomDesignDetails;
  customImage?: string; // ภาพชุดอ้างอิงแนบมา (Base64 string หรือรูปภาพจากแคตตาล็อก)
  customImage2?: string; // ภาพชุดอ้างอิงแนบมา ช่องที่ 2 (Base64 string หรือรูปภาพจากแคตตาล็อก)
  customerPhotoFront?: string; // ภาพถ่ายลูกค้า ด้านหน้า (บังคับ)
  customerPhotoSide?: string;  // ภาพถ่ายลูกค้า ด้านข้าง (บังคับ)
  customerPhotoBack?: string;  // ภาพถ่ายลูกค้า ด้านหลัง (บังคับ)
  customerPhotoExtra1?: string; // ภาพถ่ายเพิ่มเติม 1 (เช่น สัดส่วน/รายละเอียดพิเศษ)
  customerPhotoExtra2?: string; // ภาพถ่ายเพิ่มเติม 2 (เช่น สัดส่วน/รายละเอียดพิเศษ)
  branch?: string;           // สาขาที่รับออเดอร์ (สาขานราธิวาส, สาขายะลา, สาขาปัตตานี, สาขาหาดใหญ่)
  staffName?: string;        // ชื่อพนักงานผู้รับออเดอร์
  staffBranch?: string;      // สาขาของพนักงานผู้รับออเดอร์
  tailorName?: string;       // ชื่อช่างตัดเย็บ / ช่างแพทเทิร์น / ผู้รับผิดชอบตัดเย็บ (Tailor / Seamstress)
  paymentMethod?: string;      // ช่องทางการชำระเงิน (เงินโอน, เงินสด, บัตรเครดิต)
  customerCategory?: string;   // ประเภทงาน เช่น IDD, IDH, ทั่วไป
  membershipTier?: 'PRIME' | 'PRIVILEGE' | 'TRADER' | 'MEMBER'; // ประเภทบัตรสมาชิก
  externalOrderId?: string;    // รหัสออเดอร์จากกัน / รหัสออเดอร์อ้างอิง
  lineUserId?: string;         // รหัส LINE User ID สำหรับติดต่อ
  slipImage?: string;          // ภาพสลิปโอนเงิน (Base64 string)
  feedbacks?: FeedbackMessage[]; // ข้อความตอบกลับ/แจ้งเตือนจากลูกค้าหรือร้านค้า
  isMatchingSet?: boolean;     // ระบุว่าเป็นงานเข้าชุด
  idhNumber?: string;          // เลข IDH สำหรับงานเข้าชุด (เช่น IDH-88)
  updatedAt?: number;          // วันที่อัปเดตล่าสุดเป็นมิลลิวินาที สำหรับใช้ซิงค์ระบบพนักงาน
  pickupSignature?: string;    // ภาพลายเซ็นลูกค้ารับมอบชุด (Base64 PNG string)
  pickupSigneeName?: string;   // ชื่อลูกค้า/ผู้รับมอบชุด
  pickupSignedAt?: string;     // วันเวลาที่เซ็นรับมอบชุด
  isLocked?: boolean;          // ล็อกออเดอร์ถาวร ห้ามแก้ไขหรือลบข้อมูล
}

export interface FeedbackMessage {
  id: string;
  sender: 'customer' | 'tailor'; // ผู้ส่ง: ลูกค้า หรือ ช่าง/ร้านค้า
  content: string;               // ข้อความ
  timestamp: string;             // วันเวลาที่ส่ง
}

export interface CustomerReview {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  dressType: string;
  rating: number;                // คะแนนดาวเฉลี่ย
  ratingDress?: number;          // คะแนนดาว - ทรงชุด (1-5)
  ratingFabric?: number;         // คะแนนดาว - คุณภาพผ้า (1-5)
  ratingService?: number;        // คะแนนดาว - บริการ (1-5)
  comment: string;               // ความคิดเห็นลูกค้า
  reviewImage?: string;          // รูปภาพรีวิว (Base64 string หรือ URL)
  tailorNote?: string;           // โน้ต/ความคิดเห็นสำหรับช่างเย็บในการปรับปรุงคูตูร์
  createdAt: string;             // วันที่สร้างรีวิว (YYYY-MM-DD)
}

export interface CatalogueItem {
  id: string;
  sku?: string;              // รหัส SKU
  name: string;
  description: string;
  priceRange: string;
  fabricRecommend: string;
  image: string;             // URL ของภาพแบบชุด
  category: string;          // หมวดหมู่ (Abaya, Evening Gown, Minimalist, Casual, Traditional)
  features: string[];        // จุดเด่นของชุด
  sizes?: string[];          // ไซส์มาตรฐานที่มีให้เลือก เช่น SS, S, M, L, XL
  sizePrices?: Record<string, number>; // ราคาสำหรับแต่ละไซส์
  tailorName?: string;       // ชื่อช่างตัดเย็บ / ช่างแพทเทิร์นผู้ออกแบบหรือรับผิดชอบแบบชุดนี้ (Tailor / Seamstress)
}

// แผนผังคำแปลและสีสถานะ
export interface StatusConfig {
  label: string;
  description: string;
  colorClass: string;        // คลาสสีพื้นหลังและตัวหนังสือสำหรับป้าย
  bgBorderClass: string;     // คลาสสำหรับการแสดงเส้นขอบการติดตาม
  textColor: string;
  icon: string;
}

export const STATUS_MAP: Record<OrderStatus, StatusConfig> = {
  [OrderStatus.RECEIVED]: {
    label: "รับออร์เดอร์จากลูกค้าพร้อมลงระบบ",
    description: "รับรายละเอียดการสั่งซื้อ สัดส่วน และบันทึกข้อมูลเข้าระบบเรียบร้อย",
    colorClass: "bg-amber-50 text-amber-900 border-amber-300",
    bgBorderClass: "border-amber-300 bg-amber-50/40",
    textColor: "text-amber-900",
    icon: "ClipboardCheck"
  },
  [OrderStatus.VERIFY_DETAILS]: {
    label: "ตรวจสอบรายละเอียดพร้อมเข้าสู่การผลิต",
    description: "ตรวจสอบความถูกต้องของสัดส่วน ชนิดผ้า และแบบชุดก่อนเริ่มผลิต",
    colorClass: "bg-orange-50 text-orange-900 border-orange-300",
    bgBorderClass: "border-orange-300 bg-orange-50/40",
    textColor: "text-orange-900",
    icon: "FileCheck"
  },
  [OrderStatus.PREPARE_PRODUCTION]: {
    label: "เตรียมออร์เดอร์เข้าสู่การผลิต (พิมพ์ใบสั่งตัด)",
    description: "พิมพ์ใบสั่งตัด เตรียมวัสดุ อุปกรณ์ และส่งต่องานเข้าห้องตัด",
    colorClass: "bg-sky-50 text-sky-900 border-sky-300",
    bgBorderClass: "border-sky-300 bg-sky-50/40",
    textColor: "text-sky-900",
    icon: "Printer"
  },
  [OrderStatus.PATTERN_SEWING]: {
    label: "ระหว่างการทำแพทเทรินและการเย็บชุด",
    description: "ช่างขึ้นแพทเทิร์น วางผ้า ตัด และขึ้นโครงเย็บประกอบชิ้นงาน",
    colorClass: "bg-indigo-50 text-indigo-900 border-indigo-300",
    bgBorderClass: "border-indigo-300 bg-indigo-50/40",
    textColor: "text-indigo-900",
    icon: "Scissors"
  },
  [OrderStatus.EMBROIDERY]: {
    label: "ระหว่างการปัก",
    description: "ช่างฝีมืออยู่ระหว่างลงลวดลายปักลายผ้าตามที่กำหนด",
    colorClass: "bg-purple-50 text-purple-900 border-purple-300",
    bgBorderClass: "border-purple-300 bg-purple-50/40",
    textColor: "text-purple-900",
    icon: "Palette"
  },
  [OrderStatus.CRYSTAL_BEADING]: {
    label: "ระหว่างการปักคริสตัล",
    description: "ช่างคูตูร์อยู่ระหว่างปักประดับคริสตัลและลูกปัดชั้นสูง",
    colorClass: "bg-fuchsia-50 text-fuchsia-900 border-fuchsia-300",
    bgBorderClass: "border-fuchsia-300 bg-fuchsia-50/40",
    textColor: "text-fuchsia-900",
    icon: "Sparkles"
  },
  [OrderStatus.QA_PROCESS]: {
    label: "ขั้นตอนการQA",
    description: "ตรวจสอบคุณภาพและความเรียบร้อยของชุดก่อนส่งออกจากแผนกตัดเย็บ",
    colorClass: "bg-cyan-50 text-cyan-900 border-cyan-300",
    bgBorderClass: "border-cyan-300 bg-cyan-50/40",
    textColor: "text-cyan-900",
    icon: "ShieldCheck"
  },
  [OrderStatus.SEND_TO_DC]: {
    label: "จัดส่งสินค้าให้ศูนย์กระจายสินค้า",
    description: "บรรจุหีบห่อและนำส่งชุดไปยังศูนย์กระจายสินค้ากลาง",
    colorClass: "bg-blue-50 text-blue-900 border-blue-300",
    bgBorderClass: "border-blue-300 bg-blue-50/40",
    textColor: "text-blue-900",
    icon: "Truck"
  },
  [OrderStatus.RECEIVED_AT_DC_QC]: {
    label: "ได้รับสินค้าพร้อมQC",
    description: "ศูนย์กระจายสินค้ารับชุดและตรวจนับเช็ค QC รอบสมบูรณ์",
    colorClass: "bg-teal-50 text-teal-900 border-teal-300",
    bgBorderClass: "border-teal-300 bg-teal-50/40",
    textColor: "text-teal-900",
    icon: "CheckSquare"
  },
  [OrderStatus.SEND_TO_BRANCH]: {
    label: "ส่งสินค้าไปหน้าสาขา",
    description: "จัดส่งสินค้าจากศูนย์กระจายสินค้ามุ่งหน้าสู่สาขาปลายทาง",
    colorClass: "bg-sky-100 text-sky-950 border-sky-300",
    bgBorderClass: "border-sky-300 bg-sky-50/40",
    textColor: "text-sky-950",
    icon: "Send"
  },
  [OrderStatus.BRANCH_RECEIVED_CALL_FITTING1]: {
    label: "ตรวจรับสินค้าพร้อมแจ้งโทรนัดลูกค้าสำหรับ FITTING DAY1",
    description: "สาขาตรวจรับชุดและโทรนัดหมายลูกค้าเข้ามาลองชุดครั้งแรก",
    colorClass: "bg-violet-50 text-violet-900 border-violet-300",
    bgBorderClass: "border-violet-300 bg-violet-50/40",
    textColor: "text-violet-900",
    icon: "PhoneCall"
  },
  [OrderStatus.FITTING_DONE]: {
    label: "ลูกค้าเข้ามาลองชุดเรียบร้อย",
    description: "ลูกค้าเดินทางเข้ามาลองชุดและตรวจดูความพอดีเรียบร้อย",
    colorClass: "bg-emerald-50 text-emerald-900 border-emerald-300",
    bgBorderClass: "border-emerald-300 bg-emerald-50/40",
    textColor: "text-emerald-900",
    icon: "UserCheck"
  },
  [OrderStatus.NEEDS_ALTERATION]: {
    label: "ลูกค้าต้องการแก้ไขชุด",
    description: "บันทึกจุดที่ต้องแก้ไขและเก็บรายละเอียดตามที่ลูกค้าต้องการ",
    colorClass: "bg-amber-50 text-amber-900 border-amber-300",
    bgBorderClass: "border-amber-300 bg-amber-50/40",
    textColor: "text-amber-900",
    icon: "AlertCircle"
  },
  [OrderStatus.SEND_ALTERATION_EMS]: {
    label: "จัดส่งชุดที่ต้องการแก้ไขทางส่งไปรษณีย์ (EMS)",
    description: "ส่งชุดที่ต้องแก้ไขไปยังช่างแก้ไขผ่านพัสดุด่วน EMS",
    colorClass: "bg-rose-50 text-rose-900 border-rose-300",
    bgBorderClass: "border-rose-300 bg-rose-50/40",
    textColor: "text-rose-900",
    icon: "Package"
  },
  [OrderStatus.RECEIVED_FOR_ALTERATION]: {
    label: "ได้รับชุดสำหรับแก้ไข Date",
    description: "ช่างแก้ไขได้รับชุดเรียบร้อยและลงบันทึกวันที่รับงานแก้",
    colorClass: "bg-pink-50 text-pink-900 border-pink-300",
    bgBorderClass: "border-pink-300 bg-pink-50/40",
    textColor: "text-pink-900",
    icon: "CalendarCheck"
  },
  [OrderStatus.IN_ALTERATION]: {
    label: "อยู่ระหว่างกการแก้ไขชุด",
    description: "ช่างอยู่ระหว่างการปรับแก้ทรงและเย็บเก็บรายละเอียด",
    colorClass: "bg-rose-100 text-rose-950 border-rose-300",
    bgBorderClass: "border-rose-300 bg-rose-50/40",
    textColor: "text-rose-950",
    icon: "Wrench"
  },
  [OrderStatus.SEND_ALTERED_EMS]: {
    label: "จัดส่งชุดแก้ไขเรียบร้อยแล้วทางส่งไปรษณีย์ (EMS)",
    description: "ส่งชุดที่แก้ไขเสร็จแล้วกลับคืนมาผ่านพัสดุด่วน EMS",
    colorClass: "bg-orange-50 text-orange-900 border-orange-300",
    bgBorderClass: "border-orange-300 bg-orange-50/40",
    textColor: "text-orange-900",
    icon: "Truck"
  },
  [OrderStatus.RECEIVED_ALTERED_DC]: {
    label: "ตรวจรับชุดที่แก้ไข",
    description: "ตรวจรับและตรวจสอบความเรียบร้อยของชุดที่แก้ไขแล้ว",
    colorClass: "bg-lime-50 text-lime-900 border-lime-300",
    bgBorderClass: "border-lime-300 bg-lime-50/40",
    textColor: "text-lime-900",
    icon: "CheckCircle"
  },
  [OrderStatus.SEND_ALTERED_TO_BRANCH]: {
    label: "จัดส่งชุดที่แก้ไขไปที่สาขา",
    description: "นำส่งชุดที่แก้ไขเสร็จสมบูรณ์ไปยังสาขาหน้าร้าน",
    colorClass: "bg-cyan-50 text-cyan-900 border-cyan-300",
    bgBorderClass: "border-cyan-300 bg-cyan-50/40",
    textColor: "text-cyan-900",
    icon: "Send"
  },
  [OrderStatus.BRANCH_RECEIVED_ALTERED_NOTIFIED]: {
    label: "ตรวจรับชุดที่แก้ไขแล้ว พร้อมโทรแจ้งลูกค้า",
    description: "สาขาตรวจรับชุดที่แก้เสร็จแล้ว และโทรนัดหมายให้ลูกค้ารับชุด",
    colorClass: "bg-emerald-50 text-emerald-900 border-emerald-300",
    bgBorderClass: "border-emerald-300 bg-emerald-50/40",
    textColor: "text-emerald-900",
    icon: "PhoneForwarded"
  },
  [OrderStatus.AWAITING_PICKUP]: {
    label: "รอลูกค้ามารับชุดหน้าสาขา",
    description: "ชุดเตรียมพร้อมที่หน้าร้าน รอลูกค้าเดินทางมารับมอบชุด",
    colorClass: "bg-amber-100 text-amber-950 border-amber-300 font-bold",
    bgBorderClass: "border-amber-300 bg-amber-50/50",
    textColor: "text-amber-950",
    icon: "Clock"
  },
  [OrderStatus.COMPLETED]: {
    label: "ลูกค้ารับชุดและจบงาน",
    description: "ลูกค้าได้รับชุดเรียบร้อย เซ็นรับมอบ และจบงานสมบูรณ์แบบ",
    colorClass: "bg-emerald-100 text-emerald-900 border-emerald-400 font-bold",
    bgBorderClass: "border-emerald-400 bg-emerald-50/60",
    textColor: "text-emerald-900",
    icon: "Sparkles"
  },

  // Fallbacks for legacy status values
  [OrderStatus.DESIGNING]: {
    label: "ออกแบบและจัดเตรียม",
    description: "กำลังวาดสเก็ตช์และคัดสรรผืนผ้า",
    colorClass: "bg-orange-50 text-orange-900 border-orange-300",
    bgBorderClass: "border-orange-300 bg-orange-50/40",
    textColor: "text-orange-900",
    icon: "Palette"
  },
  [OrderStatus.CUTTING]: {
    label: "ขึ้นแบบและตัดผ้า",
    description: "กำลังวางแพทเทิร์นลงผ้าและตัดเตรียมชิ้นส่วน",
    colorClass: "bg-indigo-50 text-indigo-900 border-indigo-300",
    bgBorderClass: "border-indigo-300 bg-indigo-50/40",
    textColor: "text-indigo-900",
    icon: "Scissors"
  },
  [OrderStatus.SEWING]: {
    label: "ขึ้นโครงและเย็บประกอบ",
    description: "ช่างฝีมืออยู่ระหว่างเย็บชิ้นส่วนเสื้อผ้า",
    colorClass: "bg-stone-100 text-stone-700 border-stone-200",
    bgBorderClass: "border-stone-300 bg-stone-50/50",
    textColor: "text-stone-700",
    icon: "Layers"
  },
  [OrderStatus.FITTING]: {
    label: "ฟิตติ้งและปรับแต่ง",
    description: "ตรวจสอบความพอดีของโครงชุด",
    colorClass: "bg-violet-50 text-violet-900 border-violet-300",
    bgBorderClass: "border-violet-300 bg-violet-50/40",
    textColor: "text-violet-900",
    icon: "Ruler"
  },
  [OrderStatus.READY]: {
    label: "ตัดเย็บเรียบร้อย",
    description: "ผ่านการตรวจสอบ QC และแพ็คเตรียมส่งมอบ",
    colorClass: "bg-emerald-50 text-emerald-900 border-emerald-300",
    bgBorderClass: "border-emerald-300 bg-emerald-50/40",
    textColor: "text-emerald-900",
    icon: "Sparkles"
  }
};

export const STANDARD_SIZE_CHART: Record<string, {
  chest: string;
  waist: string;
  hips: string;
  shoulder: string;
  sleeveLength: string;
  length: string;
}> = {
  DDS: { chest: "24", waist: "26", hips: "26", shoulder: "11", sleeveLength: "16", length: "35" },
  DDM: { chest: "26", waist: "28", hips: "28", shoulder: "12", sleeveLength: "18", length: "42" },
  DDL: { chest: "30-32", waist: "32", hips: "34", shoulder: "13", sleeveLength: "20", length: "45" },
  SS: { chest: "34", waist: "30", hips: "38", shoulder: "14", sleeveLength: "21", length: "53" },
  S: { chest: "38", waist: "34", hips: "42", shoulder: "14.5", sleeveLength: "21", length: "53" },
  M: { chest: "40", waist: "36", hips: "44", shoulder: "15", sleeveLength: "22", length: "54" },
  L: { chest: "42", waist: "38", hips: "46", shoulder: "15.5", sleeveLength: "23", length: "56" },
  XL: { chest: "44", waist: "40", hips: "48", shoulder: "16", sleeveLength: "24", length: "57" },
  "2XL": { chest: "46", waist: "42", hips: "50", shoulder: "16.5", sleeveLength: "24.5", length: "58" },
  "3XL": { chest: "48", waist: "44", hips: "52", shoulder: "17", sleeveLength: "25", length: "59" }
};

