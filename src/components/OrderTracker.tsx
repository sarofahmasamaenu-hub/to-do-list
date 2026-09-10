/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, STATUS_MAP, StatusConfig, CatalogueItem, PRODUCTION_PIPELINE_STEPS } from '../types';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Phone, 
  Instagram, 
  Calendar, 
  DollarSign, 
  Tag, 
  Ruler, 
  Scissors, 
  Compass, 
  Trash2,
  Check,
  CheckCircle,
  Clock,
  ArrowRight,
  MessageSquare,
  History,
  Printer,
  Camera,
  Pencil,
  Globe,
  Send,
  ExternalLink,
  Link as LinkIcon,
  Image as ImageIcon,
  PenTool,
  ShieldCheck,
  Lock,
  Bell,
  AlertTriangle,
  Star,
  Copy,
  Share2
} from 'lucide-react';
import PrintOrderModal from './PrintOrderModal';
import EditOrderModal from './EditOrderModal';
import FeedbackSection from './FeedbackSection';
import SignatureModal from './SignatureModal';
import { 
  getDaysDifference, 
  formatStatusDurationTimeline, 
  formatAllStatusDatesLog, 
  formatFullStatusHistorySummary 
} from '../utils/dateDuration';

interface OrderTrackerProps {
  orders: Order[];
  catalogue?: CatalogueItem[];
  boutiqueLogo?: string;
  boutiquePhone?: string;
  onUpdateOrderStatus: (orderId: string, nextStatus: OrderStatus, customStatusDate?: string, note?: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onEditOrder?: (updatedOrder: Order) => void;
  onConfirmPickupSignature?: (orderId: string, signatureDataUrl: string, signeeName: string, signedAt: string) => void;
}

export default function OrderTracker({ 
  orders, 
  catalogue = [], 
  boutiqueLogo,
  boutiquePhone,
  onUpdateOrderStatus, 
  onDeleteOrder, 
  onEditOrder, 
  onConfirmPickupSignature 
}: OrderTrackerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL_ACTIVE'); // ALL, ALL_ACTIVE, or specific status
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [tailorFilter, setTailorFilter] = useState<string>('ALL');

  // รายชื่อช่างตัดเย็บทั้งหมดที่มีในระบบ เพื่อใช้ในตัวกรองค้นหา
  const allTailors = useMemo(() => {
    const list = orders.map(o => o.tailorName?.trim()).filter(Boolean) as string[];
    return Array.from(new Set(list)).sort();
  }, [orders]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTab, setExportTab] = useState<'master' | 'transitions'>('master');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [signatureModalOrder, setSignatureModalOrder] = useState<Order | null>(null);

  // Quick Status Update Modal State
  const [statusModalOrder, setStatusModalOrder] = useState<Order | null>(null);
  const [statusModalTarget, setStatusModalTarget] = useState<OrderStatus>(OrderStatus.RECEIVED);
  const [statusModalDate, setStatusModalDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [statusModalNote, setStatusModalNote] = useState<string>('');
  const [statusModalSendLine, setStatusModalSendLine] = useState<boolean>(true);

  // LINE Notification Feedback Modal
  const [lineStatusModal, setLineStatusModal] = useState<{
    isOpen: boolean;
    order: Order;
    message: string;
    targetUserId: string;
    isSimulated: boolean;
    directUrl: string;
    feedbackText: string;
    isSuccess: boolean;
  } | null>(null);

  const handleOpenStatusModal = (order: Order, targetStatus?: OrderStatus) => {
    setStatusModalOrder(order);
    setStatusModalTarget(targetStatus || order.status || OrderStatus.RECEIVED);
    setStatusModalDate(order.statusDate || new Date().toISOString().split('T')[0]);
    setStatusModalNote('');
    setStatusModalSendLine(true);
  };

  const handleSaveStatusModal = () => {
    if (!statusModalOrder) return;
    const targetStatus = statusModalTarget;
    const targetDate = statusModalDate;
    const targetNote = statusModalNote.trim() || undefined;

    const updatedOrder: Order = {
      ...statusModalOrder,
      status: targetStatus,
      statusDate: targetDate,
      statusHistory: [
        ...(statusModalOrder.statusHistory || []),
        {
          status: targetStatus,
          date: targetDate,
          note: targetNote,
          updatedAt: new Date().toISOString()
        }
      ]
    };

    onUpdateOrderStatus(
      statusModalOrder.id,
      targetStatus,
      targetDate,
      targetNote
    );

    if (statusModalSendLine) {
      handleSendStatusDirectly(updatedOrder, targetNote);
    }

    setStatusModalOrder(null);
  };

  const [publicUrl, setPublicUrl] = useState(() => {
    return localStorage.getItem('nunuh_public_url') || window.location.origin;
  });
  const [showUrlSettings, setShowUrlSettings] = useState(false);

  const [lineOaId, setLineOaId] = useState(() => {
    return localStorage.getItem('nunuh_line_oa_id') || '@237aynfq';
  });

  const [lineOaChatUrl, setLineOaChatUrl] = useState(() => {
    return localStorage.getItem('nunuh_line_oa_chat_url') || 'https://chat.line.biz/U7ad64905450d2c18cf2eb27f61c5ea4c';
  });

  const [ownerLineUserId, setOwnerLineUserId] = useState(() => {
    return localStorage.getItem('nunuh_owner_line_user_id') || '';
  });
  const [isSendingOverdueAlert, setIsSendingOverdueAlert] = useState(false);
  const [overdueAlertResult, setOverdueAlertResult] = useState<{ status: 'idle' | 'success' | 'error'; msg: string } | null>(null);

  const handleSendOverdueLineAlert = async () => {
    setIsSendingOverdueAlert(true);
    setOverdueAlertResult(null);

    try {
      const res = await fetch('/api/send-overdue-line-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLineUserId: ownerLineUserId.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.simulated) {
          setOverdueAlertResult({
            status: 'success',
            msg: `🎉 แจ้งเตือนสำเร็จ! (โหมดจำลอง) พบออเดอร์เกินกำหนด ${data.overdueCount} รายการ\nข้อความสั้นที่สร้างขึ้นส่งเข้า LINE:\n${data.messageText}`
          });
        } else {
          setOverdueAlertResult({
            status: 'success',
            msg: `🎉 ส่งการแจ้งเตือนออเดอร์เกินกำหนด ${data.overdueCount} รายการ เข้า LINE เจ้าของร้านเรียบร้อยแล้วค่ะ!`
          });
        }
      } else {
        setOverdueAlertResult({
          status: 'error',
          msg: data.error || 'ไม่สามารถส่งข้อความได้ กรุณาตรวจสอบการตั้งค่า LINE User ID เจ้าของร้าน'
        });
      }
    } catch (err: any) {
      setOverdueAlertResult({
        status: 'error',
        msg: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ' + (err.message || err)
      });
    } finally {
      setIsSendingOverdueAlert(false);
    }
  };

  const [lineConfig, setLineConfig] = useState<{ tokenSet: boolean; secretSet: boolean } | null>(null);
  const [testLineUserId, setTestLineUserId] = useState('');
  const [testStatus, setTestStatus] = useState<{ status: 'idle' | 'sending' | 'success' | 'error'; errorMsg: string }>({
    status: 'idle',
    errorMsg: ''
  });

  useEffect(() => {
    fetch('/api/line-config-status')
      .then(res => res.json())
      .then(data => setLineConfig(data))
      .catch(err => console.error('Error fetching LINE config status:', err));
  }, [showUrlSettings]);

  const handleSavePublicUrl = (url: string) => {
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    setPublicUrl(cleanUrl);
    localStorage.setItem('nunuh_public_url', cleanUrl);
  };

  const handleSaveLineOaId = (id: string) => {
    const clean = id.trim();
    setLineOaId(clean);
    localStorage.setItem('nunuh_line_oa_id', clean);
  };

  const handleSaveLineOaChatUrl = (url: string) => {
    const clean = url.trim();
    setLineOaChatUrl(clean);
    localStorage.setItem('nunuh_line_oa_chat_url', clean);
  };

  const handleAdminAddFeedback = (orderId: string, content: string, sender: 'customer' | 'tailor') => {
    if (!onEditOrder) return;
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (orderToUpdate) {
      const newMsg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender,
        content,
        timestamp: new Date().toISOString()
      };
      const updatedOrder = {
        ...orderToUpdate,
        feedbacks: [...(orderToUpdate.feedbacks || []), newMsg]
      };
      onEditOrder(updatedOrder);
    }
  };

  const handleAdminDeleteFeedback = (orderId: string, messageId: string) => {
    if (!onEditOrder) return;
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (orderToUpdate) {
      const updatedOrder = {
        ...orderToUpdate,
        feedbacks: (orderToUpdate.feedbacks || []).filter(msg => msg.id !== messageId)
      };
      onEditOrder(updatedOrder);
    }
  };

  const getCustomerOtherOrders = (currentOrder: Order) => {
    const cleanPhone = currentOrder.customerPhone.replace(/[\s-()]/g, '');
    if (!cleanPhone) return [];
    return orders.filter(o => o.id !== currentOrder.id && o.customerPhone.replace(/[\s-()]/g, '') === cleanPhone);
  };

  const getSocialInfo = (socialStr?: string) => {
    if (!socialStr) return null;
    const lower = socialStr.toLowerCase();
    
    if (lower.includes('ig:') || lower.includes('instagram') || lower.includes('@') || lower.includes('ig ')) {
      return {
        type: 'instagram',
        label: socialStr,
        cleanId: socialStr.replace(/^(ig\s*[:：-]\s*|instagram\s*[:：-]\s*|@)/i, '').trim(),
        icon: <Instagram className="h-3.5 w-3.5 text-pink-600 shrink-0" />
      };
    }
    
    if (lower.includes('fb:') || lower.includes('facebook') || lower.includes('เฟส') || lower.includes('fb ')) {
      return {
        type: 'facebook',
        label: socialStr,
        cleanId: socialStr.replace(/^(fb\s*[:：-]\s*|facebook\s*[:：-]\s*|เฟสบุ๊ค\s*[:：-]\s*|เฟส\s*[:：-]\s*)/i, '').trim(),
        icon: <MessageSquare className="h-3.5 w-3.5 text-blue-600 shrink-0" />
      };
    }
    
    // Default to LINE
    const cleanId = socialStr.replace(/^(line\s*id|line|ไลน์\s*ไอดี|ไลน์|id)\s*[:：-]\s*/i, '').replace(/^@/, '').trim();
    return {
      type: 'line',
      label: socialStr,
      cleanId,
      icon: <MessageSquare className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
    };
  };

  const getLineDetails = (order: Order) => {
    const rawUserId = order.lineUserId?.trim() || '';
    const socialInfo = getSocialInfo(order.customerSocial);
    
    // Check if rawUserId is a URL or contains a real LINE User ID (starts with U and followed by alphanumeric chars)
    let extractedUserId = '';
    const matches = rawUserId.match(/U[0-9a-zA-Z]+/g);
    if (matches && matches.length > 0) {
      extractedUserId = matches[matches.length - 1];
    } else if (rawUserId.startsWith('U') || rawUserId.startsWith('u') || rawUserId.startsWith('http')) {
      extractedUserId = rawUserId;
    }
    
    const isRealUserId = !!extractedUserId && (extractedUserId.startsWith('http') || extractedUserId.length >= 8);
    
    let hasLineUserId = false;
    let lineUserId = '';
    
    let hasPersonalLineId = false;
    let personalLineId = '';
    
    if (isRealUserId) {
      hasLineUserId = true;
      lineUserId = extractedUserId;
    } else if (rawUserId && rawUserId.length > 0) {
      // If the field is filled but is not a real LINE User ID, it is a personal LINE ID!
      hasPersonalLineId = true;
      personalLineId = rawUserId.replace(/^@/, '');
    }
    
    if (socialInfo && socialInfo.type === 'line' && socialInfo.cleanId) {
      let socialExtracted = '';
      const socialMatches = socialInfo.cleanId.match(/U[0-9a-zA-Z]+/g);
      if (socialMatches && socialMatches.length > 0) {
        socialExtracted = socialMatches[socialMatches.length - 1];
      }
      
      const isSocialRealUserId = !!socialExtracted && socialExtracted.length >= 8;
      if (isSocialRealUserId) {
        if (!hasLineUserId) {
          hasLineUserId = true;
          lineUserId = socialExtracted;
          hasPersonalLineId = false;
        }
      } else if (!hasLineUserId && !hasPersonalLineId) {
        hasPersonalLineId = true;
        personalLineId = socialInfo.cleanId;
      }
    }
    
    return {
      hasLineUserId,
      lineUserId,
      hasPersonalLineId,
      personalLineId
    };
  };

  const parseLineError = (errMsgStr: string) => {
    try {
      const errorObj = typeof errMsgStr === 'string' ? JSON.parse(errMsgStr) : errMsgStr;
      const message = errorObj.message || '';
      const details = errorObj.details || [];
      const detailsStr = details.map((d: any) => `${d.property || ''}: ${d.message || ''}`).join(', ');

      if (message.includes('Failed to send messages')) {
        return '❌ LINE ปฏิเสธการส่งข้อความ: "ผู้ใช้งานรายนี้อาจจะยังไม่ได้แอดไลน์ร้านค้าเป็นเพื่อน หรือผู้ใช้งานได้บล็อกไลน์ร้านค้าไว้" (Failed to send messages)';
      }
      if (message.includes("The property 'to' is invalid") || detailsStr.includes('Invalid user ID') || message.includes('Invalid user ID')) {
        return '❌ รหัสผู้ใช้ผิดรูปแบบ หรือผู้ใช้นี้อยู่คนละผู้ให้บริการ (Invalid User ID): "โปรดตรวจสอบว่ารหัส LINE User ID ขึ้นต้นด้วยตัว U และตามด้วยตัวอักษร 32 ตัว เช่น Uf150dba359d90..."';
      }
      if (message.includes('Authentication failed') || message.includes('Invalid client credential') || message.includes('invalid client_id or client_secret')) {
        return '❌ ไม่สามารถยืนยันตัวตนกับ LINE: "รหัส Channel Access Token ของทางร้านไม่ถูกต้อง หรือหมดอายุแล้ว" (Authentication Failed)';
      }
      if (message.includes('Access to this API is not authorized')) {
        return '❌ สิทธิ์ใช้งาน API ถูกปฏิเสธ: "ช่องทางไลน์ (Channel) ของท่านยังไม่ได้เปิดใช้งานสิทธิ์ Messaging API หรือฟังก์ชัน Push Message" (403 Forbidden)';
      }
      return `❌ ข้อผิดพลาดจาก LINE API: "${message}" ${detailsStr ? `(${detailsStr})` : ''}`;
    } catch (e) {
      if (errMsgStr.includes('Failed to send messages')) {
        return '❌ LINE ปฏิเสธการส่งข้อความ: "ผู้ใช้งานรายนี้อาจจะยังไม่ได้แอดไลน์ร้านค้าเป็นเพื่อน หรือผู้ใช้งานได้บล็อกไลน์ร้านค้าไว้" (Failed to send messages)';
      }
      if (errMsgStr.includes('to is invalid') || errMsgStr.includes('Invalid user ID')) {
        return '❌ รหัสผู้ใช้ผิดรูปแบบ หรือผู้ใช้นี้อยู่คนละผู้ให้บริการ (Invalid User ID): "โปรดตรวจสอบว่ารหัส LINE User ID ขึ้นต้นด้วยตัว U และตามด้วยตัวอักษร 32 ตัว เช่น Uf150dba359d90..."';
      }
      if (errMsgStr.includes('Authentication failed') || errMsgStr.includes('Invalid client credential')) {
        return '❌ ไม่สามารถยืนยันตัวตนกับ LINE: "รหัส Channel Access Token ของทางร้านไม่ถูกต้อง หรือหมดอายุแล้ว" (Authentication Failed)';
      }
      return `❌ ข้อผิดพลาดจากระบบ: "${errMsgStr}"`;
    }
  };

  const handleTestSendLineMessage = async () => {
    if (!testLineUserId.trim()) {
      setTestStatus({ status: 'error', errorMsg: 'กรุณากรอก LINE User ID ที่ต้องการทดสอบก่อนค่ะ (รหัสขึ้นต้นด้วย U...)' });
      return;
    }
    
    const matches = testLineUserId.match(/U[0-9a-zA-Z]+/g);
    let extractedId = '';
    if (matches && matches.length > 0) {
      extractedId = matches[matches.length - 1];
    } else {
      extractedId = testLineUserId.trim();
    }

    setTestStatus({ status: 'sending', errorMsg: '' });
    try {
      const testMsg = `🌸 [ข้อความทดสอบจากระบบ NUNUH Boutique] 🌸\n\nสวัสดีค่ะ! นี่คือข้อความส่งทดสอบความถูกต้องของระบบเชื่อมต่อ LINE Messaging API อัตโนมัติค่ะ หากคุณได้รับข้อความนี้ แสดงว่าการเชื่อมต่อระบบเสร็จสมบูรณ์ 100% แล้วค่ะ! 🎉`;
      const response = await fetch('/api/send-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: extractedId,
          message: testMsg
        })
      });

      const data = await response.json();
      if (response.ok) {
        if (data.simulated) {
          setTestStatus({ 
            status: 'error', 
            errorMsg: '⚠️ ระบบทำงานในโหมดจำลองเนื่องจากยังไม่ได้ตั้งค่า Channel Access Token ใน Environment Variables ค่ะ' 
          });
        } else {
          setTestStatus({ status: 'success', errorMsg: '' });
        }
      } else {
        const rawErr = data.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
        setTestStatus({ status: 'error', errorMsg: parseLineError(rawErr) });
      }
    } catch (err: any) {
      setTestStatus({ status: 'error', errorMsg: `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ${err.message || err}` });
    }
  };

  const getDirectOaUrl = (order: Order, targetUserId?: string) => {
    const rawUserId = (targetUserId || order.lineUserId || '').trim();
    if (rawUserId.startsWith('http://') || rawUserId.startsWith('https://')) {
      return rawUserId;
    }

    // Clean user ID if it contains URL or prefix
    let cleanUserId = rawUserId;
    const userMatches = rawUserId.match(/U[0-9a-zA-Z]+/g);
    if (userMatches && userMatches.length > 0) {
      cleanUserId = userMatches[userMatches.length - 1];
    }

    // 1. If lineOaChatUrl has a shop account ID (e.g. chat.line.biz/U7ad64905450d2c18cf2eb27f61c5ea4c)
    const shopMatches = lineOaChatUrl.match(/U[0-9a-zA-Z]{32}/g);
    if (shopMatches && shopMatches.length > 0 && cleanUserId) {
      const shopId = shopMatches[0];
      return `https://chat.line.biz/${shopId}/chat/${cleanUserId}`;
    }

    // 2. Default Shop Account ID for NUNUH Boutique
    const defaultShopId = 'U7ad64905450d2c18cf2eb27f61c5ea4c';
    if (cleanUserId) {
      return `https://chat.line.biz/${defaultShopId}/chat/${cleanUserId}`;
    }

    // 3. Fallback using Account Manager ID
    const cleanId = lineOaId.startsWith('@') ? lineOaId : `@${lineOaId}`;
    if (cleanUserId) {
      return `https://manager.line.biz/account/${cleanId}/chat/user/${cleanUserId}`;
    }

    if (lineOaChatUrl && lineOaChatUrl.startsWith('http')) {
      return lineOaChatUrl;
    }
    return `https://chat.line.biz/U7ad64905450d2c18cf2eb27f61c5ea4c`;
  };

  const handleDirectLineChat = (order: Order) => {
    const currentStatusCfg = STATUS_MAP[order.status];
    const formattedDelivery = new Date(order.deliveryDate).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const portalUrl = `${publicUrl}?tab=customer&search=${encodeURIComponent(order.customerPhone)}&mode=customer`;
    const message = `⚜️ อัปเดตสถานะชุดสั่งตัด NUNUH Boutique ⚜️\n\nเรียนคุณ: ${order.customerName}\nรหัสออเดอร์: ${order.orderNumber}\nประเภทชุด: ${order.dressType}\n\n📍 สถานะปัจจุบัน: [${currentStatusCfg.label}]\n➡️ "${currentStatusCfg.description}"\n\n📅 กำหนดส่งมอบ: ${formattedDelivery}\n\nท่านสามารถตรวจสอบข้อมูลสัดส่วนและติดตามความคืบหน้าแบบละเอียดด้วยตนเองได้ที่นี่:\n🔗 ${portalUrl}\n\nขอขอบพระคุณที่เลือกใช้บริการค่ะ ✨`;

    // 1. คัดลอกข้อความลง Clipboard อัตโนมัติ เพื่อให้แอดมินนำไปวางกดส่งได้ทันที
    try {
      navigator.clipboard.writeText(message);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }

    const { hasLineUserId, lineUserId } = getLineDetails(order);
    const targetUserId = lineUserId || order.lineUserId?.trim() || '';

    if (hasLineUserId || targetUserId) {
      // ถ้ามี LINE User ID ให้เปิดห้องแชทลูกค้ารายนั้นโดยตรงบน LINE OA Manager ทันที
      const directOaUrl = getDirectOaUrl(order, targetUserId);
      
      alert(
        `📋 คัดลอกข้อความและสถานะอัปเดตของ คุณ ${order.customerName} เรียบร้อยแล้วค่ะ!\n\n` +
        `ระบบจะนำคุณไปยังห้องแชทของลูกค้ารายนี้โดยตรงในระบบ LINE OA Manager ทราบแล้วกดตกลงเพื่อเปิดแชทและนำข้อความไปวาง (Paste) ส่งคุยได้เลยค่ะ 💬`
      );
      window.open(directOaUrl, '_blank');
    } else {
      // ถ้าไม่มี LINE User ID หรือเป็นกรณีอื่นๆ ให้เปิดแผงควบคุมหลัก LINE OA แล้วแนะนำให้แอดมินค้นหาชื่อ
      const generalOaUrl = lineOaChatUrl || 'https://chat.line.biz/U7ad64905450d2c18cf2eb27f61c5ea4c';
      
      alert(
        `📋 คัดลอกข้อความและสถานะอัปเดตของ คุณ ${order.customerName} เรียบร้อยแล้วค่ะ!\n\n` +
        `เนื่องจากออเดอร์นี้ยังไม่ได้รับเชื่อมโยงข้อมูล LINE User ID ล่าสุดของลูกค้า (รหัสขึ้นต้นด้วย U...) ทำให้ระบบไม่สามารถนำทางไปยังหน้าห้องแชทของลูกค้ารายนี้โดยตรงได้\n\n` +
        `💡 วิธีเชื่อมลิงก์ไปห้องแชทของลูกค้าโดยตรงทันทีในครั้งหน้า:\n` +
        `1. ค้นหาชื่อแชท คุณ "${order.customerName}" ในหน้าแผงควบคุมหลัก LINE OA ของร้านคุณที่กำลังจะเปิดขึ้นนี้\n` +
        `2. สังเกตแถบลิงก์ (URL Address) ของเบราว์เซอร์ขณะคุยกับลูกค้าคนนี้ จะมีรหัสผู้ใช้แสดงอยู่หลังคำว่า /chat/ (เช่น Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)\n` +
        `3. คัดลอกรหัสนั้นมาใส่ในช่อง "LINE User ID" ในหน้าแก้ไขออเดอร์นี้ได้เลยค่ะ! (หรือรอให้ลูกค้าทักเข้ามาสอบถามสถานะด้วยเบอร์โทร/เลขที่ออเดอร์ผ่านแชทก่อน ระบบบอทจะบันทึกให้อัตโนมัติค่ะ)\n\n` +
        `กรุณากดตกลงเพื่อเปิดแผงแชทของร้านคุณ และกดค้นหาชื่อลูกค้าเพื่อนำข้อความที่คัดลอกไว้ไปวางส่งต่อได้ทันทีค่ะ 💬`
      );
      window.open(generalOaUrl, '_blank');
    }
  };

  const handleOpenLineOaChat = (order: Order) => {
    const { hasLineUserId, lineUserId } = getLineDetails(order);
    const targetUserId = lineUserId || order.lineUserId?.trim() || '';

    if (hasLineUserId || targetUserId) {
      const url = getDirectOaUrl(order, targetUserId);
      window.open(url, '_blank');
    } else {
      const generalOaUrl = lineOaChatUrl || 'https://chat.line.biz/U7ad64905450d2c18cf2eb27f61c5ea4c';
      window.open(generalOaUrl, '_blank');
    }
  };

  const handleSendStatusDirectly = async (order: Order, customNote?: string) => {
    const currentStatusCfg = STATUS_MAP[order.status] || { label: order.status, description: '' };
    const formattedDelivery = order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) : 'ตามตารางนัดหมาย';
    const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
    const portalUrl = `${publicUrl}?tab=customer&search=${encodeURIComponent(cleanPhone || order.orderNumber)}&mode=customer`;

    let message = `⚜️ แจ้งเตือนอัปเดตสถานะชุดสั่งตัด NUNUH Boutique ⚜️\n\n`;
    message += `เรียนคุณ: ${order.customerName}${order.customerNickname ? ` (${order.customerNickname})` : ''}\n`;
    message += `รหัสออเดอร์: ${order.orderNumber}\n`;
    message += `ประเภทชุด: ${order.dressType || 'ชุดสั่งตัด'}\n`;
    if (order.fabricType) message += `เนื้อผ้า: ${order.fabricType} ${order.fabricColor || ''}\n`;
    message += `\n📍 สถานะล่าสุด: [${currentStatusCfg.label}]\n`;
    if (currentStatusCfg.description) message += `➡️ "${currentStatusCfg.description}"\n`;
    if (customNote) message += `📌 บันทึกเพิ่มเติม: ${customNote}\n`;
    message += `\n📅 กำหนดส่งมอบ: ${formattedDelivery}\n`;
    message += `\nท่านสามารถตรวจสอบข้อมูลสัดส่วน แบบชุด และติดตามสถานะแบบละเอียดได้ที่นี่:\n🔗 ${portalUrl}\n\nขอขอบพระคุณที่ไว้วางใจ NUNUH Boutique ค่ะ ✨`;

    // คัดลอกลงคลิปบอร์ดก่อนเสมอ เพื่อความสะดวกรวดเร็ว
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(message);
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }

    const { hasLineUserId, lineUserId } = getLineDetails(order);
    const targetUserId = lineUserId || order.lineUserId?.trim() || '';
    const directOaUrl = targetUserId ? getDirectOaUrl(order, targetUserId) : (lineOaChatUrl || `https://manager.line.biz/account/${lineOaId.startsWith('@') ? lineOaId : `@${lineOaId}`}/chat/`);

    if (hasLineUserId || targetUserId) {
      // 1. กรณีเป็น LINE User ID จริง: ยิง API
      try {
        const response = await fetch('/api/send-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetUserId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerPhone: order.customerPhone,
            message
          })
        });

        const resData = await response.json().catch(() => ({}));

        if (response.ok && resData.success && !resData.simulated) {
          setLineStatusModal({
            isOpen: true,
            order,
            message,
            targetUserId,
            isSimulated: false,
            directUrl: directOaUrl,
            feedbackText: `✅ ส่งข้อความแจ้งเตือนสถานะอัตโนมัติเข้า LINE ของคุณ ${order.customerName} เรียบร้อยแล้วค่ะ! ✨`,
            isSuccess: true
          });
        } else {
          setLineStatusModal({
            isOpen: true,
            order,
            message,
            targetUserId,
            isSimulated: true,
            directUrl: directOaUrl,
            feedbackText: `📋 คัดลอกข้อความแจ้งสถานะแล้ว! (โหมดแชท LINE OA Manager) คุณสามารถเปิดห้องแชทแล้วกดวาง (Paste / Ctrl+V) เพื่อส่งให้ลูกค้าได้ทันทีค่ะ 💬`,
            isSuccess: true
          });
        }
      } catch (err: any) {
        setLineStatusModal({
          isOpen: true,
          order,
          message,
          targetUserId,
          isSimulated: true,
          directUrl: directOaUrl,
          feedbackText: `📋 คัดลอกข้อความแจ้งเตือนสถานะแล้ว! สามารถเปิดห้องแชทของลูกค้าเพื่อกดวาง (Paste) ส่งได้เลยค่ะ`,
          isSuccess: true
        });
      }
    } else {
      // 2. กรณีไม่มี LINE User ID: คัดลอกและเปิดโมดอลแนะนำ
      const cleanId = lineOaId.startsWith('@') ? lineOaId : `@${lineOaId}`;
      const generalOaUrl = lineOaChatUrl || `https://manager.line.biz/account/${cleanId}/chat/`;

      setLineStatusModal({
        isOpen: true,
        order,
        message,
        targetUserId: '',
        isSimulated: true,
        directUrl: generalOaUrl,
        feedbackText: `📋 คัดลอกข้อความแจ้งสถานะอัปเดตของ คุณ ${order.customerName} เรียบร้อยแล้วค่ะ! พร้อมเปิดแชท LINE OA เพื่อให้คุณกดวางและส่งหาลูกค้าได้ทันที 💬`,
        isSuccess: true
      });
    }
  };

  // การกรองข้อมูล
  const filteredOrders = orders.filter((order) => {
    // กรองด้วยคำค้นหา (ชื่อ ชื่อเล่น เบอร์ เลขที่ออเดอร์ ชื่อช่างตัดเย็บ หรือ SKU)
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = 
      order.customerName.toLowerCase().includes(query) ||
      (order.customerNickname && order.customerNickname.toLowerCase().includes(query)) ||
      order.customerPhone.includes(searchQuery) ||
      order.orderNumber.toLowerCase().includes(query) ||
      order.dressType.toLowerCase().includes(query) ||
      (order.tailorName && order.tailorName.toLowerCase().includes(query)) ||
      (order.staffName && order.staffName.toLowerCase().includes(query)) ||
      (order.sku && order.sku.toLowerCase().includes(query)) ||
      (order.idhNumber && order.idhNumber.toLowerCase().includes(query));

    // กรองด้วยสาขา
    const matchesBranch = branchFilter === 'ALL' || order.branch === branchFilter;

    // กรองด้วยช่างตัดเย็บ
    let matchesTailor = true;
    if (tailorFilter === 'ALL') {
      matchesTailor = true;
    } else if (tailorFilter === 'UNASSIGNED') {
      matchesTailor = !order.tailorName || order.tailorName.trim() === '';
    } else {
      matchesTailor = order.tailorName === tailorFilter;
    }

    // กรองด้วยสถานะ
    let matchesStatus = true;
    if (statusFilter === 'ALL') {
      matchesStatus = true;
    } else if (statusFilter === 'ALL_ACTIVE') {
      matchesStatus = order.status !== OrderStatus.COMPLETED;
    } else {
      matchesStatus = order.status === statusFilter;
    }

    return matchesSearch && matchesBranch && matchesTailor && matchesStatus;
  });

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const getUnpaidBalance = (order: Order) => {
    return Math.max(0, order.price - order.deposit - (order.discount || 0) - (order.finalPaymentAmount || 0));
  };

  const statusList = PRODUCTION_PIPELINE_STEPS;

  const generateTSV = () => {
    const headers = [
      'หมายเลขออเดอร์',
      'สาขา',
      'ชื่อลูกค้า',
      'เบอร์โทรศัพท์',
      'ช่องทางติดต่อ',
      'ประเภทงาน',
      'ประเภทบัตรสมาชิก',
      'รหัสออเดอร์จากกัน',
      'ช่างตัดเย็บ',
      'ประเภทชุด',
      'เนื้อผ้า',
      'เฉดสี',
      'สถานะปัจจุบัน',
      'วันที่เปลี่ยนสถานะล่าสุด',
      'จำนวนวันในสถานะปัจจุบัน (วัน)',
      'วันที่สั่งซื้อ',
      'กำหนดส่ง',
      'ระยะเวลารวมตั้งแต่สั่งตัด (วัน)',
      'วันที่เปลี่ยนสถานะทุกขั้นตอน',
      'สรุปไทม์ไลน์และระยะเวลากี่วันในแต่ละสถานะ',
      'ประวัติบันทึกสถานะและหมายเหตุทั้งหมด',
      'ราคา',
      'ส่วนลด',
      'ยอดมัดจำ',
      'ช่องทางการรับเงินมัดจำ',
      'ยอดชำระส่วนที่เหลือ',
      'วันที่ชำระเงินส่วนที่เหลือ',
      'ช่องทางชำระเงินส่วนที่เหลือ',
      'ยอดค้างชำระ',
      'อก',
      'เอว',
      'สะโพก',
      'ไหล่กว้าง',
      'ความยาวแขน',
      'รอบวงแขน',
      'ความยาวชุด',
      'ส่วนสูง',
      'น้ำหนัก',
      'บ่าหน้า',
      'บ่าหลัง',
      'ยาวหน้า',
      'ยาวหลัง',
      'ข้อมือ',
      'บันทึกสัดส่วนเพิ่มเติม',
      'หมายเหตุออเดอร์'
    ];

    const todayStr = new Date().toISOString().split('T')[0];

    const rows = orders.map(o => {
      const unpaid = Math.max(0, o.price - (o.discount || 0) - o.deposit - (o.finalPaymentAmount || 0));
      const unpaidDisplay = unpaid > 0 ? unpaid : 'ชำระเรียบร้อย';

      let pm = (o.paymentMethod || 'โอน').trim();
      if (pm === 'เงินโอน' || pm === 'โอน') {
        pm = 'โอน';
      } else if (pm === 'เงินสด') {
        pm = 'เงินสด';
      } else if (pm === 'บัตรเครดิต') {
        pm = 'บัตรเครดิต';
      } else if (pm.includes('โอน')) {
        pm = 'โอน';
      } else if (pm.includes('สด')) {
        pm = 'เงินสด';
      } else if (pm.includes('บัตร')) {
        pm = 'บัตรเครดิต';
      }

      const daysInCurrentStatus = getDaysDifference(o.statusDate || o.orderDate, todayStr);
      const totalLeadDays = getDaysDifference(
        o.orderDate, 
        o.status === OrderStatus.COMPLETED ? (o.statusDate || todayStr) : todayStr
      );
      const allDatesLog = formatAllStatusDatesLog(o);
      const timelineDurationStr = formatStatusDurationTimeline(o);
      const fullHistorySummary = formatFullStatusHistorySummary(o);

      return [
        o.orderNumber,
        o.branch || 'สาขานราธิวาส',
        o.customerName,
        o.customerPhone,
        o.customerSocial || '-',
        o.customerCategory || '-',
        o.membershipTier || '-',
        o.externalOrderId || '-',
        o.tailorName || '-',
        o.dressType,
        o.fabricType,
        o.fabricColor || '-',
        STATUS_MAP[o.status]?.label || o.status,
        o.statusDate || o.orderDate,
        daysInCurrentStatus,
        o.orderDate,
        o.deliveryDate,
        totalLeadDays,
        allDatesLog,
        timelineDurationStr,
        fullHistorySummary,
        o.price,
        o.discount || 0,
        o.deposit,
        pm,
        o.finalPaymentAmount || 0,
        o.finalPaymentDate || '-',
        o.finalPaymentMethod || '-',
        unpaidDisplay,
        o.measurements.chest,
        o.measurements.waist,
        o.measurements.hips,
        o.measurements.shoulder,
        o.measurements.sleeveLength,
        o.measurements.armhole,
        o.measurements.length,
        o.measurements.height || '-',
        o.measurements.weight || '-',
        o.measurements.frontChest || '-',
        o.measurements.backChest || '-',
        o.measurements.frontLength || '-',
        o.measurements.backLength || '-',
        o.measurements.wrist || '-',
        (o.measurements.otherNotes || '-').replace(/[\r\n\t]/g, ' '),
        (o.notes || '-').replace(/[\r\n\t]/g, ' ')
      ];
    });

    return [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
  };

  const downloadCSV = () => {
    const headers = [
      'Order Number', 'Branch', 'Customer Name', 'Phone', 'Social Contact', 'Job Type', 'Membership Card Type', 'External Order ID', 'Tailor Name', 'Dress Type', 
      'Fabric Type', 'Fabric Color', 'Current Status', 'Latest Status Date', 'Days in Current Status', 'Order Date', 'Delivery Date', 'Total Days Since Order', 
      'All Status Dates Log', 'Status Duration Timeline', 'Full History Log & Notes',
      'Price', 'Discount', 'Deposit', 'Deposit Payment Method', 'Final Payment Amount', 'Final Payment Date', 'Final Payment Method', 'Unpaid Balance', 
      'Chest', 'Waist', 'Hips', 'Shoulder', 'Sleeve Length', 'Armhole', 'Dress Length', 'Height', 'Weight', 'Front Chest', 'Back Chest', 'Front Length', 'Back Length', 'Wrist', 'Measurements Notes', 'Order Notes'
    ];

    const todayStr = new Date().toISOString().split('T')[0];

    const rows = orders.map(o => {
      const unpaid = Math.max(0, o.price - (o.discount || 0) - o.deposit - (o.finalPaymentAmount || 0));
      const unpaidDisplay = unpaid > 0 ? unpaid : 'ชำระเรียบร้อย';

      let pm = (o.paymentMethod || 'โอน').trim();
      if (pm === 'เงินโอน' || pm === 'โอน') {
        pm = 'โอน';
      } else if (pm === 'เงินสด') {
        pm = 'เงินสด';
      } else if (pm === 'บัตรเครดิต') {
        pm = 'บัตรเครดิต';
      } else if (pm.includes('โอน')) {
        pm = 'โอน';
      } else if (pm.includes('สด')) {
        pm = 'เงินสด';
      } else if (pm.includes('บัตร')) {
        pm = 'บัตรเครดิต';
      }

      const daysInCurrentStatus = getDaysDifference(o.statusDate || o.orderDate, todayStr);
      const totalLeadDays = getDaysDifference(
        o.orderDate, 
        o.status === OrderStatus.COMPLETED ? (o.statusDate || todayStr) : todayStr
      );
      const allDatesLog = formatAllStatusDatesLog(o);
      const timelineDurationStr = formatStatusDurationTimeline(o);
      const fullHistorySummary = formatFullStatusHistorySummary(o);

      return [
        `"${o.orderNumber}"`,
        `"${o.branch || 'สาขานราธิวาส'}"`,
        `"${o.customerName.replace(/"/g, '""')}"`,
        `"${o.customerPhone}"`,
        `"${(o.customerSocial || '-').replace(/"/g, '""')}"`,
        `"${o.customerCategory || '-'}"`,
        `"${o.membershipTier || '-'}"`,
        `"${o.externalOrderId || '-'}"`,
        `"${(o.tailorName || '-').replace(/"/g, '""')}"`,
        `"${o.dressType.replace(/"/g, '""')}"`,
        `"${o.fabricType.replace(/"/g, '""')}"`,
        `"${(o.fabricColor || '-').replace(/"/g, '""')}"`,
        `"${STATUS_MAP[o.status]?.label || o.status}"`,
        `"${o.statusDate || o.orderDate}"`,
        `${daysInCurrentStatus}`,
        `"${o.orderDate}"`,
        `"${o.deliveryDate}"`,
        `${totalLeadDays}`,
        `"${allDatesLog.replace(/"/g, '""')}"`,
        `"${timelineDurationStr.replace(/"/g, '""')}"`,
        `"${fullHistorySummary.replace(/"/g, '""')}"`,
        o.price,
        o.discount || 0,
        o.deposit,
        `"${pm}"`,
        o.finalPaymentAmount || 0,
        `"${o.finalPaymentDate || '-'}"`,
        `"${o.finalPaymentMethod || '-'}"`,
        typeof unpaidDisplay === 'number' ? unpaidDisplay : `"${unpaidDisplay}"`,
        `"${o.measurements.chest}"`,
        `"${o.measurements.waist}"`,
        `"${o.measurements.hips}"`,
        `"${o.measurements.shoulder}"`,
        `"${o.measurements.sleeveLength}"`,
        `"${o.measurements.armhole}"`,
        `"${o.measurements.length}"`,
        o.measurements.height || 0,
        o.measurements.weight || 0,
        `"${o.measurements.frontChest || '-'}"`,
        `"${o.measurements.backChest || '-'}"`,
        `"${o.measurements.frontLength || '-'}"`,
        `"${o.measurements.backLength || '-'}"`,
        `"${o.measurements.wrist || '-'}"`,
        `"${(o.measurements.otherNotes || '-').replace(/"/g, '""')}"`,
        `"${(o.notes || '-').replace(/"/g, '""')}"`
      ];
    });

    const content = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NUNUH_Orders_Master_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ตารางประวัติและระยะเวลาการเปลี่ยนสถานะรายขั้นตอน (Status Transition & Duration Logs)
  const generateTransitionsTSV = () => {
    const headers = [
      'หมายเลขออเดอร์',
      'สาขา',
      'ชื่อลูกค้า',
      'เบอร์โทรศัพท์',
      'ช่องทางติดต่อ',
      'ประเภทงาน',
      'ประเภทบัตรสมาชิก',
      'ช่างตัดเย็บ',
      'ประเภทชุด',
      'เนื้อผ้า',
      'เฉดสี',
      'วันที่สั่งซื้อ',
      'กำหนดส่ง',
      'ลำดับขั้นตอนที่เปลี่ยน',
      'สถานะ / ขั้นตอนการทำงาน',
      'วันที่เริ่มต้นสถานะนี้ (วันที่เปลี่ยนสถานะ)',
      'วันที่เปลี่ยนสู่สถานะถัดไป / วันปัจจุบัน',
      'ระยะเวลาที่ใช้ในสถานะนี้ (วัน)',
      'ระยะเวลารวมสะสมตั้งแต่สั่งตัดถึงขั้นตอนนี้ (วัน)',
      'สถานะของขั้นตอนนี้',
      'สถานะปัจจุบันของออเดอร์',
      'รวมระยะเวลาออเดอร์ตั้งแต่สั่งตัดจนถึงปัจจุบัน (วัน)',
      'ผู้บันทึกการเปลี่ยนสถานะ',
      'บันทึก / หมายเหตุของสถานะนั้น'
    ];

    const rows: (string | number)[][] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    orders.forEach(o => {
      const history = (o.statusHistory && o.statusHistory.length > 0)
        ? o.statusHistory
        : [{
            status: o.status,
            date: o.statusDate || o.orderDate,
            note: o.notes || '',
            updatedBy: o.staffName || 'พนักงาน'
          }];

      const totalOrderDays = getDaysDifference(
        o.orderDate, 
        o.status === OrderStatus.COMPLETED ? (o.statusDate || todayStr) : todayStr
      );

      history.forEach((h, idx) => {
        const isLast = idx === history.length - 1;
        const nextDate = isLast
          ? (o.status === OrderStatus.COMPLETED ? (o.statusDate || h.date) : todayStr)
          : history[idx + 1].date;

        const daysInStage = getDaysDifference(h.date, nextDate);
        const cumulativeDays = getDaysDifference(o.orderDate, nextDate);
        const statusLabel = STATUS_MAP[h.status as OrderStatus]?.label || h.status;
        const currentOrderStatusLabel = STATUS_MAP[o.status as OrderStatus]?.label || o.status;
        const progressLabel = isLast
          ? (o.status === OrderStatus.COMPLETED ? 'เสร็จสิ้นสมบูรณ์' : 'กำลังดำเนินการ (สถานะปัจจุบัน)')
          : 'ผ่านขั้นตอนนี้แล้ว';

        rows.push([
          o.orderNumber,
          o.branch || 'สาขานราธิวาส',
          o.customerName,
          o.customerPhone,
          o.customerSocial || '-',
          o.customerCategory || '-',
          o.membershipTier || '-',
          o.tailorName || '-',
          o.dressType,
          o.fabricType,
          o.fabricColor || '-',
          o.orderDate,
          o.deliveryDate,
          idx + 1,
          statusLabel,
          h.date,
          nextDate,
          daysInStage,
          cumulativeDays,
          progressLabel,
          currentOrderStatusLabel,
          totalOrderDays,
          h.updatedBy || o.staffName || '-',
          (h.note || '-').replace(/[\r\n\t]/g, ' ')
        ]);
      });
    });

    return [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
  };

  const downloadTransitionsCSV = () => {
    const headers = [
      'Order Number', 'Branch', 'Customer Name', 'Phone', 'Social Contact', 'Job Type', 'Membership Tier', 'Tailor Name', 'Dress Type', 'Fabric Type', 'Fabric Color',
      'Order Date', 'Delivery Date', 'History Step Number', 'Status / Stage', 'Stage Start Date (Change Date)', 'Stage End Date / Next Date',
      'Duration in Stage (Days)', 'Cumulative Days from Order Date', 'Stage Progress Status', 'Current Order Status', 'Total Order Days Since Order',
      'Recorded By', 'Stage Notes'
    ];

    const rows: string[][] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    orders.forEach(o => {
      const history = (o.statusHistory && o.statusHistory.length > 0)
        ? o.statusHistory
        : [{
            status: o.status,
            date: o.statusDate || o.orderDate,
            note: o.notes || '',
            updatedBy: o.staffName || 'พนักงาน'
          }];

      const totalOrderDays = getDaysDifference(
        o.orderDate, 
        o.status === OrderStatus.COMPLETED ? (o.statusDate || todayStr) : todayStr
      );

      history.forEach((h, idx) => {
        const isLast = idx === history.length - 1;
        const nextDate = isLast
          ? (o.status === OrderStatus.COMPLETED ? (o.statusDate || h.date) : todayStr)
          : history[idx + 1].date;

        const daysInStage = getDaysDifference(h.date, nextDate);
        const cumulativeDays = getDaysDifference(o.orderDate, nextDate);
        const statusLabel = STATUS_MAP[h.status as OrderStatus]?.label || h.status;
        const currentOrderStatusLabel = STATUS_MAP[o.status as OrderStatus]?.label || o.status;
        const progressLabel = isLast
          ? (o.status === OrderStatus.COMPLETED ? 'เสร็จสิ้นสมบูรณ์' : 'กำลังดำเนินการ (สถานะปัจจุบัน)')
          : 'ผ่านขั้นตอนนี้แล้ว';

        rows.push([
          `"${o.orderNumber}"`,
          `"${o.branch || 'สาขานราธิวาส'}"`,
          `"${o.customerName.replace(/"/g, '""')}"`,
          `"${o.customerPhone}"`,
          `"${(o.customerSocial || '-').replace(/"/g, '""')}"`,
          `"${o.customerCategory || '-'}"`,
          `"${o.membershipTier || '-'}"`,
          `"${(o.tailorName || '-').replace(/"/g, '""')}"`,
          `"${o.dressType.replace(/"/g, '""')}"`,
          `"${o.fabricType.replace(/"/g, '""')}"`,
          `"${(o.fabricColor || '-').replace(/"/g, '""')}"`,
          `"${o.orderDate}"`,
          `"${o.deliveryDate}"`,
          `${idx + 1}`,
          `"${statusLabel.replace(/"/g, '""')}"`,
          `"${h.date}"`,
          `"${nextDate}"`,
          `${daysInStage}`,
          `${cumulativeDays}`,
          `"${progressLabel}"`,
          `"${currentOrderStatusLabel.replace(/"/g, '""')}"`,
          `${totalOrderDays}`,
          `"${(h.updatedBy || o.staffName || '-').replace(/"/g, '""')}"`,
          `"${(h.note || '-').replace(/"/g, '""').replace(/[\r\n]/g, ' ')}"`
        ]);
      });
    });

    const content = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NUNUH_Status_Durations_Log_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const todayStartBanner = new Date();
  todayStartBanner.setHours(0, 0, 0, 0);

  const overdueOrdersList = orders.filter((o) => {
    if (!o.deliveryDate || o.status === OrderStatus.COMPLETED) return false;
    const delDate = new Date(o.deliveryDate);
    delDate.setHours(0, 0, 0, 0);
    return delDate.getTime() < todayStartBanner.getTime();
  });

  return (
    <div className="space-y-6">

      {/* 🚨 Overdue Orders Alert Banner for LINE Owner Notification */}
      {overdueOrdersList.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-rose-100/40 border border-rose-300 p-4 rounded-2xl space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 shadow-xs">
                <AlertTriangle className="h-5 w-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                  <span>🚨 มีออเดอร์เกินกำหนดส่งมอบทั้งหมด {overdueOrdersList.length} รายการ!</span>
                </h4>
                <p className="text-[11px] text-rose-800 font-medium mt-0.5">
                  คุณสามารถกดส่งการแจ้งเตือนรายชื่อออเดอร์ที่เกินกำหนดทั้งหมดเข้า LINE ของเจ้าของร้านได้ทันทีค่ะ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendOverdueLineAlert}
              disabled={isSendingOverdueAlert}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSendingOverdueAlert ? 'กำลังส่งแจ้งเตือน...' : '📲 แจ้งเตือนเข้า LINE เจ้าของร้าน'}</span>
            </button>
          </div>

          {/* Owner LINE ID Input prompt if missing */}
          {!ownerLineUserId && (
            <div className="pt-2 border-t border-rose-200/80 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
              <span className="text-rose-900 font-bold shrink-0">📍 ระบุ LINE User ID เจ้าของร้าน/แอป:</span>
              <input
                type="text"
                value={ownerLineUserId}
                onChange={(e) => {
                  const val = e.target.value;
                  setOwnerLineUserId(val);
                  localStorage.setItem('nunuh_owner_line_user_id', val);
                  fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ownerLineUserId: val })
                  }).catch(() => {});
                }}
                placeholder="วางรหัส LINE User ID (เช่น U1234567890abcdef...)"
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-rose-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 text-rose-950 font-bold"
              />
            </div>
          )}

          {overdueAlertResult && (
            <div className={`p-3 rounded-xl text-xs font-medium whitespace-pre-wrap leading-relaxed ${
              overdueAlertResult.status === 'success'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-rose-100 text-rose-900 border border-rose-300'
            }`}>
              {overdueAlertResult.msg}
            </div>
          )}
        </div>
      )}

      {/* Public Render URL & LINE OA Config Header */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/30 border border-amber-200/60 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-700 rounded-xl">
            <Globe className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-natural-espresso flex items-center gap-1.5">
              <span>🔗 ลิงก์สาธารณะ & การเชื่อมโยง LINE ร้าน</span>
            </h4>
            <p className="text-[10px] text-natural-espresso/60 font-medium">
              เว็บไซต์ลูกค้า: <strong className="text-amber-800 font-mono break-all">{publicUrl}</strong> | LINE OA: <strong className="text-emerald-800 font-mono">{lineOaId}</strong>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowUrlSettings(!showUrlSettings)}
          className="text-xs font-bold text-amber-800 hover:text-amber-900 bg-white hover:bg-amber-100/50 px-3 py-1.5 rounded-xl border border-amber-200 transition-colors shadow-2xs cursor-pointer flex items-center space-x-1"
        >
          <span>{showUrlSettings ? '✕ ปิดตั้งค่า' : '⚙️ ตั้งค่าระบบเว็บ & LINE'}</span>
        </button>
      </div>

      {showUrlSettings && (
        <div className="bg-white p-5 rounded-2xl border border-natural-wheat shadow-md space-y-5 animate-fadeIn">
          
          {/* Section 1: Render.com URL */}
          <div className="space-y-2.5">
            <div className="space-y-1">
              <h5 className="text-xs font-black text-natural-espresso flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>1. ลิงก์หลักของร้านคุณ (Render App URL)</span>
              </h5>
              <p className="text-[11px] text-natural-espresso/60 leading-relaxed pl-3">
                กรอกลิงก์เว็บไซต์ของร้านคุณที่ได้มาจาก Render.com (เช่น <code className="bg-natural-sand/50 px-1 py-0.5 rounded text-[10px] font-mono">https://nunuh.onrender.com</code>) เพื่อให้ระบบสร้างลิงก์เช็คสถานะออเดอร์ให้ลูกค้าคัดลอกไปส่งในแชท LINE ได้ถูกต้องค่ะ
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pl-3">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-natural-espresso/40" />
                <input
                  type="url"
                  value={publicUrl}
                  onChange={(e) => handleSavePublicUrl(e.target.value)}
                  placeholder="เช่น https://nunuh.onrender.com"
                  className="w-full text-xs pl-8.5 pr-4 py-2.5 rounded-xl border border-natural-wheat focus:outline-none focus:ring-2 focus:ring-natural-clay/20 bg-natural-cream/10 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  handleSavePublicUrl(window.location.origin);
                  alert('รีเซ็ตลิงก์หลักกลับมาใช้ URL ปัจจุบันเรียบร้อยแล้วค่ะ');
                }}
                className="px-4 py-2 bg-natural-sand hover:bg-natural-wheat text-natural-espresso font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
              >
                🔄 ใช้ลิงก์ปัจจุบัน
              </button>
            </div>
            <p className="text-[10px] text-amber-600 font-bold pl-3">
              💡 ลิงก์อัพเดตที่จะถูกแชร์: <span className="break-all font-mono text-[9px] bg-amber-50 px-1 py-0.5 rounded">{publicUrl}?tab=customer&search=เบอร์โทรศัพท์ลูกค้า&lineUserId=ไอดีไลน์ลูกค้า&mode=customer</span>
            </p>
          </div>

          <hr className="border-natural-sand/60" />

          {/* Section 2: LINE OA settings */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h5 className="text-xs font-black text-natural-espresso flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>2. ตั้งค่า LINE Official Account (LINE OA) ของร้าน</span>
              </h5>
              <p className="text-[11px] text-natural-espresso/60 leading-relaxed pl-3">
                ระบุข้อมูล ID และลิงก์แผงควบคุมแชทของร้านคุณ เพื่อช่วยให้ปุ่มเชื่อมต่อ LINE สามารถเปิดห้องแชทของลูกค้าเพื่อส่งสถานะให้แอดมินคุยกับลูกค้าได้ถูกต้องโดยไม่ผิดพลาดค่ะ
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
              
              {/* LINE OA ID Field */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-natural-espresso/70 block">
                  🟢 LINE OA ID ของร้าน (เช่น @237aynfq)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-natural-espresso/45">ID</span>
                  <input
                    type="text"
                    value={lineOaId}
                    onChange={(e) => handleSaveLineOaId(e.target.value)}
                    placeholder="เช่น @237aynfq"
                    className="w-full text-xs pl-8 pr-4 py-2.5 rounded-xl border border-natural-wheat focus:outline-none focus:ring-2 focus:ring-natural-clay/20 bg-natural-cream/5 font-mono"
                  />
                </div>
                <span className="text-[9px] text-natural-espresso/45 block">
                  * ใช้สำหรับปุ่ม แชท LINE OA (ใช้เปิดหน้าแชท LINE Official Account Manager ของลูกค้ารายนั้นตาม User ID)
                </span>
              </div>

              {/* LINE OA Admin Chat URL Field */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-natural-espresso/70 block">
                  💬 ลิงก์หน้าแชทหลักของแอดมิน (LINE Chat Admin URL)
                </label>
                <input
                  type="text"
                  value={lineOaChatUrl}
                  onChange={(e) => handleSaveLineOaChatUrl(e.target.value)}
                  placeholder="เช่น https://chat.line.biz/"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-natural-wheat focus:outline-none focus:ring-2 focus:ring-natural-clay/20 bg-natural-cream/5 font-mono"
                />
                <span className="text-[9px] text-natural-espresso/45 block leading-relaxed">
                  * โดยทั่วไปคือ <code className="bg-natural-sand px-1 rounded font-mono">https://chat.line.biz/</code> หรือลิงก์เฉพาะแชทของร้านคุณ เช่น <code className="bg-natural-sand px-1 rounded font-mono">https://chat.line.biz/Uxxxxxxxxxxxxxx/chat</code>
                </span>
              </div>

              {/* Owner LINE User ID Field */}
              <div className="space-y-1.5 md:col-span-2 bg-rose-50/60 p-3 rounded-xl border border-rose-200">
                <label className="text-[10.5px] font-black text-rose-950 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  <span>👑 LINE User ID ของเจ้าของร้าน/แอป (สำหรับรับการแจ้งเตือนออเดอร์เกินกำหนดส่ง)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ownerLineUserId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOwnerLineUserId(val);
                      localStorage.setItem('nunuh_owner_line_user_id', val);
                      fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ownerLineUserId: val })
                      }).catch(() => {});
                    }}
                    placeholder="วางรหัส User ID ของเจ้าของร้าน เช่น U1234567890abcdef..."
                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-rose-950 font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleSendOverdueLineAlert}
                    disabled={isSendingOverdueAlert}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingOverdueAlert ? 'กำลังส่ง...' : 'ทดสอบส่งแจ้งเตือน 📲'}
                  </button>
                </div>
                <p className="text-[9.5px] text-rose-800/80 font-medium leading-relaxed">
                  * เมื่อตั้งค่ารหัสนี้แล้ว หากมีออเดอร์ในระบบที่เกินกำหนดวันส่งมอบ ระบบจะสามารถส่งการแจ้งเตือนสรุปรายชื่อออเดอร์เข้าห้องแชท LINE ของเจ้าของร้านได้โดยตรง
                </p>
              </div>

            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl ml-3">
              <p className="text-[10px] text-emerald-800 font-medium leading-relaxed">
                💡 <strong>เคล็ดลับการคุย LINE ลูกค้าได้ทันที:</strong> <br />
                - <strong>กรณีใช้ LINE ส่วนตัว:</strong> ให้ใส่ไอดีลูกค้าไว้ใน "ช่องทางติดต่อ" (เช่น <code className="bg-emerald-100/50 px-1 rounded">line: somchai_id</code>) ระบบจะสร้างปุ่ม <strong>"เปิด LINE ลูกค้าโดยตรง"</strong> ให้เปิดคุยได้ทันที <br />
                - <strong>กรณีใช้ LINE OA:</strong> กดปุ่ม <strong>"คุย LINE (แอดมิน)"</strong> เพื่อคัดลอกข้อความแจ้งสถานะและเปิดระบบแชท LINE OA ของร้านท่าน แล้วใช้ปุ่มค้นหาด้วยชื่อลูกค้าเพื่อวางข้อความพูดคุยได้ทันทีเลยค่ะ!
              </p>
            </div>

            {/* LINE Messaging API Diagnostics */}
            <div className="border border-teal-200/60 bg-teal-50/20 p-4 rounded-xl ml-3 space-y-3">
              <div className="flex items-center justify-between border-b border-teal-100/50 pb-2">
                <span className="text-xs font-black text-teal-900 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${lineConfig?.tokenSet ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${lineConfig?.tokenSet ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  </span>
                  <span>ระบบส่งสถานะ LINE อัตโนมัติ (LINE Messaging API)</span>
                </span>
                <span className="text-[9.5px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                  ระบบแชทอัตโนมัติ
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-teal-100/30 flex items-center justify-between">
                  <span className="text-natural-espresso/70 font-medium">LINE Channel Access Token:</span>
                  {lineConfig === null ? (
                    <span className="text-[10px] text-natural-espresso/40">กำลังโหลด...</span>
                  ) : lineConfig.tokenSet ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      🟢 ตั้งค่าแล้ว
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      🔴 ยังไม่ได้ตั้งค่า
                    </span>
                  )}
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-teal-100/30 flex items-center justify-between">
                  <span className="text-natural-espresso/70 font-medium">LINE Channel Secret:</span>
                  {lineConfig === null ? (
                    <span className="text-[10px] text-natural-espresso/40">กำลังโหลด...</span>
                  ) : lineConfig.secretSet ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      🟢 ตั้งค่าแล้ว
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      🔴 ยังไม่ได้ตั้งค่า
                    </span>
                  )}
                </div>
              </div>

              {!lineConfig?.tokenSet && (
                <div className="text-[10.5px] text-natural-espresso/70 leading-relaxed bg-white/60 p-3 rounded-lg border border-natural-wheat/40 space-y-1.5">
                  <p className="font-bold text-rose-600">💡 ปุ่ม "ส่งสถานะเข้า LINE 🚀" จะทำงานแบบก๊อปปี้ข้อความอัตโนมัติ (โหมดจำลอง) จนกว่าจะทำการตั้งค่า!</p>
                  <p className="font-medium text-[10px] text-natural-espresso/60">
                    หากต้องการเปิดระบบให้สามารถกดปุ่มแล้วส่งข้อความเข้าห้องแชทของลูกค้าโดยตรงแบบ <strong>อัตโนมัติ 100%</strong> รบกวนตั้งค่าดังนี้ค่ะ:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-[10px] text-natural-espresso/60">
                    <li>เข้าสู่เว็บไซต์ <a href="https://developer.line.biz" target="_blank" rel="noopener noreferrer" className="text-teal-700 underline font-semibold">LINE Developers Console</a> แล้วเลือก Channel ของร้านคุณ</li>
                    <li>ไปที่เมนู <strong>Messaging API</strong> แล้วเลื่อนลงไปล่างสุด กดสร้าง (Issue) <strong>Channel Access Token</strong></li>
                    <li>นำ Token ยาวๆ ที่ได้ และ Channel Secret (จากแถบ Basic Settings) ไปใส่ในช่อง <strong>Environment Variables (ตัวแปรสภาพแวดล้อม)</strong> ในหน้าตั้งค่าหลังบ้านของระบบ AI Studio</li>
                    <li>เมื่อตั้งค่าเรียบร้อยแล้ว สถานะด้านบนจะเปลี่ยนเป็นสีเขียว 🟢 และระบบจะส่งแชทอัตโนมัติทันทีเมื่อกดปุ่มค่ะ!</li>
                  </ol>
                </div>
              )}

              {/* Test Message Sending Section */}
              <div className="bg-white p-3.5 rounded-xl border border-teal-100/50 mt-2 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-800">
                  <span>🧪 ทดสอบระบบส่งข้อความเข้า LINE (Test API)</span>
                </div>
                <p className="text-[10px] text-natural-espresso/60 leading-relaxed">
                  คุณสามารถนำรหัส LINE User ID ของคุณเอง (รหัส U...) หรือของลูกค้ามาวางเพื่อกดส่งทดสอบ เพื่อเช็กว่า LINE Messaging API ของคุณทำงานได้ถูกต้องหรือไม่ค่ะ
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testLineUserId}
                    onChange={(e) => setTestLineUserId(e.target.value)}
                    placeholder="วางรหัสผู้ใช้ เช่น Uf150dba359d90219f8d5ff1826f470df"
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-natural-wheat bg-natural-cream/5 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    onClick={handleTestSendLineMessage}
                    disabled={testStatus.status === 'sending'}
                    className={`text-xs px-4 py-2 font-bold rounded-lg text-white shrink-0 transition-colors ${
                      testStatus.status === 'sending'
                        ? 'bg-natural-espresso/40 cursor-not-allowed'
                        : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    {testStatus.status === 'sending' ? 'กำลังส่ง...' : 'ส่งข้อความทดสอบ 🚀'}
                  </button>
                </div>
                {testStatus.status === 'success' && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 text-[10.5px] rounded-lg border border-emerald-200 font-medium">
                    🎉 สำเร็จ! ข้อความทดสอบถูกส่งเข้า LINE เรียบร้อยแล้วค่ะ! ระบบการส่งข้อความอัตโนมัติทำงาน 100% แล้วค่ะ
                  </div>
                )}
                {testStatus.status === 'error' && (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-rose-50 text-rose-700 text-[10.5px] rounded-lg border border-rose-200 font-medium whitespace-pre-wrap leading-relaxed">
                      {testStatus.errorMsg}
                    </div>

                    {/* Troubleshooting Guide for Failed to send messages */}
                    {testStatus.errorMsg.includes('Failed to send messages') && (
                      <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/70 text-[10px] text-natural-espresso/80 space-y-2 leading-relaxed">
                        <p className="font-black text-amber-800 flex items-center gap-1">
                          <span>💡 แนะนำวิธีแก้ไขปัญหา "ส่งข้อความไม่สำเร็จ (Failed to send messages)" :</span>
                        </p>
                        <p className="font-medium">
                          หากลูกค้าเป็นเพื่อนของร้านคุณแล้วและไม่ได้บล็อก แต่ LINE API ยังตอบกลับปฏิเสธการส่งข้อความ สาเหตุที่แท้จริงเกิดจาก <span className="font-black text-rose-600">"รหัส LINE User ID ที่นำมาทดสอบนั้นเป็นของต่าง Provider กัน"</span> ค่ะ (LINE กำหนดให้รหัสลูกค้า U... เปลี่ยนแปลงไปตามบัญชีผู้พัฒนา หากใช้รหัสจากระบบอื่นหรือ URL แชทที่ไม่ได้เชื่อมต่อตรงกับ Channel ID นี้ บอทจะไม่รู้จักลูกค้ารายนี้ทันทีค่ะ)
                        </p>
                        
                        <div className="space-y-1.5 pl-1">
                          <p className="font-bold text-amber-900">🛠️ วิธีการที่แนะนำให้ลองเช็กและทดสอบดูใหม่ดังนี้ค่ะ:</p>
                          <ul className="list-disc list-inside space-y-1 text-natural-espresso/70 font-medium pl-1">
                            <li>
                              <strong className="text-teal-800">ทดสอบผ่านระบบ Webhook (แม่นยำ 100%):</strong><br/>
                              ให้แอดมินหรือตัวคุณเองเปิดโปรแกรม LINE บนมือถือของคุณ แอดไลน์ร้านค้า (LINE OA) แล้วลอง <strong className="text-rose-600">"พิมพ์ส่งเลขที่ออเดอร์ หรือพิมพ์เบอร์โทรศัพท์"</strong> เข้าไปในห้องแชทร้านค้าค่ะ 
                            </li>
                            <li>
                              ระบบจะทำการประมวลผล Webhook และจะตอบกลับรายละเอียดออเดอร์ให้โดยอัตโนมัติ พร้อมทั้ง <strong className="text-emerald-700">"จับคู่และเซฟรหัส LINE User ID จริงที่ถูกต้อง 100% ของบอทตัวนี้"</strong> เข้าไปในออเดอร์ของลูกค้ารายนั้นให้ในระบบทันทีค่ะ!
                            </li>
                            <li>
                              หลังจากนั้น ในหน้าแดชบอร์ดจัดการออเดอร์ คุณจะเห็นไอคอนและปุ่มแชทเป็นสีเขียว 🟢 และคุณจะสามารถกดส่งข้อความอัปเดตสถานะแบบอัตโนมัติได้อย่างสมบูรณ์แบบทันทีค่ะ
                            </li>
                          </ul>
                        </div>

                        <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/40 text-[9.5px] space-y-1">
                          <p className="font-bold text-natural-espresso">🔗 การเปิดใช้งาน Webhook ใน LINE Developers Console:</p>
                          <ol className="list-decimal list-inside space-y-0.5 text-natural-espresso/60 pl-1">
                            <li>เข้าสู่หน้า <a href="https://developer.line.biz" target="_blank" rel="noopener noreferrer" className="text-teal-700 underline font-semibold">LINE Developers Console</a> ไปยัง Channel ของคุณ</li>
                            <li>เข้าแท็บ <strong>Messaging API</strong> แล้วตรวจสอบในหัวข้อ <strong>Webhook URL</strong></li>
                            <li>ใส่ลิงก์นี้เข้าไป: <code className="bg-teal-50 text-teal-800 px-1 py-0.5 rounded font-mono font-bold break-all">https://{window.location.host}/api/webhook/line</code> แล้วกด <strong>Update</strong> จากนั้นเปิดสวิตช์ <strong>Use webhook</strong> ให้เป็น <strong className="text-emerald-600">Enabled</strong></li>
                            <li>ในหน้านั้น ให้กดปุ่ม <strong>Verify</strong> เพื่อทดสอบ หากขึ้นคำว่า <strong className="text-emerald-600">Success</strong> แสดงว่าระบบแชทออโตเมติกพร้อมทำงานแล้วค่ะ!</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
      
      {/* Search and Filters Controls */}
      <div className="bg-white p-5 rounded-2xl border border-natural-wheat shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-natural-espresso/40" />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, ชื่อเล่น/ชื่อเรียก, เบอร์โทรศัพท์, หมายเลขสั่งซื้อ, ชื่อช่างตัดเย็บ, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl border border-natural-wheat focus:outline-none focus:ring-2 focus:ring-natural-clay/20 focus:border-natural-clay bg-natural-cream/20"
          />
        </div>

        {/* Filter Toggle Row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 text-xs text-natural-espresso/60 font-medium mr-1">
            <Filter className="h-3.5 w-3.5" />
            <span>ตัวกรอง:</span>
          </div>

          <button
            onClick={() => setStatusFilter('ALL_ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'ALL_ACTIVE'
                ? 'bg-natural-clay text-white border-natural-clay'
                : 'bg-natural-sand hover:bg-natural-wheat/60 text-natural-espresso border-transparent'
            }`}
          >
            📋 เฉพาะงานที่ดำเนินการอยู่
          </button>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-natural-clay text-white border-natural-clay'
                : 'bg-natural-sand hover:bg-natural-wheat/60 text-natural-espresso border-transparent'
            }`}
          >
            📂 ทั้งหมด ({orders.length})
          </button>

          <div className="relative inline-block text-left">
            <select
              value={statusList.includes(statusFilter as OrderStatus) ? statusFilter : "SELECT"}
              onChange={(e) => {
                if (e.target.value !== "SELECT") {
                  setStatusFilter(e.target.value);
                }
              }}
              style={{ width: '200px' }}
              className="w-[200px] text-xs bg-natural-sand border-transparent font-semibold px-3 py-2 rounded-xl text-natural-espresso focus:outline-none focus:ring-2 focus:ring-natural-clay/20 cursor-pointer"
            >
              <option value="SELECT">📍 กรองเฉพาะสถานะ...</option>
              {statusList.map((status) => (
                <option key={status} value={status}>
                  {STATUS_MAP[status].label}
                </option>
              ))}
            </select>
          </div>

          {/* Tailor Filter */}
          <div className="relative inline-block text-left">
            <select
              value={tailorFilter}
              onChange={(e) => setTailorFilter(e.target.value)}
              style={{ width: '190px' }}
              className="w-[190px] text-xs bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer shadow-3xs"
            >
              <option value="ALL">✂️ ช่างตัดเย็บทั้งหมด {allTailors.length > 0 ? `(${allTailors.length} คน)` : ''}</option>
              {allTailors.map((tailor) => (
                <option key={tailor} value={tailor}>
                  ช่าง: {tailor}
                </option>
              ))}
              <option value="UNASSIGNED">⚪ ยังไม่ระบุช่าง</option>
            </select>
          </div>

          <div className="relative inline-block text-left">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{ width: '150px' }}
              className="w-[150px] text-xs bg-purple-50 text-purple-900 border border-purple-200 font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
            >
              <option value="ALL">🏪 ทุกสาขา</option>
              <option value="สาขานราธิวาส">สาขานราธิวาส</option>
              <option value="สาขายะลา">สาขายะลา</option>
              <option value="สาขาปัตตานี">สาขาปัตตานี</option>
              <option value="สาขาหาดใหญ่">สาขาหาดใหญ่</option>
            </select>
          </div>

          {/* Google Sheets Sync & Export Button */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs"
          >
            <span>📊 ส่งออก Google Sheets</span>
          </button>
        </div>

      </div>

      {/* Orders List Container */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-natural-sand/20 border border-dashed border-natural-wheat rounded-2xl py-12 px-6 text-center text-natural-espresso/60">
            <Compass className="h-8 w-8 mx-auto text-natural-espresso/30 mb-3" />
            <p className="font-medium">ไม่พบรายการออเดอร์ตัดเย็บตามที่เลือก</p>
            <p className="text-xs mt-1">ลองเปลี่ยนคำค้นหาหรือเลือกสลับแท็บเพื่อดูรายการงานทั้งหมด</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const currentStatusCfg = STATUS_MAP[order.status];
            const isExpanded = expandedOrderId === order.id;
            const unpaid = getUnpaidBalance(order);
            const orderImage = order.customImage || (order.selectedDesignId ? catalogue.find(item => item.id === order.selectedDesignId)?.image : null);

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const delDate = new Date(order.deliveryDate);
            delDate.setHours(0, 0, 0, 0);
            const diff = Math.round((delDate.getTime() - todayStart.getTime()) / (1000 * 3600 * 24));

            let cardBg = "bg-white border-natural-wheat";
            if (order.status !== OrderStatus.COMPLETED) {
              if (diff < 0) cardBg = "bg-rose-50/70 border-rose-300 ring-1 ring-rose-200";
              else if (diff === 0) cardBg = "bg-red-50/80 border-red-400 ring-2 ring-red-300 animate-pulse";
              else if (diff === 1) cardBg = "bg-orange-50/70 border-orange-300 ring-1 ring-orange-200";
              else if (diff <= 3) cardBg = "bg-amber-50/70 border-amber-300";
            }

            return (
              <div 
                key={order.id}
                id={order.id}
                className={`rounded-2xl border transition-all duration-300 shadow-sm ${cardBg} ${
                  isExpanded ? 'ring-2 ring-natural-clay/20' : 'hover:border-natural-ochre/40'
                }`}
              >
                
                {/* Main Card Header Area */}
                <div 
                  onClick={() => toggleExpand(order.id)}
                  className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer select-none"
                >
                  
                  {/* Left Side: Image Thumbnail (if exists) & Order Number & Customer Name */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {orderImage && (
                      <div className="h-16 w-12 rounded-xl overflow-hidden bg-natural-sand/15 border border-natural-wheat shrink-0 shadow-xs">
                        <img 
                          src={orderImage} 
                          alt="Design Thumbnail" 
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-extrabold bg-natural-espresso text-natural-cream px-2 py-0.5 rounded">
                          {order.orderNumber}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentStatusCfg.colorClass}`}>
                          {currentStatusCfg.label}
                        </span>
                        <span className="text-[10px] font-semibold text-natural-espresso/70 bg-natural-sand/50 border border-natural-wheat/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="h-3 w-3 text-natural-clay" /> วันที่สถานะ: {order.statusDate || order.orderDate}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenStatusModal(order);
                          }}
                          className="text-[10px] font-bold text-natural-clay hover:text-white bg-natural-clay/10 hover:bg-natural-clay border border-natural-clay/30 px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
                          title="คลิกเพื่อเปลี่ยนสถานะและระบุวันที่"
                        >
                          <span>⚡ ปรับสถานะ & วันที่</span>
                        </button>
                        {(order.isLocked || order.pickupSignature) && (
                          <span className="bg-amber-100 text-amber-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 shadow-3xs">
                            <Lock className="h-3 w-3 text-amber-700" />
                            <span>ลูกค้าเซ็นรับมอบแล้ว (ล็อกออเดอร์)</span>
                          </span>
                        )}
                        {order.customerCategory && (
                          <span className="bg-amber-50 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-amber-200">
                            ประเภทงาน: {order.customerCategory}
                          </span>
                        )}
                        {order.membershipTier && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                            order.membershipTier === 'PRIME' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                            order.membershipTier === 'PRIVILEGE' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                            order.membershipTier === 'TRADER' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            'bg-stone-50 text-stone-800 border-stone-200'
                          }`}>
                            บัตร: {order.membershipTier}
                          </span>
                        )}
                        {order.externalOrderId && (
                          <span className="bg-sky-50 text-sky-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-sky-200">
                            รหัสอ้างอิง: {order.externalOrderId}
                          </span>
                        )}
                        {order.branch && (
                          <span className="bg-purple-50 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-purple-200">
                            🏪 {order.branch}
                          </span>
                        )}
                        {order.staffName && (
                          <span className="bg-amber-50 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded border border-amber-200">
                            👤 พนักงาน: {order.staffName}
                          </span>
                        )}
                        {order.tailorName && (
                          <span className="bg-emerald-50 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shadow-3xs">
                            <Scissors className="h-3 w-3 text-emerald-700" />
                            <span>ช่าง: {order.tailorName}</span>
                          </span>
                        )}
                        {order.isMatchingSet && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1 animate-pulse">
                            ✨ งานเข้าชุด {order.idhNumber ? `(IDH: ${order.idhNumber})` : ''}
                          </span>
                        )}
                        {order.sku && (
                          <span className="bg-natural-clay/15 text-natural-clay text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-natural-clay/20 uppercase tracking-wide">
                            SKU: {order.sku}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <h4 className="font-serif font-bold text-natural-espresso text-lg leading-tight flex items-center flex-wrap gap-1.5">
                          <span>{order.customerName}</span>
                          {order.customerNickname && (
                            <span className="text-xs sm:text-sm font-sans font-medium text-natural-espresso/70 bg-natural-sand/60 px-2 py-0.5 rounded-md border border-natural-wheat">
                              ({order.customerNickname})
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-natural-espresso/60 flex items-center">
                          <Phone className="h-3 w-3 mr-1 inline" /> {order.customerPhone}
                        </p>
                      </div>
                      <p className="text-xs text-natural-espresso/80 font-medium">
                        ชุด: <span className="text-natural-espresso font-semibold">{order.dressType}</span> | ผ้า: <span className="text-natural-espresso">{order.fabricType} ({order.fabricColor})</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Delivery Target & Price / Expand button */}
                  <div className="flex items-center justify-between w-full md:w-auto md:space-x-6 border-t md:border-0 border-natural-sand pt-3 md:pt-0">
                    
                    <div className="text-left md:text-right space-y-0.5">
                      <p className="text-[10px] text-natural-espresso/40 font-bold uppercase tracking-wider flex items-center md:justify-end">
                        <Calendar className="h-3 w-3 mr-1" /> ส่งมอบวันที่
                      </p>
                      <p className="text-sm font-bold text-natural-espresso">
                        {new Date(order.deliveryDate).toLocaleDateString('th-TH', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </p>
                      <div className="text-[10px] font-medium pt-0.5">
                        {(() => {
                          const todayStart = new Date();
                          todayStart.setHours(0, 0, 0, 0);
                          const delDate = new Date(order.deliveryDate);
                          delDate.setHours(0, 0, 0, 0);
                          const diff = Math.round((delDate.getTime() - todayStart.getTime()) / (1000 * 3600 * 24));

                          if (order.status === OrderStatus.COMPLETED) {
                            return <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">✨ ส่งมอบสำเร็จแล้ว</span>;
                          }
                          if (diff < 0) {
                            return <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-300 font-bold animate-pulse">⚠️ เกินกำหนด ${Math.abs(diff)} วัน</span>;
                          }
                          if (diff === 0) {
                            return <span className="inline-block px-2 py-0.5 rounded-md bg-red-600 text-white border border-red-700 font-bold animate-pulse">🚨 ส่งมอบวันนี้!</span>;
                          }
                          if (diff === 1) {
                            return <span className="inline-block px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 border border-orange-300 font-bold">⚠️ พรุ่งนี้ (อีก 1 วัน)</span>;
                          }
                          if (diff <= 3) {
                            return <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-semibold">⏳ อีก ${diff} วันส่งชุด</span>;
                          }
                          return <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 อีก ${diff} วันส่งชุด</span>;
                        })()}
                      </div>
                    </div>

                    <div className="text-right space-y-0.5 pl-4 border-l border-natural-sand">
                      <p className="text-[10px] text-natural-espresso/40 font-bold uppercase tracking-wider flex items-center justify-end">
                        <DollarSign className="h-3 w-3" /> ยอดค้างชำระ
                      </p>
                      <p className={`text-sm font-extrabold ${unpaid > 0 ? 'text-natural-clay' : 'text-natural-sage font-semibold'}`}>
                        {unpaid > 0 ? `${unpaid.toLocaleString()} ฿` : 'ครบถ้วนแล้ว ✓'}
                      </p>
                      <p className="text-[10px] text-natural-espresso/50">
                        รวม {order.price.toLocaleString()} ฿
                      </p>
                    </div>

                    <div className="pl-3">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-natural-espresso/40" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-natural-espresso/40" />
                      )}
                    </div>
                  </div>

                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="border-t border-natural-sand bg-natural-sand/20 p-5 rounded-b-2xl space-y-6">
                    
                    {/* Visual Progress & Status Selector */}
                    <div className="bg-white border border-natural-wheat/80 rounded-2xl p-4 space-y-4 shadow-3xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-natural-sand/60">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-natural-sand flex items-center justify-center text-natural-clay font-bold text-xs">
                            {Math.max(1, PRODUCTION_PIPELINE_STEPS.indexOf(order.status as OrderStatus) + 1)}
                          </span>
                          <div>
                            <p className="text-[11px] font-bold text-natural-espresso/60 uppercase tracking-wider">
                              สถานะขั้นตอนการผลิต (ขั้นตอนที่ {Math.max(1, PRODUCTION_PIPELINE_STEPS.indexOf(order.status as OrderStatus) + 1)} จาก {PRODUCTION_PIPELINE_STEPS.length})
                            </p>
                            <p className="text-sm font-extrabold text-natural-espresso">
                              {STATUS_MAP[order.status]?.label || order.status}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-natural-clay bg-natural-sand/60 border border-natural-wheat/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <Clock className="h-3 w-3 text-natural-clay" /> วันที่สถานะ: {order.statusDate || order.orderDate}
                          </span>
                        </div>
                      </div>

                      {/* Dropdown Selector for 22 statuses */}
                      <div className="bg-natural-sand/20 border border-natural-wheat/70 p-3 rounded-xl flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-natural-espresso/70 mb-1">
                            🔄 เลือกเปลี่ยนสถานะ (22 ขั้นตอน):
                          </label>
                          <select
                            value={order.status}
                            onChange={(e) => {
                              const newSt = e.target.value as OrderStatus;
                              handleOpenStatusModal(order, newSt);
                            }}
                            className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-natural-wheat bg-white text-natural-espresso focus:ring-2 focus:ring-natural-clay/20 cursor-pointer shadow-3xs"
                          >
                            {PRODUCTION_PIPELINE_STEPS.map((status, index) => (
                              <option key={status} value={status}>
                                {index + 1}. {STATUS_MAP[status]?.label || status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end gap-2 pt-1 md:pt-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStatusModal(order);
                            }}
                            className="w-full md:w-auto text-xs font-bold text-white bg-natural-espresso hover:bg-natural-clay px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 shrink-0"
                          >
                            <span>⚡ ปรับสถานะ & ระบุวันที่</span>
                          </button>
                        </div>
                      </div>

                      {STATUS_MAP[order.status]?.description && (
                        <p className="text-xs text-natural-espresso/70 bg-natural-cream/30 p-2.5 rounded-xl border border-natural-wheat/40">
                          ℹ️ <strong>รายละเอียดขั้นตอน:</strong> {STATUS_MAP[order.status].description}
                        </p>
                      )}
                    </div>

                    {/* Status History Timeline Log with Stage Durations */}
                    {order.statusHistory && order.statusHistory.length > 0 && (
                      <div className="bg-natural-cream/30 border border-natural-wheat/80 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-natural-sand/60 pb-2">
                          <h6 className="text-xs font-bold text-natural-espresso flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5 text-natural-clay" /> ประวัติการเปลี่ยนสถานะ & ระยะเวลาแต่ละขั้นตอน (Status Duration Timeline)
                          </h6>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-natural-espresso/70">
                            <span className="bg-natural-sand/40 px-2.5 py-0.5 rounded-full font-bold">
                              รวมตั้งแต่สั่งตัด: {getDaysDifference(order.orderDate, order.status === OrderStatus.COMPLETED ? (order.statusDate || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0])} วัน
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {order.statusHistory.map((h, hIdx) => {
                            const isLast = hIdx === order.statusHistory!.length - 1;
                            const todayStr = new Date().toISOString().split('T')[0];
                            const nextDate = isLast
                              ? (order.status === OrderStatus.COMPLETED ? (order.statusDate || h.date) : todayStr)
                              : order.statusHistory![hIdx + 1].date;
                            const daysInStage = getDaysDifference(h.date, nextDate);

                            return (
                              <div key={hIdx} className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] bg-white/90 p-2.5 rounded-xl border border-natural-wheat/50 shadow-3xs gap-2">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-natural-espresso">
                                      {hIdx + 1}. {STATUS_MAP[h.status as OrderStatus]?.label || h.status}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                      isLast 
                                        ? (order.status === OrderStatus.COMPLETED 
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                            : 'bg-amber-100 text-amber-900 border border-amber-300 shadow-3xs')
                                        : 'bg-natural-sand/50 text-natural-espresso/80 border border-natural-wheat/60'
                                    }`}>
                                      {isLast 
                                        ? (order.status === OrderStatus.COMPLETED 
                                            ? `✓ ใช้เวลา ${daysInStage} วัน (จบงาน)` 
                                            : `⏳ อยู่ในขั้นตอนนี้มาแล้ว ${daysInStage} วัน (สถานะปัจจุบัน)`)
                                        : `⏱️ ใช้เวลาในขั้นตอนนี้: ${daysInStage} วัน`
                                      }
                                    </span>
                                  </div>
                                  {h.note && (
                                    <p className="text-[10px] text-natural-espresso/70 italic bg-natural-sand/20 px-2 py-0.5 rounded-md inline-block">
                                      หมายเหตุ: {h.note}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right shrink-0 text-[10px] text-natural-espresso/60 font-mono space-y-0.5">
                                  <div>
                                    📅 {h.date} {isLast ? (order.status === OrderStatus.COMPLETED ? '' : '➔ ปัจจุบัน') : `➔ ${order.statusHistory![hIdx + 1].date}`}
                                  </div>
                                  {h.updatedBy && <div className="text-[9px] text-natural-clay font-sans">ผู้บันทึก: {h.updatedBy}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Customer Pickup Signature Block / Trigger Button */}
                    {order.pickupSignature ? (
                      <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                          <div className="flex items-center space-x-2 text-emerald-950 font-bold text-xs">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span>🔒 หลักฐานการเซ็นรับมอบชุดสมบูรณ์ (Customer Pickup Verified)</span>
                          </div>
                          <span className="text-[10px] bg-emerald-700 text-white font-bold px-2.5 py-0.5 rounded-full shadow-3xs flex items-center gap-1">
                            <Lock className="h-3 w-3" /> ล็อกออเดอร์ถาวร
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="space-y-1 text-xs text-emerald-950">
                            <p><strong>ผู้เซ็นรับมอบ:</strong> {order.pickupSigneeName || order.customerName}</p>
                            <p><strong>วันเวลาที่รับมอบ:</strong> {order.pickupSignedAt}</p>
                            <p className="text-[10px] text-emerald-800/90 italic">"ข้าพเจ้าได้ตรวจสอบความสมบูรณ์เรียบร้อยของชุดสั่งตัดและได้รับมอบชุดแล้ว"</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs flex flex-col items-center shrink-0">
                            <img
                              src={order.pickupSignature}
                              alt="ลายเซ็นลูกค้ารับมอบชุด"
                              className="h-16 max-w-[180px] object-contain"
                            />
                            <span className="text-[8px] text-emerald-800/60 font-mono mt-1">ลายเซ็นดิจิทัลรับมอบชุด</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-natural-espresso to-natural-clay/90 p-4 rounded-2xl text-natural-cream flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                        <div className="space-y-0.5 text-center sm:text-left">
                          <p className="font-serif font-bold text-sm text-natural-cream flex items-center justify-center sm:justify-start gap-1.5">
                            <PenTool className="h-4 w-4 text-natural-ochre" />
                            <span>เซ็นรับทราบ & รับมอบชุดสั่งตัด (Customer Signature Sign-off)</span>
                          </p>
                          <p className="text-[11px] text-natural-cream/80">
                            เมื่อตัดเย็บเสร็จเรียบร้อย สามารถให้ลูกค้าเซ็นรับทราบผ่านหน้าจอเพื่อล็อกออเดอร์ถาวรและออกหลักฐานรับมอบ
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSignatureModalOrder(order);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-natural-ochre hover:bg-white text-natural-espresso font-extrabold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap border border-natural-ochre/40"
                        >
                          ✍️ ให้ลูกค้าเซ็นรับมอบชุด
                        </button>
                      </div>
                    )}

                    {/* Specifications Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      
                      {/* Sub-Card A: Measurements Table or IDH Notice */}
                      {(() => {
                        const isIDHOrder = order.customerCategory === 'IDH' || 
                          (order.dressType && order.dressType.toUpperCase().includes('IDH')) || 
                          Boolean(order.idhNumber && order.idhNumber.trim().length > 0) || 
                          (order.dressType && order.dressType.includes('ผ้าคลุม'));

                        if (isIDHOrder) {
                          return (
                            <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/60 shadow-3xs space-y-2.5 col-span-1 md:col-span-2 flex flex-col justify-center">
                              <div className="flex items-center space-x-2.5 text-amber-950">
                                <span className="text-2xl">🧕</span>
                                <div>
                                  <h5 className="font-serif font-bold text-xs text-amber-950">งานสั่งตัดประเภท IDH (ผ้าคลุม)</h5>
                                  <p className="text-[11px] text-amber-900/80 mt-0.5">สินค้าประเภท IDH เป็นผ้าคลุมสั่งสำเร็จ ไม่มีตารางการวัดตัวสัดส่วนค่ะ</p>
                                </div>
                              </div>
                              {order.measurements.standardSize && (
                                <div className="mt-1 pt-2 border-t border-amber-200/50 flex items-center gap-2 text-xs">
                                  <span className="text-[11px] text-amber-900/80 font-bold">ไซส์ผ้าคลุมที่เลือก:</span>
                                  <span className="bg-amber-800 text-white font-bold text-xs px-3 py-0.5 rounded-full shadow-3xs">
                                    {order.measurements.standardSize}
                                  </span>
                                </div>
                              )}
                              {order.measurements.otherNotes && (
                                <div className="text-xs bg-white/80 p-2 rounded-lg border border-amber-200/50 text-natural-espresso">
                                  <span className="font-bold text-amber-900">📌 หมายเหตุผ้าคลุม:</span> {order.measurements.otherNotes}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div className="bg-white p-4 rounded-xl border border-natural-wheat shadow-xs space-y-3 col-span-2">
                            <div className="flex items-center justify-between border-b border-natural-sand pb-2">
                              <h5 className="font-serif font-bold text-natural-espresso text-xs flex items-center">
                                <Ruler className="h-3.5 w-3.5 mr-1.5 text-natural-espresso/60" /> ตารางการวัดตัว (Customer Measurements)
                              </h5>
                              <div className="flex items-center space-x-1.5">
                                {order.measurements.standardSize && (
                                  <span className="text-[10px] bg-natural-clay text-white px-2.5 py-0.5 rounded-full font-bold">
                                    👗 ไซส์มาตรฐาน: {order.measurements.standardSize}
                                  </span>
                                )}
                                {order.customDesign && (
                                  <span className="text-[10px] bg-natural-sand border border-natural-wheat text-natural-clay px-2 py-0.5 rounded font-bold">
                                    📐 ทรง: {order.customDesign.silhouette} | คอ: {order.customDesign.neckline} | แขน: {order.customDesign.sleeves}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">อก (Chest)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.chest} ซม.</p>
                              </div>
                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">เอว (Waist)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.waist} ซม.</p>
                              </div>
                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">สะโพก (Hips)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.hips} ซม.</p>
                              </div>
                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">ไหล่ (Shoulder)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.shoulder} ซม.</p>
                              </div>
                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">ยาวแขน (Sleeve)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.sleeveLength} ซม.</p>
                              </div>
                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">วงแขน (Armhole)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.armhole} ซม.</p>
                              </div>
                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">ยาวชุด (Length)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.length} ซม.</p>
                              </div>

                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">ส่วนสูง (Height)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.height} cm</p>
                              </div>
                              <div className="p-1.5 bg-natural-cream/30 rounded-lg">
                                <p className="text-[10px] text-natural-espresso/45 font-bold">น้ำหนัก (Weight)</p>
                                <p className="text-sm font-mono font-bold text-natural-espresso">{order.measurements.weight || '-'} kg</p>
                              </div>
                              <div className="p-1.5 bg-natural-sand rounded-lg flex items-center justify-center">
                                <span className="text-[9px] text-natural-espresso/50 font-bold uppercase">หน่วย ซม.</span>
                              </div>
                            </div>

                            {order.measurements.otherNotes && (
                              <div className="mt-2 text-xs bg-natural-sand/30 p-2.5 rounded-lg border border-natural-wheat/40">
                                <span className="font-bold text-natural-espresso">📌 บันทึกสัดส่วนเพิ่มเติม:</span> {order.measurements.otherNotes}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Sub-Card B: Order Details & Contacts */}
                      <div className="bg-white p-4 rounded-xl border border-natural-wheat shadow-xs space-y-3 flex flex-col justify-between">
                        <div className="space-y-2.5">
                          <h5 className="font-serif font-bold text-natural-espresso text-xs border-b border-natural-sand pb-2">
                            📝 รายละเอียดเพิ่มเติมของชิ้นงาน
                          </h5>
                          <div className="space-y-1.5 text-xs text-natural-espresso/80">
                            {order.sku && (
                              <div className="pb-1">
                                <span className="bg-natural-clay/10 text-natural-clay text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-natural-clay/20 uppercase">
                                  SKU: {order.sku}
                                </span>
                              </div>
                            )}
                            {order.customerSocial && (() => {
                              const socialInfo = getSocialInfo(order.customerSocial);
                              return (
                                <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                                  <span className="font-semibold text-natural-espresso/60 flex items-center gap-1 shrink-0">
                                    {socialInfo?.icon || <Instagram className="h-3.5 w-3.5 text-natural-clay" />}
                                    <span>ช่องทางติดต่อ:</span>
                                  </span>
                                  <span className="font-bold text-natural-espresso bg-natural-sand/50 px-1.5 py-0.5 rounded border border-natural-wheat/50 text-[11px]">
                                    {order.customerSocial}
                                  </span>
                                  {socialInfo?.type === 'line' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const personalUrl = `https://line.me/ti/p/~${socialInfo.cleanId}`;
                                          window.open(personalUrl, '_blank');
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-xs transition-all cursor-pointer inline-flex shrink-0 ml-1.5"
                                        title="เปิดหน้าแชทไลน์ส่วนตัวของลูกค้าคนนี้โดยตรง"
                                      >
                                        <span>ไลน์ส่วนตัวคนนี้ 🟢</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDirectLineChat(order);
                                        }}
                                        className="bg-[#06C755] hover:bg-[#05b34c] text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-xs transition-all cursor-pointer inline-flex shrink-0 ml-1"
                                        title="คัดลอกข้อความแจ้งสถานะและเปิดหน้าแผงแชท LINE OA ของร้านคุณ"
                                      >
                                        <span>ส่งสถานะเข้า LINE OA 💬</span>
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDirectLineChat(order);
                                      }}
                                      className="bg-[#06C755] hover:bg-[#05b34c] text-white text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 shadow-xs transition-all cursor-pointer inline-flex shrink-0 ml-1.5"
                                      title="คลิกเพื่อเปิดแชท LINE ของร้าน"
                                    >
                                      <span>คุย LINE 💬</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                            {order.customerNickname && (
                              <p className="flex items-center">
                                <span className="font-semibold text-natural-espresso/60 mr-1.5">👤 ชื่อเล่น / ชื่อเรียก:</span>
                                <span className="font-bold text-natural-espresso bg-natural-sand/40 border border-natural-wheat/60 px-2 py-0.5 rounded text-xs">{order.customerNickname}</span>
                              </p>
                            )}
                            {order.customerCategory && (
                              <p className="flex items-center">
                                <span className="font-semibold text-natural-espresso/60 mr-1.5">🏷️ ประเภทงาน:</span>
                                <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">{order.customerCategory}</span>
                              </p>
                            )}
                            {order.membershipTier && (
                              <p className="flex items-center">
                                <span className="font-semibold text-natural-espresso/60 mr-1.5">💳 ประเภทบัตรสมาชิก:</span>
                                <span className={`font-bold px-1.5 py-0.5 rounded border text-[10px] ${
                                  order.membershipTier === 'PRIME' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                                  order.membershipTier === 'PRIVILEGE' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                  order.membershipTier === 'TRADER' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                  'bg-stone-50 text-stone-800 border-stone-200'
                                }`}>{order.membershipTier}</span>
                              </p>
                            )}

                            {order.externalOrderId && (
                              <p className="flex items-center">
                                <span className="font-semibold text-natural-espresso/60 mr-1.5">🔗 รหัสออเดอร์จากกัน:</span>
                                <span className="font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 text-[10px] font-mono">{order.externalOrderId}</span>
                              </p>
                            )}
                            {order.tailorName && (
                              <p className="flex items-center">
                                <span className="font-semibold text-natural-espresso/60 mr-1.5">✂️ ช่างตัดเย็บ:</span>
                                <span className="font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 text-xs flex items-center gap-1">
                                  <span>{order.tailorName}</span>
                                </span>
                              </p>
                            )}
                            <p>
                              📅 <span className="font-semibold text-natural-espresso/50">วันที่สั่งซื้อ:</span> {order.orderDate}
                            </p>
                            <p>
                              💵 <span className="font-semibold text-natural-espresso/50">ราคาชุดทั้งหมด:</span> {order.price.toLocaleString()} บาท
                            </p>
                            {order.discount ? (
                              <p>
                                🏷️ <span className="font-semibold text-natural-espresso/50 text-amber-700">ส่วนลดพิเศษ:</span> <span className="text-amber-700 font-bold">-{order.discount.toLocaleString()} บาท</span>
                              </p>
                            ) : null}
                            <p>
                              💰 <span className="font-semibold text-natural-espresso/50">มัดจำโอนมา:</span> {order.deposit.toLocaleString()} บาท
                              {order.paymentMethod && (
                                <span className="ml-2 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-md inline-block">
                                  ช่องทาง: {order.paymentMethod}
                                </span>
                              )}
                            </p>
                            {order.finalPaymentAmount && order.finalPaymentAmount > 0 ? (
                              <p className="text-emerald-800 font-medium">
                                💵 <span className="font-semibold text-emerald-900/70">จ่ายส่วนต่างเพิ่ม:</span> {order.finalPaymentAmount.toLocaleString()} บาท
                                <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold rounded-md inline-block">
                                  ช่องทาง: {order.finalPaymentMethod || order.paymentMethod || 'เงินโอน'}
                                </span>
                                {order.finalPaymentDate ? ` (${order.finalPaymentDate})` : ''}
                              </p>
                            ) : null}
                            {(() => {
                              const unpaid = Math.max(0, order.price - order.deposit - (order.discount || 0) - (order.finalPaymentAmount || 0));
                              return unpaid === 0 ? (
                                <p className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block mt-1 text-xs">
                                  ✓ ชำระเงินครบถ้วนแล้ว
                                </p>
                              ) : (
                                <p className="font-bold text-natural-clay bg-natural-sand/30 px-2 py-1 rounded-lg border border-natural-wheat/40 inline-block mt-1">
                                  📊 ยอดคงเหลือสุทธิวันรับชุด: {unpaid.toLocaleString()} บาท
                                </p>
                              );
                            })()}
                            {order.fabricType && (
                              <p className="mt-1">
                                🧥 <span className="font-semibold text-natural-espresso/50">ประเภทเนื้อผ้า:</span> {order.fabricType}
                              </p>
                            )}
                          </div>

                          {order.notes && (
                            <div className="text-xs bg-natural-sand/30 p-2.5 rounded-lg border border-natural-wheat/40 text-natural-espresso/80 italic">
                              "{order.notes}"
                            </div>
                          )}

                          {(() => {
                            const resolvedImg = order.customImage || (order.selectedDesignId ? catalogue.find(c => c.id === order.selectedDesignId)?.image : null);
                            const hasImages = resolvedImg || order.customImage2;
                            if (!hasImages) return null;

                            return (
                              <div className="pt-2 border-t border-natural-sand/50">
                                <p className="text-[10px] text-natural-espresso/45 font-bold mb-1.5 flex items-center">
                                  <MessageSquare className="h-3 w-3 mr-1 text-natural-clay" />
                                  <span>รูปภาพแบบชุดสั่งตัดที่เลือก (Selected Design / Reference Photos)</span>
                                </p>
                                <div className={`grid ${resolvedImg && order.customImage2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                  {resolvedImg && (
                                    <div className="relative rounded-xl overflow-hidden border border-natural-wheat bg-natural-sand/5 max-h-48 group">
                                      <img 
                                        src={resolvedImg} 
                                        alt="Design Reference 1" 
                                        className="w-full object-contain max-h-48 rounded-lg cursor-zoom-in mx-auto"
                                        referrerPolicy="no-referrer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const imgWindow = window.open();
                                          if (imgWindow) {
                                            imgWindow.document.write(`<img src="${resolvedImg}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                  {order.customImage2 && (
                                    <div className="relative rounded-xl overflow-hidden border border-natural-wheat bg-natural-sand/5 max-h-48 group">
                                      <img 
                                        src={order.customImage2} 
                                        alt="Custom Reference 2" 
                                        className="w-full object-contain max-h-48 rounded-lg cursor-zoom-in mx-auto"
                                        referrerPolicy="no-referrer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const imgWindow = window.open();
                                          if (imgWindow) {
                                            imgWindow.document.write(`<img src="${order.customImage2}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {order.slipImage && (
                            <div className="pt-2 border-t border-natural-sand/50">
                              <p className="text-[10px] text-natural-espresso/45 font-bold mb-1.5 flex items-center">
                                <ImageIcon className="h-3 w-3 mr-1 text-natural-clay" />
                                <span>หลักฐานการชำระเงิน (Payment Slip Reference)</span>
                              </p>
                              <div className="relative rounded-xl overflow-hidden border border-natural-wheat bg-natural-sand/5 max-h-48 group flex justify-start">
                                <img 
                                  src={order.slipImage} 
                                  alt="Payment Slip" 
                                  className="h-40 w-auto object-contain rounded-lg cursor-zoom-in border border-natural-wheat"
                                  referrerPolicy="no-referrer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const imgWindow = window.open();
                                    if (imgWindow) {
                                      imgWindow.document.write(`<img src="${order.slipImage}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Historical Orders & Feedbacks of this customer */}
                          {(() => {
                            const otherOrders = getCustomerOtherOrders(order);
                            if (otherOrders.length === 0) return null;
                            return (
                              <div className="pt-2 border-t border-natural-sand/50 space-y-2">
                                <details className="group bg-natural-sand/10 border border-natural-wheat/40 rounded-xl p-3">
                                  <summary className="text-xs font-bold font-serif text-natural-espresso flex items-center justify-between cursor-pointer list-none">
                                    <span className="flex items-center gap-1.5">
                                      <History className="h-3.5 w-3.5 text-natural-clay animate-pulse" />
                                      <span>📜 ประวัติสั่งตัด & FEEDBACK ย้อนหลัง ({otherOrders.length} ออเดอร์ก่อนหน้า)</span>
                                    </span>
                                    <span className="transition-transform duration-200 group-open:rotate-180 text-[10px]">▼</span>
                                  </summary>
                                  <div className="mt-3 space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                                    {otherOrders.map((prev) => {
                                      const m = prev.measurements;
                                      const prevFeedbacks = prev.feedbacks || [];
                                      return (
                                        <div key={prev.id} className="bg-white p-2.5 rounded-lg border border-natural-sand text-[11px] space-y-1.5">
                                          <div className="flex justify-between items-center text-[10px] text-natural-espresso/60 font-bold border-b border-natural-sand/50 pb-1">
                                            <span>ออเดอร์: {prev.orderNumber} ({prev.dressType})</span>
                                            <span className="font-mono">{prev.orderDate}</span>
                                          </div>
                                          
                                          {/* Mini Measurements */}
                                          {prev.customerCategory === 'IDH' || prev.dressType?.toUpperCase().includes('IDH') || prev.idhNumber ? (
                                            <div className="text-[10px] bg-amber-50/80 p-1.5 rounded text-amber-900 font-bold flex items-center gap-1">
                                              <span>🧕 ผ้าคลุม (IDH)</span>
                                              {m.standardSize && <span className="text-[9px] bg-amber-200/70 px-1.5 py-0.2 rounded font-mono">ไซส์ {m.standardSize}</span>}
                                              <span className="text-[9px] text-amber-800/70 font-normal">(ไม่มีวัดตัว)</span>
                                            </div>
                                          ) : (
                                            <div className="text-[10px] grid grid-cols-4 gap-1 bg-natural-sand/5 p-1 rounded font-mono text-natural-espresso/80">
                                              <div>อก: {m.chest}</div>
                                              <div>เอว: {m.waist}</div>
                                              <div>สพ: {m.hips}</div>
                                              <div>ยาว: {m.length}</div>
                                            </div>
                                          )}

                                          {/* Previous Feedbacks */}
                                          {prevFeedbacks.length > 0 ? (
                                            <div className="space-y-1 pt-1 border-t border-dashed border-natural-sand/30">
                                              <p className="text-[9px] font-bold text-natural-clay/85 uppercase">ประวัติการพูดคุย/ฟีดแบ็ก:</p>
                                              <div className="bg-natural-sand/5 p-1.5 rounded space-y-1 text-[10px] max-h-24 overflow-y-auto">
                                                {prevFeedbacks.map((f) => (
                                                  <div key={f.id} className="leading-relaxed">
                                                    <strong className={f.sender === 'customer' ? 'text-amber-800' : 'text-natural-clay'}>
                                                      {f.sender === 'customer' ? 'ลูกค้า: ' : 'ร้านค้า: '}
                                                    </strong>
                                                    <span>{f.content}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : (
                                            prev.notes && (
                                              <p className="text-[10px] text-natural-espresso/60 italic bg-natural-sand/5 p-1 rounded">
                                                📌 โน้ต: {prev.notes}
                                              </p>
                                            )
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              </div>
                            );
                          })()}

                          <div className="pt-2 flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintingOrder(order);
                              }}
                              className="bg-natural-clay hover:bg-natural-clay-dark text-white text-[11px] font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs flex-1"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>พิมพ์ใบออเดอร์ 🖨️</span>
                            </button>
                            {order.status === OrderStatus.COMPLETED ? (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const directLink = `${window.location.origin}/?mode=customer&search=${order.orderNumber}&action=review`;
                                  const reviewInvitationText = `🌟 ห้องเสื้อ NUNUH - ขอรบกวนประเมินความพึงพอใจและเขียนรีวิวสำหรับชุด ${order.dressType} (${order.orderNumber})\n\nเรียนคุณ ${order.customerName}\nท่านสามารถกดเปิดลิงก์ด้านล่างเพื่อเขียนรีวิวและให้คะแนนความพึงพอใจได้ทันทีโดยไม่ต้องค้นหาเองค่ะ 👇\n🔗 ${directLink}\n\nขอขอบพระคุณล่วงหน้าค่ะ 🙏✨`;
                                  
                                  // 1. Copy to clipboard
                                  try {
                                    await navigator.clipboard.writeText(reviewInvitationText);
                                  } catch (err) {}

                                  // 2. LINE Push API if lineUserId exists
                                  let pushed = false;
                                  if (order.lineUserId) {
                                    try {
                                      const res = await fetch('/api/send-status', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          userId: order.lineUserId,
                                          message: reviewInvitationText
                                        })
                                      });
                                      const data = await res.json();
                                      if (res.ok && data.success) {
                                        pushed = true;
                                      }
                                    } catch (err) {}
                                  }

                                  // 3. Open LINE app chat / message scheme
                                  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(reviewInvitationText)}`;
                                  window.open(lineShareUrl, '_blank');

                                  // 4. Alert
                                  if (pushed) {
                                    alert(`📲 ส่งลิงก์เขียนรีวิวให้ คุณ${order.customerName.replace('คุณ', '').trim()} เข้า LINE เรียบร้อยแล้วค่ะ! ✨`);
                                  } else {
                                    alert(`📲 ส่งลิงก์เขียนรีวิวให้ คุณ${order.customerName.replace('คุณ', '').trim()} เรียบร้อยแล้วค่ะ!\n(เปิดแอป LINE พร้อมคัดลอกข้อความลง Clipboard ให้อัตโนมัติค่ะ) ✨`);
                                  }
                                }}
                                className="bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-extrabold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer border border-pink-600 shadow-xs active:scale-95 flex-1"
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span>ส่งลิงก์เขียนรีวิวให้ลูกค้า 📲</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentStatusCfg = STATUS_MAP[order.status];
                                  const discountVal = order.discount || 0;
                                  const unpaid = Math.max(0, order.price - order.deposit - discountVal);
                                  const formattedDelivery = new Date(order.deliveryDate).toLocaleDateString('th-TH', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  });
                                  const portalUrl = `${publicUrl}?tab=customer&search=${encodeURIComponent(order.customerPhone)}&mode=customer`;
                                  const message = `⚜️ อัปเดตสถานะชุดสั่งตัด NUNUH Boutique ⚜️\n\nเรียนคุณ: ${order.customerName}\nรหัสออเดอร์: ${order.orderNumber}\nประเภทชุด: ${order.dressType}\n\n📍 สถานะปัจจุบัน: [${currentStatusCfg.label}]\n➡️ "${currentStatusCfg.description}"\n\n📅 กำหนดส่งมอบ: ${formattedDelivery}\n\nท่านสามารถตรวจสอบข้อมูลสัดส่วนและติดตามความคืบหน้าแบบละเอียดด้วยตนเองได้ที่นี่:\n🔗 ${portalUrl}\n\nขอขอบพระคุณที่เลือกใช้บริการค่ะ ✨`;
                                  
                                  navigator.clipboard.writeText(message);
                                  alert(`คัดลอกข้อความสถานะอัปเดตของ ${order.customerName} เรียบร้อยแล้ว! สามารถนำไปส่งให้ลูกค้าได้ทันทีค่ะ 📋`);
                                }}
                                className="bg-natural-sand hover:bg-natural-wheat/80 text-natural-espresso text-[11px] font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer border border-natural-wheat/50 flex-1"
                              >
                                <span>คัดลอกข้อความ 📋</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLineOaChat(order);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs flex-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>แชท LINE OA 🟢</span>
                            </button>
                          </div>
                        </div>

                        {/* Action buttons (Delete & Edit) */}
                        <div className="pt-3 border-t border-natural-sand flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingOrder(order);
                              }}
                              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>แก้ไขออเดอร์นี้</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`คุณต้องการยกเลิกและลบออเดอร์ของ ${order.customerName} ใช่หรือไม่?`)) {
                                  onDeleteOrder(order.id);
                                }
                              }}
                              className="text-xs text-rose-700 hover:text-rose-800 font-semibold flex items-center space-x-1 px-2.5 py-1.5 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-rose-200"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>ลบออเดอร์นี้</span>
                            </button>

                            {(order.isLocked || order.pickupSignature) && (
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                <span>ลูกค้าเซ็นแล้ว (เจ้าของแก้ไขได้)</span>
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleExpand(order.id)}
                            className="text-[11px] text-natural-espresso/60 hover:text-natural-espresso font-bold uppercase tracking-wider cursor-pointer"
                          >
                            ปิดรายละเอียด &uarr;
                          </button>
                        </div>

                      </div>

                    </div>

                    {/* Customer Body Photos Section */}
                    <div className="bg-white p-5 rounded-xl border border-natural-wheat shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-natural-sand pb-2">
                        <h5 className="font-serif font-bold text-natural-espresso text-xs flex items-center space-x-1.5">
                          <Camera className="h-3.5 w-3.5 text-natural-clay" />
                          <span>📸 รูปถ่ายลูกค้าสำหรับตัดเย็บ (Customer Body Proportions)</span>
                        </h5>
                        <span className="text-[10px] text-natural-espresso/50 font-medium">ภาพสัดส่วนเพื่อความแม่นยำในการทำแพทเทิร์น</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                        {/* Front View */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-natural-espresso/70 text-center">ภาพถ่ายด้านหน้า (Front)</p>
                          {order.customerPhotoFront ? (
                            <div className="relative rounded-xl overflow-hidden border border-natural-wheat bg-natural-sand/5 max-h-48 group flex items-center justify-center">
                              <img 
                                src={order.customerPhotoFront} 
                                alt="Front proportion" 
                                className="w-full object-contain max-h-48 rounded-lg cursor-zoom-in"
                                referrerPolicy="no-referrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const imgWindow = window.open();
                                  if (imgWindow) {
                                    imgWindow.document.write(`<img src="${order.customerPhotoFront}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="border border-dashed border-natural-sand rounded-xl p-4 text-center text-natural-espresso/45 bg-natural-cream/10 text-xs italic flex flex-col items-center justify-center h-28">
                              <span>ไม่มีรูปถ่ายด้านหน้า</span>
                            </div>
                          )}
                        </div>

                        {/* Side View */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-natural-espresso/70 text-center">ภาพถ่ายด้านข้าง (Side)</p>
                          {order.customerPhotoSide ? (
                            <div className="relative rounded-xl overflow-hidden border border-natural-wheat bg-natural-sand/5 max-h-48 group flex items-center justify-center">
                              <img 
                                src={order.customerPhotoSide} 
                                alt="Side proportion" 
                                className="w-full object-contain max-h-48 rounded-lg cursor-zoom-in"
                                referrerPolicy="no-referrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const imgWindow = window.open();
                                  if (imgWindow) {
                                    imgWindow.document.write(`<img src="${order.customerPhotoSide}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="border border-dashed border-natural-sand rounded-xl p-4 text-center text-natural-espresso/45 bg-natural-cream/10 text-xs italic flex flex-col items-center justify-center h-28">
                              <span>ไม่มีรูปถ่ายด้านข้าง</span>
                            </div>
                          )}
                        </div>

                        {/* Back View */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-natural-espresso/70 text-center">ภาพถ่ายด้านหลัง (Back)</p>
                          {order.customerPhotoBack ? (
                            <div className="relative rounded-xl overflow-hidden border border-natural-wheat bg-natural-sand/5 max-h-48 group flex items-center justify-center">
                              <img 
                                src={order.customerPhotoBack} 
                                alt="Back proportion" 
                                className="w-full object-contain max-h-48 rounded-lg cursor-zoom-in"
                                referrerPolicy="no-referrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const imgWindow = window.open();
                                  if (imgWindow) {
                                    imgWindow.document.write(`<img src="${order.customerPhotoBack}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="border border-dashed border-natural-sand rounded-xl p-4 text-center text-natural-espresso/45 bg-natural-cream/10 text-xs italic flex flex-col items-center justify-center h-28">
                              <span>ไม่มีรูปถ่ายด้านหลัง</span>
                            </div>
                          )}
                        </div>

                        {/* Extra View 1 */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-natural-espresso/70 text-center">ภาพเพิ่มเติม 1</p>
                          {order.customerPhotoExtra1 ? (
                            <div className="relative rounded-xl overflow-hidden border border-natural-wheat bg-natural-sand/5 max-h-48 group flex items-center justify-center">
                              <img 
                                src={order.customerPhotoExtra1} 
                                alt="Extra proportion 1" 
                                className="w-full object-contain max-h-48 rounded-lg cursor-zoom-in"
                                referrerPolicy="no-referrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const imgWindow = window.open();
                                  if (imgWindow) {
                                    imgWindow.document.write(`<img src="${order.customerPhotoExtra1}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="border border-dashed border-natural-sand rounded-xl p-4 text-center text-natural-espresso/45 bg-natural-cream/10 text-xs italic flex flex-col items-center justify-center h-28">
                              <span>ไม่มีภาพเพิ่มเติม 1</span>
                            </div>
                          )}
                        </div>

                        {/* Extra View 2 */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-natural-espresso/70 text-center">ภาพเพิ่มเติม 2</p>
                          {order.customerPhotoExtra2 ? (
                            <div className="relative rounded-xl overflow-hidden border border-natural-wheat bg-natural-sand/5 max-h-48 group flex items-center justify-center">
                              <img 
                                src={order.customerPhotoExtra2} 
                                alt="Extra proportion 2" 
                                className="w-full object-contain max-h-48 rounded-lg cursor-zoom-in"
                                referrerPolicy="no-referrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const imgWindow = window.open();
                                  if (imgWindow) {
                                    imgWindow.document.write(`<img src="${order.customerPhotoExtra2}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="border border-dashed border-natural-sand rounded-xl p-4 text-center text-natural-espresso/45 bg-natural-cream/10 text-xs italic flex flex-col items-center justify-center h-28">
                              <span>ไม่มีภาพเพิ่มเติม 2</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      <PrintOrderModal 
        order={printingOrder} 
        isOpen={printingOrder !== null} 
        onClose={() => setPrintingOrder(null)} 
        boutiqueLogo={boutiqueLogo}
        boutiquePhone={boutiquePhone}
      />

      {/* Google Sheets Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-natural-espresso/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-natural-wheat relative space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 text-natural-espresso/40 hover:text-natural-espresso p-1.5 rounded-lg hover:bg-natural-sand transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full inline-block">
                Google Sheets & Excel Integration
              </span>
              <h3 className="text-xl font-serif font-extrabold text-natural-espresso">
                ส่งออกข้อมูลไปยัง Google Sheets 📊
              </h3>
              <p className="text-xs text-natural-espresso/70">
                เลือกประเภทตารางที่ต้องการ เพื่อนำข้อมูลไปวางหรือดาวน์โหลดเข้า Google Sheets พร้อมคำนวณจำนวนวันที่ใช้ในแต่ละสถานะให้อัตโนมัติ
              </p>
            </div>

            {/* Tab Selection */}
            <div className="flex rounded-xl bg-natural-sand/30 p-1 border border-natural-wheat/60 gap-1">
              <button
                type="button"
                onClick={() => setExportTab('master')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  exportTab === 'master'
                    ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200'
                    : 'text-natural-espresso/70 hover:text-natural-espresso'
                }`}
              >
                📋 1. สรุปภาพรวมออเดอร์ & ไทม์ไลน์
              </button>
              <button
                type="button"
                onClick={() => setExportTab('transitions')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  exportTab === 'transitions'
                    ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200'
                    : 'text-natural-espresso/70 hover:text-natural-espresso'
                }`}
              >
                ⏱️ 2. ตารางระยะเวลาแต่ละสถานะ (รายขั้นตอน)
              </button>
            </div>

            {exportTab === 'master' ? (
              <div className="space-y-4">
                <div className="bg-natural-cream/20 p-3 rounded-xl border border-natural-wheat/70 text-xs text-natural-espresso/80 space-y-1">
                  <p className="font-bold text-natural-espresso">📌 รายละเอียดตารางสรุปภาพรวมออเดอร์:</p>
                  <p className="text-[11px] text-natural-espresso/70">
                    แสดง 1 แถวต่อ 1 ออเดอร์ พร้อมข้อมูลลูกค้า สัดส่วน การชำระเงิน และมีคอลัมน์พิเศษ <strong>"จำนวนวันในสถานะปัจจุบัน"</strong>, <strong>"ระยะเวลารวมตั้งแต่สั่งตัด"</strong> และ <strong>"สรุปไทม์ไลน์และระยะเวลากี่วันในแต่ละสถานะ"</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="border border-natural-wheat hover:border-emerald-500/50 p-4 rounded-xl bg-white space-y-2.5 flex flex-col justify-between shadow-3xs">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                        <span>📋 วิธีคัดลอก-วาง (เร็วที่สุด)</span>
                      </h4>
                      <p className="text-[11px] text-natural-espresso/70 leading-relaxed">
                        คัดลอกตารางแล้วกด <strong>Ctrl + V</strong> หรือ <strong>Cmd + V</strong> ใน Google Sheets ได้ทันที
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const tsv = generateTSV();
                        await navigator.clipboard.writeText(tsv);
                        alert('คัดลอกข้อมูลตารางภาพรวมออเดอร์เรียบร้อยแล้วค่ะ! เปิด Google Sheets แล้วกดปุ่มวาง (Ctrl+V) ได้ทันที');
                      }}
                      className="w-full py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                    >
                      คัดลอกตารางภาพรวม (Copy TSV)
                    </button>
                  </div>

                  <div className="border border-natural-wheat hover:border-emerald-500/50 p-4 rounded-xl bg-white space-y-2.5 flex flex-col justify-between shadow-3xs">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                        <span>💾 ดาวน์โหลดไฟล์ CSV</span>
                      </h4>
                      <p className="text-[11px] text-natural-espresso/70 leading-relaxed">
                        ดาวน์โหลดไฟล์ .CSV รองรับภาษาไทย นำเข้าสู่โปรแกรมจัดการข้อมูลได้สะดวก
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        downloadCSV();
                        alert('ดาวน์โหลดไฟล์ CSV ตารางภาพรวมออเดอร์เรียบร้อยแล้วค่ะ!');
                      }}
                      className="w-full py-2 bg-natural-espresso text-white font-bold text-xs rounded-lg hover:bg-natural-clay transition-colors shadow-xs cursor-pointer"
                    >
                      ดาวน์โหลดไฟล์ CSV
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <p className="font-bold">✨ รายละเอียดตารางวิเคราะห์ระยะเวลาการทำงาน (KPI Duration Log):</p>
                  <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                    แตกบันทึกทุกขั้นตอนการตัดเย็บออกมาเป็นแถวอย่างชัดเจน เช่น <strong>รับออร์เดอร์ ➔ ซื้อผ้า ➔ ระหว่างการปัก (ใช้เวลา 4 วัน) ➔ ระหว่างการปักคริสตัล (ใช้เวลา 3 วัน)</strong> พร้อมระบุวันที่เริ่มต้นและวันที่ส่งต่อขั้นตอน เหมาะอย่างยิ่งสำหรับการคำนวณและวัดผลระยะเวลาทำงานของแต่ละช่าง/แผนก
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="border border-emerald-200 hover:border-emerald-500/50 p-4 rounded-xl bg-white space-y-2.5 flex flex-col justify-between shadow-3xs">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                        <span>📋 วิธีคัดลอก-วาง (เร็วที่สุด)</span>
                      </h4>
                      <p className="text-[11px] text-natural-espresso/70 leading-relaxed">
                        คัดลอกตารางระยะเวลารายขั้นตอน แล้วนำไปกด <strong>Ctrl + V</strong> ในแท็บใหม่ของ Google Sheets
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const tsv = generateTransitionsTSV();
                        await navigator.clipboard.writeText(tsv);
                        alert('คัดลอกข้อมูลตารางระยะเวลารายขั้นตอนเรียบร้อยแล้วค่ะ! เปิด Google Sheets แล้วกดปุ่มวาง (Ctrl+V) ได้ทันที');
                      }}
                      className="w-full py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                    >
                      คัดลอกตารางระยะเวลา (Copy TSV)
                    </button>
                  </div>

                  <div className="border border-emerald-200 hover:border-emerald-500/50 p-4 rounded-xl bg-white space-y-2.5 flex flex-col justify-between shadow-3xs">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                        <span>💾 ดาวน์โหลดไฟล์ CSV</span>
                      </h4>
                      <p className="text-[11px] text-natural-espresso/70 leading-relaxed">
                        ดาวน์โหลดไฟล์ .CSV บันทึกระยะเวลารายขั้นตอน เพื่อสร้างแผนภูมิหรือสูตร SUM/AVERAGE ในชีต
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        downloadTransitionsCSV();
                        alert('ดาวน์โหลดไฟล์ CSV ตารางระยะเวลารายขั้นตอนเรียบร้อยแล้วค่ะ!');
                      }}
                      className="w-full py-2 bg-natural-espresso text-white font-bold text-xs rounded-lg hover:bg-natural-clay transition-colors shadow-xs cursor-pointer"
                    >
                      ดาวน์โหลดไฟล์ CSV
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Instruction Steps */}
            <div className="bg-natural-cream/30 rounded-xl p-3.5 border border-natural-wheat space-y-2">
              <h5 className="font-bold text-xs text-natural-espresso flex items-center gap-1.5">
                💡 คำแนะนำการใช้งานกับ Google Sheets:
              </h5>
              <ol className="text-[11px] text-natural-espresso/80 space-y-1.5 list-decimal pl-4 leading-relaxed">
                <li>เปิด <a href="https://sheets.google.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-bold">sheets.google.com</a> แล้วสร้าง Sheet เปล่า</li>
                <li>คลิกปุ่ม <strong>"คัดลอกข้อมูลตาราง (Copy TSV)"</strong> ด้านบน</li>
                <li>คลิกที่ช่อง <strong>A1</strong> ใน Google Sheets แล้วกด <strong>Ctrl + V</strong> (หรือ Cmd + V)</li>
                <li>หัวคอลัมน์ วันที่ และจำนวนวันจะถูกแยกช่องให้อัตโนมัติ สามารถนำไปเขียนสูตรคำนวณวันเฉลี่ยต่อขั้นตอนได้ทันที!</li>
              </ol>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-5 py-2 bg-natural-sand hover:bg-natural-wheat text-natural-espresso font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={(updated) => {
            if (onEditOrder) {
              onEditOrder(updated);
            }
            setEditingOrder(null);
          }}
        />
      )}

      {/* Quick Status and Date Update Modal */}
      {statusModalOrder && (
        <div className="fixed inset-0 bg-natural-espresso/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-natural-wheat relative space-y-5 animate-scale-up">
            <button
              type="button"
              onClick={() => setStatusModalOrder(null)}
              className="absolute top-4 right-4 text-natural-espresso/40 hover:text-natural-espresso p-1.5 rounded-lg hover:bg-natural-sand transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 border-b border-natural-sand pb-3">
              <div className="w-10 h-10 rounded-xl bg-natural-sand flex items-center justify-center text-natural-clay font-bold text-lg">
                ⚡
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-natural-espresso">
                  ปรับปรุงสถานะงาน & วันที่อัปเดต
                </h3>
                <p className="text-xs text-natural-espresso/60 font-mono">
                  ออเดอร์: {statusModalOrder.orderNumber} ({statusModalOrder.customerName})
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-natural-espresso/70 mb-1.5">
                  เลือกขั้นตอนสถานะ (22 ขั้นตอนติดตาม):
                </label>
                <select
                  value={statusModalTarget}
                  onChange={(e) => setStatusModalTarget(e.target.value as OrderStatus)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-natural-wheat bg-natural-cream/20 font-bold text-natural-espresso focus:ring-2 focus:ring-natural-clay/20 focus:border-natural-clay cursor-pointer"
                >
                  {PRODUCTION_PIPELINE_STEPS.map((os, index) => (
                    <option key={os} value={os}>
                      {index + 1}. {STATUS_MAP[os]?.label || os}
                    </option>
                  ))}
                </select>
                {STATUS_MAP[statusModalTarget]?.description && (
                  <p className="text-[11px] text-natural-clay font-medium mt-1.5 bg-natural-sand/30 p-2 rounded-lg border border-natural-wheat/40">
                    ℹ️ {STATUS_MAP[statusModalTarget].description}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-natural-espresso/70 mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-natural-clay" /> วันที่เปลี่ยนสถานะ:
                </label>
                <input
                  type="date"
                  value={statusModalDate}
                  onChange={(e) => setStatusModalDate(e.target.value)}
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-natural-wheat bg-natural-cream/10 font-semibold focus:ring-2 focus:ring-natural-clay/20 focus:border-natural-clay"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-natural-espresso/70 mb-1.5">
                  บันทึกโน้ตเพิ่มเติม (ถ้ามี เช่น เลขพัสดุ EMS / ผลการลองชุด):
                </label>
                <textarea
                  rows={2}
                  value={statusModalNote}
                  onChange={(e) => setStatusModalNote(e.target.value)}
                  placeholder="เช่น ส่ง EMS แล้ว หมายเลข ED123456789TH หรือ ลูกค้าแจ้งขอเก็บเอวเข้า 1 ซม."
                  className="w-full text-xs p-3 rounded-xl border border-natural-wheat focus:ring-2 focus:ring-natural-clay/20 focus:border-natural-clay"
                />
              </div>

              {/* LINE Notification Auto Send Toggle */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 cursor-pointer hover:bg-emerald-50 transition-colors">
                <input
                  type="checkbox"
                  checked={statusModalSendLine}
                  onChange={(e) => setStatusModalSendLine(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>📲 ส่งแจ้งเตือนสถานะใหม่นี้เข้า LINE ลูกค้าทันที</span>
                    <span className="bg-[#06C755] text-white text-[9px] font-black px-1.5 py-0.5 rounded">LINE OA</span>
                  </span>
                  <p className="text-emerald-700/80 text-[11px] mt-0.5">
                    ระบบจะจัดส่งข้อความแจ้งเตือนภาษาไทยพร้อมลิงก์ติดตามงานเข้า LINE ให้ทันทีค่ะ
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end space-x-2.5 pt-2 border-t border-natural-sand">
              <button
                type="button"
                onClick={() => setStatusModalOrder(null)}
                className="px-4 py-2 bg-natural-sand hover:bg-natural-wheat text-natural-espresso font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveStatusModal}
                className="px-5 py-2 bg-natural-espresso hover:bg-natural-clay text-natural-cream font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="h-4 w-4" />
                <span>บันทึกสถานะ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {signatureModalOrder && (
        <SignatureModal
          order={signatureModalOrder}
          isOpen={!!signatureModalOrder}
          onClose={() => setSignatureModalOrder(null)}
          onConfirmSignature={(orderId, sigUrl, signeeName, signedAt) => {
            if (onConfirmPickupSignature) {
              onConfirmPickupSignature(orderId, sigUrl, signeeName, signedAt);
            }
            setSignatureModalOrder(null);
          }}
        />
      )}

      {/* LINE Notification Feedback Modal */}
      {lineStatusModal && lineStatusModal.isOpen && (
        <div className="fixed inset-0 bg-natural-espresso/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-natural-wheat relative space-y-4 animate-scale-up">
            <button
              type="button"
              onClick={() => setLineStatusModal(null)}
              className="absolute top-4 right-4 text-natural-espresso/40 hover:text-natural-espresso p-1.5 rounded-lg hover:bg-natural-sand transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 border-b border-natural-sand/70 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#06C755] border border-emerald-100 flex items-center justify-center font-bold text-xl shadow-3xs">
                📲
              </div>
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-natural-espresso flex items-center gap-1.5">
                  <span>แจ้งเตือนสถานะลูกค้าทาง LINE</span>
                  <span className="bg-[#06C755] text-white text-[10px] font-black px-1.5 py-0.5 rounded">LINE OA</span>
                </h3>
                <p className="text-xs text-natural-espresso/60 font-mono">
                  ออเดอร์ #{lineStatusModal.order.orderNumber} • คุณ {lineStatusModal.order.customerName}
                </p>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100/80 text-xs text-emerald-950 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>{lineStatusModal.feedbackText}</span>
              </p>
            </div>

            {/* Message Preview */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold text-natural-espresso/70">
                <span>ข้อความที่ถูกจัดเตรียมและคัดลอก:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lineStatusModal.message);
                    alert('📋 คัดลอกข้อความลงคลิปบอร์ดแล้วค่ะ');
                  }}
                  className="text-natural-clay hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>คัดลอกซ้ำ</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={7}
                value={lineStatusModal.message}
                className="w-full text-[11px] p-3 rounded-xl border border-natural-wheat bg-natural-cream/10 font-sans text-natural-espresso/90 focus:outline-none select-all"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-natural-sand">
              <a
                href={lineStatusModal.directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <MessageSquare className="h-4 w-4" />
                <span>เปิดห้องแชท LINE 💬</span>
              </a>

              <a
                href={`https://line.me/R/msg/text/?${encodeURIComponent(lineStatusModal.message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <Share2 className="h-4 w-4" />
                <span>แชร์เข้า LINE</span>
              </a>

              <button
                type="button"
                onClick={() => setLineStatusModal(null)}
                className="px-4 py-2.5 bg-natural-sand hover:bg-natural-wheat text-natural-espresso font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
