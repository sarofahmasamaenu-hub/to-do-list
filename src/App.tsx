/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, OrderStatus, STATUS_MAP, CatalogueItem, CustomerReview } from './types';
import { INITIAL_ORDERS, INITIAL_CATALOGUE, INITIAL_REVIEWS } from './initialData';
import { playNewOrderSound } from './utils/sound';
import {
  saveOrderToFirestore,
  saveOrdersBatchToFirestore,
  deleteOrderFromFirestore,
  fetchOrdersFromFirestore,
  subscribeToOrders,
  saveSettingsToFirestore,
  saveCatalogueToFirestore,
  testFirestoreConnection
} from './firebase';

// Components
import DashboardStats from './components/DashboardStats';
import OrderForm from './components/OrderForm';
import OrderTracker from './components/OrderTracker';
import DeliveryCalendar from './components/DeliveryCalendar';
import DressCatalogue from './components/DressCatalogue';
import CustomerPortal from './components/CustomerPortal';
import ReviewDashboard from './components/ReviewDashboard';
import CustomerDashboard from './components/CustomerDashboard';

// Icons
import { 
  ClipboardCheck, 
  Scissors, 
  Calendar as CalendarIcon, 
  Sparkles, 
  PlusCircle, 
  Heart,
  Store,
  Layers,
  Star,
  Users,
  Settings,
  Phone,
  Volume2,
  VolumeX,
  Bell,
  AlertTriangle,
  Send,
  Upload,
  Image as ImageIcon,
  Trash2,
  Camera,
  Check,
  Database,
  MessageSquare,
  Key,
  ShieldCheck,
  Copy,
  ExternalLink,
  HelpCircle,
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [preselectedDesignId, setPreselectedDesignId] = useState<string>('custom');
  const [activeTab, setActiveTab] = useState<string>('tracker'); // tracker, orderForm, calendar, catalogue, reviews
  const [isCustomerMode, setIsCustomerMode] = useState<boolean>(false);
  const [isStaffMode, setIsStaffMode] = useState<boolean>(false);
  const [isReviewDirectLink, setIsReviewDirectLink] = useState<boolean>(false);
  const [activeStaffList, setActiveStaffList] = useState<Array<{ id: string; name: string; branch: string; loginTime: number }>>(() => {
    const saved = localStorage.getItem('nunuh_active_staff_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const singleSaved = localStorage.getItem('nunuh_logged_in_staff');
    if (singleSaved) {
      try {
        const p = JSON.parse(singleSaved);
        if (p && p.name) {
          return [{ id: 'staff-' + Date.now(), name: p.name, branch: p.branch || 'สาขานราธิวาส', loginTime: Date.now() }];
        }
      } catch (e) {}
    }
    return [];
  });

  const [currentStaff, setCurrentStaff] = useState<{ id?: string; name: string; branch: string } | null>(() => {
    if (activeStaffList.length > 0) {
      return { id: activeStaffList[0].id, name: activeStaffList[0].name, branch: activeStaffList[0].branch };
    }
    const saved = localStorage.getItem('nunuh_logged_in_staff');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [showStaffDetailModal, setShowStaffDetailModal] = useState<boolean>(false);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('nunuh_sound_enabled') !== 'false';
  });

  const [ownerLineUserId, setOwnerLineUserId] = useState<string>(() => {
    return localStorage.getItem('nunuh_owner_line_user_id') || '';
  });

  const knownOrderIdsRef = React.useRef<Set<string> | null>(null);

  // Sound notification trigger when new order arrives
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const currentIds = new Set(orders.map(o => o.id));

    if (knownOrderIdsRef.current !== null) {
      let hasNewOrder = false;
      for (const id of currentIds) {
        if (!knownOrderIdsRef.current.has(id)) {
          hasNewOrder = true;
          break;
        }
      }

      if (hasNewOrder && soundEnabled) {
        playNewOrderSound();
      }
    }

    knownOrderIdsRef.current = currentIds;
  }, [orders, soundEnabled]);

  const handleStaffLogin = (name: string, branch: string) => {
    const newStaff = { id: 'staff-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5), name: name.trim(), branch: branch.trim(), loginTime: Date.now() };
    const updatedList = [newStaff, ...activeStaffList];
    setActiveStaffList(updatedList);
    localStorage.setItem('nunuh_active_staff_list', JSON.stringify(updatedList));
    setCurrentStaff({ id: newStaff.id, name: newStaff.name, branch: newStaff.branch });
    localStorage.setItem('nunuh_logged_in_staff', JSON.stringify({ id: newStaff.id, name: newStaff.name, branch: newStaff.branch }));
    setShowAddStaffModal(false);

    // Sync login session to backend server
    fetch('/api/staff/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStaff)
    }).catch(() => {});
  };

  const handleRemoveStaffSession = (id: string) => {
    const removedStaff = activeStaffList.find(s => s.id === id);
    const updatedList = activeStaffList.filter(s => s.id !== id);
    setActiveStaffList(updatedList);
    localStorage.setItem('nunuh_active_staff_list', JSON.stringify(updatedList));

    if (currentStaff) {
      const isThisStaff = currentStaff.id === id || (removedStaff && currentStaff.name === removedStaff.name && currentStaff.branch === removedStaff.branch);
      if (isThisStaff) {
        if (updatedList.length > 0) {
          const nextStaff = { id: updatedList[0].id, name: updatedList[0].name, branch: updatedList[0].branch };
          setCurrentStaff(nextStaff);
          localStorage.setItem('nunuh_logged_in_staff', JSON.stringify(nextStaff));
        } else {
          setCurrentStaff(null);
          localStorage.removeItem('nunuh_logged_in_staff');
        }
      }
    }

    // Broadcast channel signal to immediately sync across open browser tabs
    try {
      const channel = new BroadcastChannel('nunuh_multiuser_sync_channel');
      channel.postMessage({ type: 'STAFF_FORCED_LOGOUT', id, staffName: removedStaff?.name });
      channel.close();
    } catch (e) {}

    // Sync logout session to backend server
    fetch('/api/staff/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).catch(() => {});
  };

  const handleStaffLogout = () => {
    setActiveStaffList([]);
    setCurrentStaff(null);
    localStorage.removeItem('nunuh_active_staff_list');
    localStorage.removeItem('nunuh_logged_in_staff');

    // Broadcast channel signal for all staff sessions
    try {
      const channel = new BroadcastChannel('nunuh_multiuser_sync_channel');
      channel.postMessage({ type: 'STAFF_FORCED_LOGOUT', logoutAll: true });
      channel.close();
    } catch (e) {}

    // Sync logout all sessions to backend server
    fetch('/api/staff/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoutAll: true })
    }).catch(() => {});
  };

  const filteredOrdersForStaff = isStaffMode && currentStaff?.branch
    ? orders.filter(o => o.branch === currentStaff.branch || o.staffBranch === currentStaff.branch || !o.branch)
    : orders;
  const [copiedStaffLink, setCopiedStaffLink] = useState<boolean>(false);
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('nunuh_selected_theme') || 'pink';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [boutiquePhone, setBoutiquePhone] = useState<string>(() => {
    return localStorage.getItem('nunuh_boutique_phone') || '086-555-1234';
  });

  const [boutiqueLogo, setBoutiqueLogo] = useState<string>(() => {
    return localStorage.getItem('nunuh_boutique_logo') || '';
  });

  const [dbStatus, setDbStatus] = useState<{ postgresActive?: boolean; mode?: string; hasDatabaseUrl?: boolean } | null>(null);

  // LINE OA & Messaging API Configuration States
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState<string>(() => {
    return localStorage.getItem('nunuh_line_channel_access_token') || '';
  });
  const [lineChannelSecret, setLineChannelSecret] = useState<string>(() => {
    return localStorage.getItem('nunuh_line_channel_secret') || '';
  });
  const [lineOaId, setLineOaId] = useState<string>(() => {
    return localStorage.getItem('nunuh_line_oa_id') || '@237aynfq';
  });
  const [lineOaChatUrl, setLineOaChatUrl] = useState<string>(() => {
    return localStorage.getItem('nunuh_line_oa_chat_url') || 'https://chat.line.biz/U7ad64905450d2c18cf2eb27f61c5ea4c';
  });
  const [lineConfigStatus, setLineConfigStatus] = useState<{
    tokenSet?: boolean;
    secretSet?: boolean;
    lineOaId?: string;
    webhookUrl?: string;
    source?: string;
  } | null>(null);
  const [settingsTab, setSettingsTab] = useState<'general' | 'line'>('general');
  const [testPushUserId, setTestPushUserId] = useState<string>('');
  const [isTestingPush, setIsTestingPush] = useState<boolean>(false);
  const [testPushResult, setTestPushResult] = useState<{ success: boolean; msg: string; tip?: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [isTestingFirebase, setIsTestingFirebase] = useState<boolean>(false);
  const [firebaseTestResult, setFirebaseTestResult] = useState<{ success: boolean; latencyMs?: number; projectId?: string; message: string } | null>(null);

  const fetchLineConfigStatus = async () => {
    try {
      const res = await fetch('/api/line-config-status');
      if (res.ok) {
        const data = await res.json();
        setLineConfigStatus(data);
      }
    } catch (e) {
      console.warn('Could not fetch LINE config status:', e);
    }
  };

  const handleTestPushMessage = async () => {
    if (!testPushUserId.trim()) {
      setTestPushResult({
        success: false,
        msg: 'กรุณาระบุ LINE User ID (ขึ้นต้นด้วยตัว U เช่น Uf150dba359d90...)'
      });
      return;
    }
    setIsTestingPush(true);
    setTestPushResult(null);
    try {
      const res = await fetch('/api/test-line-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: testPushUserId.trim(),
          testMessage: `⚜️ ทดสอบการเชื่อมต่อ LINE Messaging API สำเร็จ! ⚜️\nระบบห้องเสื้อ NUNUH Boutique ได้เชื่อมต่อกับบอท LINE OA เรียบร้อยแล้วค่ะ ✨`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestPushResult({
          success: true,
          msg: '🎉 ส่งข้อความทดสอบสำเร็จ! ข้อความส่งตรงถึง LINE ของผู้ใช้เรียบร้อยแล้วค่ะ'
        });
      } else {
        setTestPushResult({
          success: false,
          msg: data.error || 'เกิดข้อผิดพลาดในการส่งข้อความ',
          tip: data.helpTip || 'โปรดตรวจสอบความถูกต้องของ Token และตรวจสอบว่าผู้ใช้ได้แอดเป็นเพื่อนกับ LINE OA แล้ว'
        });
      }
    } catch (err: any) {
      setTestPushResult({
        success: false,
        msg: `การเชื่อมต่อเซิร์ฟเวอร์ขัดข้อง: ${err.message || err}`
      });
    } finally {
      setIsTestingPush(false);
    }
  };

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.warn('Could not fetch DB status:', e);
    }
  };

  useEffect(() => {
    checkDbStatus();
    fetchLineConfigStatus();
  }, []);

  const handleUpdateBoutiquePhone = async (newPhone: string) => {
    setBoutiquePhone(newPhone);
    localStorage.setItem('nunuh_boutique_phone', newPhone);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boutiquePhone: newPhone })
      });
    } catch (e) {
      console.warn('Failed to sync boutique phone with server:', e);
    }
  };

  const handleUpdateBoutiqueLogo = async (newLogo: string) => {
    setBoutiqueLogo(newLogo);
    localStorage.setItem('nunuh_boutique_logo', newLogo);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boutiqueLogo: newLogo })
      });
    } catch (e) {
      console.warn('Failed to sync boutique logo with server:', e);
    }
  };

  const handleLogoFileUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, WebP, SVG) สำหรับโลโก้ค่ะ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const rawDataUrl = readerEvent.target?.result as string;
      if (!rawDataUrl) return;

      if (file.type === 'image/svg+xml') {
        handleUpdateBoutiqueLogo(rawDataUrl);
        return;
      }

      // Resize / compress logo to keep state lightweight (<400px)
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/png', 0.9);
          handleUpdateBoutiqueLogo(compressedDataUrl);
        } else {
          handleUpdateBoutiqueLogo(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Save selected theme to localStorage when changed
  useEffect(() => {
    localStorage.setItem('nunuh_selected_theme', theme);
    // Sync to server
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    }).catch(() => {});
  }, [theme]);

  // ฟังก์ชันผสานข้อมูลออเดอร์โดยไม่ให้ข้อมูลทับกันหรือสูญหาย (Smart Order Merge)
  const mergeOrders = (current: Order[], incoming: Order[]): Order[] => {
    const deletedIdsStr = localStorage.getItem('nunuh_deleted_order_ids') || '[]';
    let deletedIds: string[] = [];
    try {
      deletedIds = JSON.parse(deletedIdsStr);
    } catch (e) {}
    const deletedSet = new Set(deletedIds);

    const map = new Map<string, Order>();
    for (const o of (current || [])) {
      if (o && o.id && !deletedSet.has(o.id)) {
        map.set(o.id, o);
      }
    }
    for (const o of (incoming || [])) {
      if (!o || !o.id || deletedSet.has(o.id)) continue;
      if (!map.has(o.id)) {
        map.set(o.id, o);
      } else {
        const existing = map.get(o.id)!;
        const existingTime = existing.updatedAt || 0;
        const incomingTime = o.updatedAt || 0;
        if (incomingTime >= existingTime) {
          map.set(o.id, { ...existing, ...o });
        }
      }
    }
    // เรียงลำดับตามวันที่สร้างหรือเลขที่ออเดอร์ล่าสุดให้อยู่ด้านบน
    return Array.from(map.values()).sort((a, b) => {
      const numA = a.orderNumber || '';
      const numB = b.orderNumber || '';
      return numB.localeCompare(numA, undefined, { numeric: true });
    });
  };

  // ซิงค์ข้อมูลกับ Server Backend
  const syncWithServer = async (ordersToUpload?: Order[]) => {
    try {
      const storedLocal = localStorage.getItem('nunuh_orders');
      let currentLocal: Order[] = [];
      if (storedLocal) {
        try {
          currentLocal = JSON.parse(storedLocal);
        } catch (e) {}
      }

      // First fetch latest from server / database
      let fetchedFromServer: Order[] = [];
      try {
        const getRes = await fetch('/api/orders');
        if (getRes.ok) {
          const data = await getRes.json();
          if (Array.isArray(data)) {
            fetchedFromServer = data;
          }
        }
      } catch (e) {}

      let combined = mergeOrders(currentLocal, fetchedFromServer);
      if (ordersToUpload && ordersToUpload.length > 0) {
        combined = mergeOrders(combined, ordersToUpload);
      }

      // Try fetching from Firebase Firestore as well
      try {
        const firestoreOrders = await fetchOrdersFromFirestore();
        if (firestoreOrders && firestoreOrders.length > 0) {
          combined = mergeOrders(combined, firestoreOrders);
        }
      } catch (e) {}

      setOrders(combined);
      localStorage.setItem('nunuh_orders', JSON.stringify(combined));
      
      const publicUrl = localStorage.getItem('nunuh_public_url') || window.location.origin;

      if (combined.length > 0) {
        // Also ensure orders are saved to Firestore in background
        saveOrdersBatchToFirestore(combined).catch(() => {});

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: combined, publicUrl })
        });
        
        if (response.ok) {
          const mergedFromServer = await response.json();
          if (Array.isArray(mergedFromServer) && mergedFromServer.length > 0) {
            const finalMerged = mergeOrders(combined, mergedFromServer);
            setOrders(finalMerged);
            localStorage.setItem('nunuh_orders', JSON.stringify(finalMerged));
          }
        }
      }
    } catch (e) {
      console.warn('Backend sync is temporarily unavailable, running in local-only mode:', e);
    }
  };

  const syncAllDataWithServer = async () => {
    // 1. Sync orders
    await syncWithServer();

    // 2. Sync catalogue
    try {
      const res = await fetch('/api/catalogue');
      if (res.ok) {
        const serverCat = await res.json();
        if (Array.isArray(serverCat) && serverCat.length > 0) {
          setCatalogue(serverCat);
          localStorage.setItem('nunuh_catalogue', JSON.stringify(serverCat));
        } else {
          // If server is empty, upload local catalogue
          const localCat = localStorage.getItem('nunuh_catalogue');
          if (localCat) {
            await fetch('/api/catalogue', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: localCat
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to sync catalogue:', e);
    }

    // 3. Sync settings
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const serverSettings = await res.json();
        if (serverSettings && typeof serverSettings === 'object' && Object.keys(serverSettings).length > 0) {
          if (serverSettings.boutiquePhone) {
            setBoutiquePhone(serverSettings.boutiquePhone);
            localStorage.setItem('nunuh_boutique_phone', serverSettings.boutiquePhone);
          }
          if (serverSettings.boutiqueLogo !== undefined) {
            setBoutiqueLogo(serverSettings.boutiqueLogo);
            localStorage.setItem('nunuh_boutique_logo', serverSettings.boutiqueLogo);
          }
          if (serverSettings.theme) {
            setTheme(serverSettings.theme);
            localStorage.setItem('nunuh_selected_theme', serverSettings.theme);
          }
          if (serverSettings.lineChannelAccessToken) {
            setLineChannelAccessToken(serverSettings.lineChannelAccessToken);
            localStorage.setItem('nunuh_line_channel_access_token', serverSettings.lineChannelAccessToken);
          }
          if (serverSettings.lineChannelSecret) {
            setLineChannelSecret(serverSettings.lineChannelSecret);
            localStorage.setItem('nunuh_line_channel_secret', serverSettings.lineChannelSecret);
          }
          if (serverSettings.ownerLineUserId) {
            setOwnerLineUserId(serverSettings.ownerLineUserId);
            localStorage.setItem('nunuh_owner_line_user_id', serverSettings.ownerLineUserId);
          }
          if (serverSettings.lineOaId) {
            setLineOaId(serverSettings.lineOaId);
            localStorage.setItem('nunuh_line_oa_id', serverSettings.lineOaId);
          }
          if (serverSettings.lineOaChatUrl) {
            setLineOaChatUrl(serverSettings.lineOaChatUrl);
            localStorage.setItem('nunuh_line_oa_chat_url', serverSettings.lineOaChatUrl);
          }
          if (serverSettings.publicUrl) {
            localStorage.setItem('nunuh_public_url', serverSettings.publicUrl);
          }
        } else {
          // If server is empty, upload local settings
          const localPhone = localStorage.getItem('nunuh_boutique_phone') || '086-555-1234';
          const localLogo = localStorage.getItem('nunuh_boutique_logo') || '';
          const localTheme = localStorage.getItem('nunuh_selected_theme') || 'pink';
          const localToken = localStorage.getItem('nunuh_line_channel_access_token') || '';
          const localSecret = localStorage.getItem('nunuh_line_channel_secret') || '';
          const localOwnerId = localStorage.getItem('nunuh_owner_line_user_id') || '';
          const localLineOaId = localStorage.getItem('nunuh_line_oa_id') || '@237aynfq';
          const localLineOaChatUrl = localStorage.getItem('nunuh_line_oa_chat_url') || 'https://chat.line.biz/U7ad64905450d2c18cf2eb27f61c5ea4c';
          const localPublicUrl = localStorage.getItem('nunuh_public_url') || window.location.origin;

          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              boutiquePhone: localPhone,
              boutiqueLogo: localLogo,
              theme: localTheme,
              lineChannelAccessToken: localToken,
              lineChannelSecret: localSecret,
              ownerLineUserId: localOwnerId,
              lineOaId: localLineOaId,
              lineOaChatUrl: localLineOaChatUrl,
              publicUrl: localPublicUrl
            })
          });
        }
      }
    } catch (e) {
      console.warn('Failed to sync settings:', e);
    }

    // 4. Sync reviews
    try {
      const res = await fetch('/api/reviews');
      if (res.ok) {
        const serverReviews = await res.json();
        if (Array.isArray(serverReviews) && serverReviews.length > 0) {
          setReviews(serverReviews);
          localStorage.setItem('nunuh_reviews', JSON.stringify(serverReviews));
        } else {
          // If server is empty, upload local reviews
          const localRev = localStorage.getItem('nunuh_reviews');
          if (localRev) {
            await fetch('/api/reviews', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: localRev
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to sync reviews:', e);
    }

    // 5. Sync active staff online list
    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        const serverStaff = await res.json();
        if (Array.isArray(serverStaff)) {
          setActiveStaffList(serverStaff);
          localStorage.setItem('nunuh_active_staff_list', JSON.stringify(serverStaff));
        }
      }
    } catch (e) {
      console.warn('Failed to sync staff list:', e);
    }
  };

  // โหลดข้อมูลออเดอร์และแคตตาล็อกจาก LocalStorage หรือตั้งค่าด้วยชุดข้อมูลเริ่มต้น
  useEffect(() => {
    let initialOrders = INITIAL_ORDERS;
    const savedOrders = localStorage.getItem('nunuh_orders');
    if (savedOrders) {
      try {
        let parsed = JSON.parse(savedOrders);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // กรองข้อมูลที่เป็นออเดอร์ตัวอย่างออกเพื่อให้พร้อมใช้งานจริง
          parsed = parsed.filter(o => !['order-1', 'order-2', 'order-3', 'order-4', 'order-5', 'order-6'].includes(o.id));
          initialOrders = mergeOrders(INITIAL_ORDERS, parsed);
        }
      } catch (e) {
        initialOrders = INITIAL_ORDERS;
      }
    }
    setOrders(initialOrders);
    localStorage.setItem('nunuh_orders', JSON.stringify(initialOrders));

    const savedCatalogue = localStorage.getItem('nunuh_catalogue');
    if (savedCatalogue) {
      try {
        let parsed = JSON.parse(savedCatalogue) as CatalogueItem[];
        // กรองแบบชุดตัวอย่างเริ่มต้นที่แถมมากับแอปออก (เช่น cat-1 ถึง cat-16) เพื่อให้เหลือแต่แบบชุดของเจ้าของร้านที่เพิ่มขึ้นมาใหม่เอง
        parsed = parsed.filter(item => {
          const idNum = parseInt(item.id.replace('cat-', ''), 10);
          return isNaN(idNum) || idNum > 10000;
        });
        
        const missingItems = INITIAL_CATALOGUE.filter(item => !parsed.some(p => p.id === item.id));
        if (missingItems.length > 0) {
          const merged = [...parsed, ...missingItems];
          setCatalogue(merged);
          localStorage.setItem('nunuh_catalogue', JSON.stringify(merged));
        } else {
          setCatalogue(parsed);
          localStorage.setItem('nunuh_catalogue', JSON.stringify(parsed));
        }
      } catch (e) {
        setCatalogue(INITIAL_CATALOGUE);
        localStorage.setItem('nunuh_catalogue', JSON.stringify(INITIAL_CATALOGUE));
      }
    } else {
      setCatalogue(INITIAL_CATALOGUE);
      localStorage.setItem('nunuh_catalogue', JSON.stringify(INITIAL_CATALOGUE));
    }

    const savedReviews = localStorage.getItem('nunuh_reviews');
    if (savedReviews) {
      try {
        let parsed = JSON.parse(savedReviews) as CustomerReview[];
        // กรองรีวิวตัวอย่างออกเพื่อให้พร้อมใช้งานจริง
        parsed = parsed.filter(r => !['rev-1', 'rev-2', 'rev-3'].includes(r.id) && !['order-1', 'order-2', 'order-3', 'order-4', 'order-5', 'order-6', 'order-past-1', 'order-past-2'].includes(r.orderId));
        const missingReviews = INITIAL_REVIEWS.filter(item => !parsed.some(p => p.id === item.id));
        if (missingReviews.length > 0) {
          const merged = [...parsed, ...missingReviews];
          setReviews(merged);
          localStorage.setItem('nunuh_reviews', JSON.stringify(merged));
        } else {
          setReviews(parsed);
          localStorage.setItem('nunuh_reviews', JSON.stringify(parsed));
        }
      } catch (e) {
        setReviews(INITIAL_REVIEWS);
        localStorage.setItem('nunuh_reviews', JSON.stringify(INITIAL_REVIEWS));
      }
    } else {
      setReviews(INITIAL_REVIEWS);
      localStorage.setItem('nunuh_reviews', JSON.stringify(INITIAL_REVIEWS));
    }

    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const roleParam = params.get('role');
    const tabParam = params.get('tab');
    const actionParam = params.get('action');
    if (actionParam === 'review' || params.get('review') === 'true') {
      setIsReviewDirectLink(true);
    }
    const savedMode = localStorage.getItem('nunuh_user_mode');
    
    // ตรวจสอบพารามิเตอร์ URL เพื่อกำหนดโหมดการใช้งาน
    // สำหรับเจ้าของแอป (ลิงก์หลักแบบปกติ): จะเข้าสู่หน้าแรก "ติดตามงาน / Home" (tracker) เสมอทุกครั้งที่เปิดแอป
    if (modeParam === 'staff' || roleParam === 'staff') {
      localStorage.setItem('nunuh_user_mode', 'staff');
      setIsStaffMode(true);
      setIsCustomerMode(false);
      if (tabParam && ['tracker', 'orderForm', 'catalogue'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      } else {
        setActiveTab('orderForm');
      }
    } else if (modeParam === 'customer') {
      localStorage.setItem('nunuh_user_mode', 'customer');
      setIsCustomerMode(true);
      setIsStaffMode(false);
      setActiveTab('customer');
    } else {
      // โหมดเจ้าของแอปหลัก: แสดงหน้าแรก "ติดตามงาน (Tracker Dashboard)" เสมอทุกครั้งเมื่อเข้าใช้
      localStorage.removeItem('nunuh_user_mode');
      setIsStaffMode(false);
      setIsCustomerMode(false);
      setActiveTab('tracker');
    }

    // เริ่มต้นซิงค์ข้อมูลกับ Backend ทันทีตอนหน้าเว็บโหลด
    syncAllDataWithServer();
  }, []);

  // จำกัดสิทธิ์ในโหมดลูกค้า: ให้เข้าถึงได้เฉพาะหน้า "สำหรับลูกค้า" (Customer Care & Review Portal) เท่านั้น
  useEffect(() => {
    if (isCustomerMode && activeTab !== 'customer') {
      setActiveTab('customer');
    }
  }, [isCustomerMode, activeTab]);

  // ซิงค์สตรีมข้อมูลเรียลไทม์ข้ามแท็บและหลายผู้ใช้งานที่ใช้ลิงก์เดียวกัน (BroadcastChannel + Storage Event + Polling)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    // เชื่อมต่อ SSE Stream (Server-Sent Events) เพื่อรับการอัปเดตข้อมูลแบบเรียลไทม์ทันทีข้ามเครื่อง (เช่น Staff เพิ่มออเดอร์ใหม่)
    let eventSource: EventSource | null = null;
    let sseRetryTimer: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'orders_updated') {
              let incomingActive: Order[] = [];
              let serverDeletedIds: string[] = [];

              if (Array.isArray(payload.data)) {
                incomingActive = payload.data;
              } else if (payload.data && typeof payload.data === 'object') {
                if (Array.isArray(payload.data.orders)) {
                  incomingActive = payload.data.orders;
                }
                if (Array.isArray(payload.data.deletedIds)) {
                  serverDeletedIds = payload.data.deletedIds;
                }
                if (payload.data.deletedId && !serverDeletedIds.includes(payload.data.deletedId)) {
                  serverDeletedIds.push(payload.data.deletedId);
                }
              }

              const deletedIdsStr = localStorage.getItem('nunuh_deleted_order_ids') || '[]';
              let localDeleted: string[] = [];
              try { localDeleted = JSON.parse(deletedIdsStr); } catch (e) {}

              const combinedDeleted = Array.from(new Set([...localDeleted, ...serverDeletedIds]));
              localStorage.setItem('nunuh_deleted_order_ids', JSON.stringify(combinedDeleted));

              const deletedSet = new Set(combinedDeleted);
              const cleanActive = incomingActive.filter((o: Order) => !deletedSet.has(o.id));

              setOrders(cleanActive);
              localStorage.setItem('nunuh_orders', JSON.stringify(cleanActive));
            } else if (payload.type === 'catalogue_updated' && Array.isArray(payload.data)) {
              setCatalogue(payload.data);
              localStorage.setItem('nunuh_catalogue', JSON.stringify(payload.data));
            } else if (payload.type === 'reviews_updated' && Array.isArray(payload.data)) {
              setReviews(payload.data);
              localStorage.setItem('nunuh_reviews', JSON.stringify(payload.data));
            } else if (payload.type === 'staff_updated' && Array.isArray(payload.data)) {
              setActiveStaffList(payload.data);
              localStorage.setItem('nunuh_active_staff_list', JSON.stringify(payload.data));
            } else if (payload.type === 'settings_updated' && payload.data) {
              if (payload.data.boutiquePhone) {
                setBoutiquePhone(payload.data.boutiquePhone);
                localStorage.setItem('nunuh_boutique_phone', payload.data.boutiquePhone);
              }
              if (payload.data.boutiqueLogo !== undefined) {
                setBoutiqueLogo(payload.data.boutiqueLogo);
                localStorage.setItem('nunuh_boutique_logo', payload.data.boutiqueLogo);
              }
              if (payload.data.theme) {
                setTheme(payload.data.theme);
                localStorage.setItem('nunuh_selected_theme', payload.data.theme);
              }
            }
          } catch (e) {}
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          sseRetryTimer = setTimeout(connectSSE, 3000);
        };
      } catch (e) {}
    };

    connectSSE();

    try {
      channel = new BroadcastChannel('nunuh_multiuser_sync_channel');
      channel.onmessage = (event) => {
        if (event.data) {
          if (event.data.type === 'ORDER_DELETED' && event.data.deletedId) {
            const deletedId = event.data.deletedId;
            const deletedIdsStr = localStorage.getItem('nunuh_deleted_order_ids') || '[]';
            let deletedIds: string[] = [];
            try { deletedIds = JSON.parse(deletedIdsStr); } catch (e) {}
            if (!deletedIds.includes(deletedId)) {
              deletedIds.push(deletedId);
              localStorage.setItem('nunuh_deleted_order_ids', JSON.stringify(deletedIds));
            }
            setOrders(prev => {
              const filtered = prev.filter(o => o.id !== deletedId);
              localStorage.setItem('nunuh_orders', JSON.stringify(filtered));
              return filtered;
            });
          } else if (event.data.type === 'ORDERS_UPDATE' && Array.isArray(event.data.orders)) {
            setOrders(prev => mergeOrders(prev, event.data.orders));
          }
        }
      };
    } catch (e) {}

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nunuh_orders' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setOrders(prev => mergeOrders(prev, parsed));
          }
        } catch (err) {}
      }
      if (e.key === 'nunuh_deleted_order_ids' && e.newValue) {
        try {
          const deletedIds = JSON.parse(e.newValue);
          if (Array.isArray(deletedIds)) {
            const deletedSet = new Set(deletedIds);
            setOrders(prev => {
              const filtered = prev.filter(o => !deletedSet.has(o.id));
              localStorage.setItem('nunuh_orders', JSON.stringify(filtered));
              return filtered;
            });
          }
        } catch (err) {}
      }
      if (e.key === 'nunuh_catalogue' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setCatalogue(parsed);
          }
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // ตรวจสอบข้อมูลจาก localStorage ทุกๆ 2.5 วินาที เพื่อให้ผู้ใช้หลายคนส่งออเดอร์พร้อมกันผ่านลิงก์เดียวกันแล้วข้อมูลซิงค์ทันทีไม่สูญหาย
    const pollInterval = setInterval(() => {
      try {
        const stored = localStorage.getItem('nunuh_orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setOrders(prev => {
              const merged = mergeOrders(prev, parsed);
              if (merged.length !== prev.length || JSON.stringify(merged) !== JSON.stringify(prev)) {
                return merged;
              }
              return prev;
            });
          }
        }
      } catch (e) {}
    }, 2500);

    // ตรวจสอบข้อมูลจาก Server ทุกๆ 2.5 วินาที เป็นระบบสำรอง (Fallback) เพื่อความเรียลไทม์ข้ามเครื่องแบบไร้รอยต่อ
    const serverPollInterval = setInterval(() => {
      syncAllDataWithServer();
    }, 2500);

    // ติดตั้ง Firebase Firestore Real-time Listener เพื่อซิงค์ข้ามทุกอุปกรณ์และหลายผู้ใช้ทันที
    const unsubscribeFirestore = subscribeToOrders((firestoreOrders) => {
      if (firestoreOrders && Array.isArray(firestoreOrders) && firestoreOrders.length > 0) {
        const deletedIdsStr = localStorage.getItem('nunuh_deleted_order_ids') || '[]';
        let deletedIds: string[] = [];
        try { deletedIds = JSON.parse(deletedIdsStr); } catch (e) {}
        const deletedSet = new Set(deletedIds);
        const cleanFirestore = firestoreOrders.filter(o => !deletedSet.has(o.id));

        setOrders(prev => {
          const merged = mergeOrders(prev, cleanFirestore);
          localStorage.setItem('nunuh_orders', JSON.stringify(merged));
          return merged;
        });
      }
    });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) channel.close();
      if (eventSource) eventSource.close();
      if (sseRetryTimer) clearTimeout(sseRetryTimer);
      clearInterval(pollInterval);
      clearInterval(serverPollInterval);
      unsubscribeFirestore();
    };
  }, []);

  // ส่งสัญญาณ Heartbeat ของพนักงานที่ล็อกอินอยู่เข้าสู่ Server เพื่ออัปเดตสถานะออนไลน์เรียลไทม์
  useEffect(() => {
    const sendHeartbeat = () => {
      if (currentStaff) {
        const matchingStaff = activeStaffList.find(s => s.name === currentStaff.name && s.branch === currentStaff.branch);
        const id = matchingStaff?.id || ('staff-' + currentStaff.name.replace(/\s+/g, ''));
        fetch('/api/staff/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name: currentStaff.name,
            branch: currentStaff.branch,
            loginTime: matchingStaff?.loginTime || Date.now()
          })
        }).catch(() => {});
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 12000);
    return () => clearInterval(interval);
  }, [currentStaff]);

  // บันทึกข้อมูลลง LocalStorage พร้อมผสานข้อมูลป้องกันการชนกัน (Concurrent Save Safety)
  const saveOrdersToStorage = (updatedOrders: Order[], deletedId?: string) => {
    try {
      const stored = localStorage.getItem('nunuh_orders');
      let currentStored: Order[] = [];
      if (stored) {
        currentStored = JSON.parse(stored);
      }
      // ผสานระหว่างข้อมูลที่มีอยู่ล่าสุดในเครื่อง กับข้อมูลที่กำลังบันทึกใหม่
      let fullyMerged = mergeOrders(currentStored, updatedOrders);
      if (deletedId) {
        fullyMerged = fullyMerged.filter(o => o.id !== deletedId);
      }
      
      setOrders(fullyMerged);
      localStorage.setItem('nunuh_orders', JSON.stringify(fullyMerged));

      // ซิงค์ส่งขึ้น Server ทันที
      syncWithServer(fullyMerged);

      // ส่งสัญญาณ BroadcastChannel ไปยังแท็บหรืออุปกรณ์อื่นทันที
      try {
        const channel = new BroadcastChannel('nunuh_multiuser_sync_channel');
        channel.postMessage({ type: 'ORDERS_UPDATE', orders: fullyMerged });
        channel.close();
      } catch (e) {}
    } catch (e) {
      let finalOrders = updatedOrders;
      if (deletedId) {
        finalOrders = finalOrders.filter(o => o.id !== deletedId);
      }
      setOrders(finalOrders);
      localStorage.setItem('nunuh_orders', JSON.stringify(finalOrders));
      syncWithServer(finalOrders);
    }
  };

  // การเพิ่มออเดอร์ใหม่
  const handleAddOrder = (newOrder: Order) => {
    const todayStr = newOrder.statusDate || newOrder.orderDate || new Date().toISOString().split('T')[0];
    const initialStatus = newOrder.status || OrderStatus.RECEIVED;
    const initialHistory = newOrder.statusHistory && newOrder.statusHistory.length > 0
      ? newOrder.statusHistory
      : [{
          status: initialStatus,
          date: todayStr,
          note: STATUS_MAP[initialStatus]?.label || 'รับออร์เดอร์จากลูกค้าพร้อมลงระบบ',
          updatedBy: currentStaff?.name || newOrder.staffName || 'พนักงาน'
        }];

    const orderWithTime: Order = { 
      ...newOrder, 
      status: initialStatus,
      statusDate: todayStr,
      statusHistory: initialHistory,
      staffName: currentStaff?.name || newOrder.staffName,
      branch: currentStaff?.branch || newOrder.branch,
      staffBranch: currentStaff?.branch || newOrder.staffBranch,
      updatedAt: Date.now() 
    };
    const updated = [orderWithTime, ...orders];
    saveOrdersToStorage(updated);
    // หลังบันทึกย้ายแท็บไปหน้าติดตามงาน (หากเป็นพนักงานให้คงอยู่ที่เดิมเพื่อความปลอดภัย)
    if (isStaffMode) {
      setActiveTab('orderForm');
      alert(`บันทึกออเดอร์ใหม่ของคุณ ${newOrder.customerName} เรียบร้อยแล้วค่ะ! ✨`);
    } else {
      setActiveTab('tracker');
    }
  };

  // ปรับปรุงสถานะติดตามงาน (Update Status พร้อมบันทึกวันที่เปลี่ยนสถานะและประวัติ)
  const handleUpdateOrderStatus = (
    orderId: string, 
    nextStatus: OrderStatus, 
    customStatusDate?: string,
    note?: string
  ) => {
    const todayStr = customStatusDate || new Date().toISOString().split('T')[0];
    const staffLabel = currentStaff?.name || 'พนักงาน';
    const statusLabel = STATUS_MAP[nextStatus]?.label || nextStatus;

    const updated = orders.map(o => {
      if (o.id === orderId) {
        let prevHistory = o.statusHistory && o.statusHistory.length > 0 ? [...o.statusHistory] : [];
        if (prevHistory.length === 0) {
          prevHistory = [{
            status: o.status,
            date: o.statusDate || o.orderDate,
            note: o.notes || `สถานะเริ่มต้น: ${STATUS_MAP[o.status]?.label || o.status}`,
            updatedBy: o.staffName || staffLabel
          }];
        }
        const newHistoryEntry = {
          status: nextStatus,
          date: todayStr,
          note: note || `เปลี่ยนสถานะเป็น: ${statusLabel}`,
          updatedBy: staffLabel
        };
        return { 
          ...o, 
          status: nextStatus, 
          statusDate: todayStr,
          statusHistory: [...prevHistory, newHistoryEntry],
          updatedAt: Date.now() 
        };
      }
      return o;
    });
    saveOrdersToStorage(updated);
  };

  // ลบออเดอร์
  const handleDeleteOrder = async (orderId: string) => {
    const target = orders.find(o => o.id === orderId);
    if (target?.isLocked || target?.pickupSignature) {
      if (!confirm("⚠️ ออเดอร์นี้ลูกค้าเซ็นรับมอบชุดแล้ว คุณต้องการลบจริงๆ หรือไม่?")) {
        return;
      }
    }

    // 1. เพิ่ม ID ไปยังรายการที่ถูกลบในเครื่อง เพื่อป้องกันการคืนชีพเมื่อผสาน
    const deletedIdsStr = localStorage.getItem('nunuh_deleted_order_ids') || '[]';
    let deletedIds: string[] = [];
    try {
      deletedIds = JSON.parse(deletedIdsStr);
    } catch (e) {}
    if (!deletedIds.includes(orderId)) {
      deletedIds.push(orderId);
      localStorage.setItem('nunuh_deleted_order_ids', JSON.stringify(deletedIds));
    }

    // 2. ปรับปรุงสถานะ Local และเซฟแบบคลีนทันที
    const updated = orders.filter(o => o.id !== orderId);
    setOrders(updated);
    localStorage.setItem('nunuh_orders', JSON.stringify(updated));

    // 3. ส่งสัญญาณ BroadcastChannel ไปยังแท็บอื่นในเบราว์เซอร์เดียวกันทันที
    try {
      const channel = new BroadcastChannel('nunuh_multiuser_sync_channel');
      channel.postMessage({ type: 'ORDER_DELETED', deletedId: orderId, orders: updated });
      channel.close();
    } catch (e) {}

    // 4. ลบออกจากระบบเซิร์ฟเวอร์และ Firestore โดยตรงทันที (ซึ่งจะยิง SSE กระจายให้ผู้ใช้อื่นที่อยู่ต่างอุปกรณ์ด้วย)
    deleteOrderFromFirestore(orderId).catch(() => {});
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn("Server delete failed, will sync later:", err);
    }

    saveOrdersToStorage(updated, orderId);
  };

  // แก้ไขรายละเอียดออเดอร์ทั้งหมด
  const handleUpdateOrder = (updatedOrder: Order) => {
    const existing = orders.find(o => o.id === updatedOrder.id);
    let history = updatedOrder.statusHistory && updatedOrder.statusHistory.length > 0
      ? [...updatedOrder.statusHistory]
      : existing?.statusHistory && existing.statusHistory.length > 0
        ? [...existing.statusHistory]
        : [];
    
    // ถ้าประวัติยังว่างอยู่ ให้สร้าง entry แรกจากข้อมูลสถานะตั้งต้น
    if (history.length === 0 && existing) {
      history = [{
        status: existing.status,
        date: existing.statusDate || existing.orderDate,
        note: existing.notes || `สถานะเริ่มต้น: ${STATUS_MAP[existing.status]?.label || existing.status}`,
        updatedBy: existing.staffName || currentStaff?.name || 'พนักงาน'
      }];
    }

    // ถ้าสถานะเปลี่ยน ให้เพิ่มประวัติสถานะใหม่ต่อท้ายเสมอ
    if (existing && existing.status !== updatedOrder.status) {
      const todayStr = updatedOrder.statusDate || new Date().toISOString().split('T')[0];
      const statusLabel = STATUS_MAP[updatedOrder.status]?.label || updatedOrder.status;
      history = [
        ...history,
        {
          status: updatedOrder.status,
          date: todayStr,
          note: `อัปเดตผ่านหน้าแก้ไข: ${statusLabel}`,
          updatedBy: currentStaff?.name || 'พนักงาน'
        }
      ];
    }

    const orderWithTime = { 
      ...updatedOrder, 
      statusHistory: history,
      updatedAt: Date.now() 
    };
    const updated = orders.map(o => o.id === updatedOrder.id ? orderWithTime : o);
    saveOrdersToStorage(updated);
  };

  // บันทึกลายเซ็นลูกค้ารับมอบชุด และล็อกออเดอร์ถาวร
  const handleConfirmPickupSignature = (orderId: string, signatureDataUrl: string, signeeName: string, signedAt: string) => {
    const todayStr = (signedAt && signedAt.split(' ')[0]) || new Date().toISOString().split('T')[0];
    const staffLabel = currentStaff?.name || 'พนักงาน';
    const updated = orders.map(o => {
      if (o.id === orderId) {
        let prevHistory = o.statusHistory && o.statusHistory.length > 0 ? [...o.statusHistory] : [];
        if (prevHistory.length === 0) {
          prevHistory = [{
            status: o.status,
            date: o.statusDate || o.orderDate,
            note: o.notes || `สถานะเริ่มต้น: ${STATUS_MAP[o.status]?.label || o.status}`,
            updatedBy: o.staffName || staffLabel
          }];
        }
        const newHistoryEntry = {
          status: OrderStatus.COMPLETED,
          date: todayStr,
          note: `ลูกค้ารับมอบชุดและลงลายเซ็น (${signeeName})`,
          updatedBy: staffLabel
        };
        return {
          ...o,
          pickupSignature: signatureDataUrl,
          pickupSigneeName: signeeName,
          pickupSignedAt: signedAt,
          isLocked: true,
          status: OrderStatus.COMPLETED,
          statusDate: todayStr,
          statusHistory: o.status !== OrderStatus.COMPLETED ? [...prevHistory, newHistoryEntry] : prevHistory,
          updatedAt: Date.now()
        };
      }
      return o;
    });
    saveOrdersToStorage(updated);
  };

  // ฟังก์ชันเลือกแบบชุดจากแคตตาล็อกเพื่อนำมาใส่หน้าฟอร์มรับออเดอร์ทันที
  const handleSelectDesignForOrder = (designId: string) => {
    setPreselectedDesignId(designId);
    setActiveTab('orderForm');
    // โครงสร้างฟอร์มจะดึงไอดีการเลือกนี้ไปเปิดอัตโนมัติเนื่องจากถูกเลือกและส่งต่อไปที่คอมโพเนนต์
    setTimeout(() => {
      const designSelect = document.querySelector('select');
      if (designSelect) {
        designSelect.value = designId;
        // ทริกเกอร์อีเวนต์จำลองเพื่อให้อัพเดตสเตตในคอมโพเนนต์ลูก
        const event = new Event('change', { bubbles: true });
        designSelect.dispatchEvent(event);
      }
    }, 200);
  };

  // การอัปโหลด / เพิ่มแบบชุดใหม่เข้าไปยังแคตตาล็อกของทางร้าน
  const handleAddCatalogueItem = async (newItem: CatalogueItem) => {
    const updated = [...catalogue, newItem];
    setCatalogue(updated);
    localStorage.setItem('nunuh_catalogue', JSON.stringify(updated));
    try {
      await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Failed to upload new catalogue item to server:', e);
    }
  };

  // การลบแบบชุดออกจากแคตตาล็อก
  const handleDeleteCatalogueItem = async (designId: string) => {
    const updated = catalogue.filter(item => item.id !== designId);
    setCatalogue(updated);
    localStorage.setItem('nunuh_catalogue', JSON.stringify(updated));
    try {
      await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Failed to delete catalogue item from server:', e);
    }
  };

  // การแก้ไขรายละเอียดแบบชุดในแคตตาล็อก
  const handleUpdateCatalogueItem = async (updatedItem: CatalogueItem) => {
    const updated = catalogue.map(item => item.id === updatedItem.id ? updatedItem : item);
    setCatalogue(updated);
    localStorage.setItem('nunuh_catalogue', JSON.stringify(updated));
    try {
      await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Failed to update catalogue item on server:', e);
    }
  };

  // จัดการรีวิวและความพึงพอใจของลูกค้า (Customer Reviews & Feedback Handlers)
  const handleAddReview = async (newReview: CustomerReview) => {
    const updated = [newReview, ...reviews];
    setReviews(updated);
    localStorage.setItem('nunuh_reviews', JSON.stringify(updated));
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Failed to save new review to server:', e);
    }
  };

  const handleUpdateReview = async (updatedReview: CustomerReview) => {
    const updated = reviews.map(r => r.id === updatedReview.id ? updatedReview : r);
    setReviews(updated);
    localStorage.setItem('nunuh_reviews', JSON.stringify(updated));
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Failed to update review on server:', e);
    }
  };

  const handleDeleteReview = async (id: string) => {
    const updated = reviews.filter(r => r.id !== id);
    setReviews(updated);
    localStorage.setItem('nunuh_reviews', JSON.stringify(updated));
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Failed to delete review from server:', e);
    }
  };

  // คำนวณรหัสออเดอร์ถัดไปแบบอัตโนมัติ (เช่น NU-26007)
  const getNextOrderNumber = () => {
    if (orders.length === 0) return "NU-26001";
    
    // ค้นหารหัสสูงสุดที่มีเลขต่อท้าย
    const orderNumbers = orders
      .map(o => {
        const match = o.orderNumber.match(/NU-(\d+)/);
        return match ? parseInt(match[1]) : 26000;
      });
    const maxNum = Math.max(...orderNumbers, 26000);
    return `NU-${maxNum + 1}`;
  };

  // ฟังก์ชันกลับสู่หน้าแรกระบบจัดการห้องเสื้อ (Home / Tracker Dashboard)
  const handleGoHome = () => {
    if (isCustomerMode) {
      setActiveTab('customer');
      return;
    }
    if (isStaffMode) {
      // สำหรับลิงก์พนักงาน: จำเพาะเจาะจงให้อยู่ในโหมดพนักงานเท่านั้น ไม่สามารถสลับไปหน้าหลังบ้านหลักได้
      setActiveTab('orderForm');
      return;
    }
    setIsCustomerMode(false);
    setIsStaffMode(false);
    localStorage.removeItem('nunuh_user_mode');
    setActiveTab('tracker');
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  return (
    <div className={`min-h-screen bg-natural-cream text-natural-espresso pb-16 font-sans transition-colors duration-300 ${theme === 'sand' ? '' : `theme-${theme}`}`}>
      
      {/* 1. BRAND HERO HEADER */}
      <header className="bg-white/80 backdrop-blur-md border-b border-natural-wheat sticky top-0 z-50 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            
            {/* Elegant Logo Group */}
            <div 
              onClick={() => {
                if (isCustomerMode) {
                  setActiveTab('customer');
                } else if (isStaffMode) {
                  setActiveTab('orderForm');
                } else {
                  handleGoHome();
                }
              }}
              className={`flex items-center space-x-3.5 ${isStaffMode ? 'cursor-default' : 'cursor-pointer'} group transition-all relative`}
              title={isStaffMode ? "NUNUH Staff Workspace (พนักงานรับออเดอร์)" : "คลิกเพื่อกลับสู่หน้าแรกระบบห้องเสื้อ NUNUH"}
            >
              <div className="relative group/logo">
                <div className="h-11 w-11 rounded-2xl bg-natural-espresso group-hover:bg-natural-clay transition-colors flex items-center justify-center text-natural-cream shadow-sm overflow-hidden p-0.5 border border-natural-wheat/40">
                  {boutiqueLogo ? (
                    <img 
                      src={boutiqueLogo} 
                      alt="Company Logo" 
                      className="h-full w-full object-contain rounded-xl bg-white" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Store className="h-5 w-5 text-natural-ochre" />
                  )}
                </div>
                {!isCustomerMode && !isStaffMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSettingsOpen(true);
                    }}
                    title="เปลี่ยนโลโก้บริษัท / ห้องเสื้อ"
                    className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-natural-clay text-white flex items-center justify-center shadow-xs opacity-0 group-hover/logo:opacity-100 transition-all hover:scale-110 cursor-pointer"
                  >
                    <Camera className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-serif font-black tracking-widest text-natural-espresso group-hover:text-natural-clay transition-colors uppercase">
                  NUNUH
                </h1>
                <p className="text-[9px] font-bold tracking-widest text-natural-espresso/50 uppercase">
                  {isCustomerMode 
                    ? 'CUSTOMER HUB • SERVICE PORTAL' 
                    : isStaffMode 
                    ? 'STAFF PORTAL • ORDER & RECOMMEND ONLY' 
                    : 'ATELIER & COUTURE ORDER SYSTEM'}
                </p>
              </div>
            </div>

            {/* Top Workspace Tab Navs */}
            {!isCustomerMode ? (
              <nav 
                style={{ width: '610px', height: '79px' }}
                className="flex items-center justify-center space-x-1 bg-natural-sand/50 p-1.5 rounded-2xl border border-natural-wheat/40"
              >
                  <button
                    onClick={() => setActiveTab('tracker')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'tracker'
                        ? 'bg-natural-clay text-white shadow-xs'
                        : 'text-natural-espresso/70 hover:bg-natural-sand/80 hover:text-natural-espresso'
                    }`}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">หน้าแรก (ติดตามงาน)</span>
                  </button>

                <button
                  onClick={() => setActiveTab('orderForm')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                    activeTab === 'orderForm'
                      ? 'bg-natural-clay text-white shadow-xs'
                      : 'text-natural-espresso/70 hover:bg-natural-sand/80 hover:text-natural-espresso'
                  }`}
                >
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">รับออเดอร์ใหม่</span>
                </button>

                {!isStaffMode && (
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'calendar'
                        ? 'bg-natural-clay text-white shadow-xs'
                        : 'text-natural-espresso/70 hover:bg-natural-sand/80 hover:text-natural-espresso'
                    }`}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">ตารางกำหนดส่งชุด</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('catalogue')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                    activeTab === 'catalogue'
                      ? 'bg-natural-clay text-white shadow-xs'
                      : 'text-natural-espresso/70 hover:bg-natural-sand/80 hover:text-natural-espresso'
                  }`}
                >
                  <Scissors className="h-4 w-4" />
                  <span className="hidden sm:inline">แบบชุดเสนอแนะนำ</span>
                </button>

                {!isStaffMode && (
                  <>
                    <button
                      onClick={() => setActiveTab('customerDashboard')}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                        activeTab === 'customerDashboard'
                          ? 'bg-natural-clay text-white shadow-xs'
                          : 'text-natural-espresso/70 hover:bg-natural-sand/80 hover:text-natural-espresso'
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <span className="hidden sm:inline">แดชบอร์ดลูกค้า & รีวิว (IDD IDH)</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('customer')}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                        activeTab === 'customer'
                          ? 'bg-natural-clay text-white shadow-xs'
                          : 'text-natural-espresso/70 hover:bg-natural-sand/80 hover:text-natural-espresso'
                      }`}
                    >
                      <Sparkles className="h-4 w-4 text-natural-ochre" />
                      <span>สำหรับลูกค้า</span>
                    </button>
                  </>
                )}
              </nav>
            ) : (
              <div className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-pink-600 text-white shadow-xs border border-pink-500/80">
                <Sparkles className="h-4 w-4 text-amber-300 fill-amber-300 shrink-0" />
                <span>สำหรับลูกค้า (Customer Service & Review Portal)</span>
              </div>
            )}

            {/* Elegant Theme Switcher */}
            <div className="flex items-center space-x-3 no-print">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-widest text-natural-espresso/40 font-bold hidden md:inline-block">
                  ธีมร้าน:
                </span>
                <div className="flex items-center space-x-1 bg-natural-sand/50 p-1 rounded-xl border border-natural-wheat/40">
                  <button
                    type="button"
                    onClick={() => setTheme('sand')}
                    className={`w-6 h-6 rounded-lg transition-all cursor-pointer relative flex items-center justify-center bg-[#FAF6F0] border ${
                      theme === 'sand'
                        ? 'border-natural-clay ring-2 ring-natural-clay/20 shadow-xs scale-105'
                        : 'border-natural-wheat/40 hover:border-natural-clay/30'
                    }`}
                    title="ธีมสีอบอุ่นลินิน (Atelier Sand - Default)"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B96248]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('lavender')}
                    className={`w-6 h-6 rounded-lg transition-all cursor-pointer relative flex items-center justify-center bg-[#F9F5FB] border ${
                      theme === 'lavender'
                        ? 'border-natural-clay ring-2 ring-natural-clay/20 shadow-xs scale-105'
                        : 'border-natural-wheat/40 hover:border-natural-clay/30'
                    }`}
                    title="ธีมสีม่วงราชสำนัก (Royal Lavender)"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7A5299]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('sage')}
                    className={`w-6 h-6 rounded-lg transition-all cursor-pointer relative flex items-center justify-center bg-[#F5F8F6] border ${
                      theme === 'sage'
                        ? 'border-natural-clay ring-2 ring-natural-clay/20 shadow-xs scale-105'
                        : 'border-natural-wheat/40 hover:border-natural-clay/30'
                    }`}
                    title="ธีมสีเขียวใบเซจ (Botanical Sage)"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3B7A57]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('crimson')}
                    className={`w-6 h-6 rounded-lg transition-all cursor-pointer relative flex items-center justify-center bg-[#FAF5F5] border ${
                      theme === 'crimson'
                        ? 'border-natural-clay ring-2 ring-natural-clay/20 shadow-xs scale-105'
                        : 'border-natural-wheat/40 hover:border-natural-clay/30'
                    }`}
                    title="ธีมสีแดงกำมะหยี่หรู (Crimson Velvet)"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#9E2A2B]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('pink')}
                    className={`w-6 h-6 rounded-lg transition-all cursor-pointer relative flex items-center justify-center bg-[#FFF5F8] border ${
                      theme === 'pink'
                        ? 'border-natural-clay ring-2 ring-natural-clay/20 shadow-xs scale-105'
                        : 'border-natural-wheat/40 hover:border-natural-clay/30'
                    }`}
                    title="ธีมสีชมพูบานเย็น (Fuchsia Royale)"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D91A5F]" />
                  </button>
                </div>
              </div>

              {!isCustomerMode && !isStaffMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowStaffDetailModal(!showStaffDetailModal)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100/90 text-emerald-950 border border-emerald-200/80 transition-all cursor-pointer shadow-3xs"
                    title="คลิกเพื่อดูรายชื่อพนักงานที่กำลังออนไลน์อยู่ขณะนี้"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="hidden lg:inline">พนักงานออนไลน์:</span>
                    <strong className="text-emerald-700 font-extrabold">{activeStaffList.length} คน</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      localStorage.setItem('nunuh_sound_enabled', String(next));
                      if (next) {
                        playNewOrderSound();
                      }
                    }}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-3xs hover:scale-102 ${
                      soundEnabled
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-gray-100 text-gray-500 border-gray-200 opacity-70'
                    }`}
                    title={soundEnabled ? 'เสียงแจ้งเตือนออเดอร์ใหม่: เปิดอยู่ (คลิกเพื่อปิด)' : 'เสียงแจ้งเตือนออเดอร์ใหม่: ปิดอยู่ (คลิกเพื่อเปิด)'}
                  >
                    {soundEnabled ? (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-amber-600" />
                        <span className="hidden sm:inline">เปิดเสียง</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="h-3.5 w-3.5 text-gray-400" />
                        <span className="hidden sm:inline">ปิดเสียง</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-natural-sand/30 text-natural-espresso border border-natural-wheat/80 transition-all cursor-pointer shadow-3xs hover:scale-102"
                    title="ตั้งค่าข้อมูลห้องเสื้อ"
                  >
                    <Settings className="h-3.5 w-3.5 text-natural-clay" />
                    <span className="hidden md:inline">ตั้งค่าร้าน</span>
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* 2. MAIN CORE CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Staff Login Modal / Screen */}
        {isStaffMode && (!currentStaff || showAddStaffModal) && (
          <div className="fixed inset-0 z-50 bg-natural-espresso/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-natural-wheat space-y-6">
              <div className="text-center space-y-2 relative">
                {showAddStaffModal && (
                  <button
                    onClick={() => setShowAddStaffModal(false)}
                    className="absolute -top-2 -right-2 p-1.5 rounded-full bg-natural-sand text-natural-espresso hover:bg-natural-wheat text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
                <div className="h-16 w-16 bg-natural-clay/10 rounded-2xl mx-auto flex items-center justify-center text-natural-clay text-2xl font-serif font-black">
                  🛡️
                </div>
                <h3 className="text-2xl font-serif font-bold text-natural-espresso">
                  {showAddStaffModal ? 'เพิ่มพนักงานเข้าสู่ระบบร่วมกัน' : 'เข้าสู่ระบบพนักงาน (Staff Login)'}
                </h3>
                <p className="text-xs text-natural-espresso/70">
                  กรุณากรอกชื่อพนักงานและเลือกสาขาประจำการ เพื่อเปิดใช้งานหลายคนพร้อมกันในระบบ
                </p>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formEl = e.currentTarget;
                  const nameInput = (formEl.elements.namedItem('staffName') as HTMLInputElement)?.value.trim();
                  const branchSelect = (formEl.elements.namedItem('staffBranch') as HTMLSelectElement)?.value;
                  if (!nameInput) {
                    alert('กรุณากรอกชื่อพนักงานหรือชื่อเล่น');
                    return;
                  }
                  handleStaffLogin(nameInput, branchSelect);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-natural-espresso mb-1.5">ชื่อพนักงาน / ผู้รับออเดอร์ (Staff Name)</label>
                  <input 
                    name="staffName"
                    type="text"
                    required
                    placeholder="เช่น คุณฟิรด้า, คุณซูไฮลา, เอ"
                    className="w-full px-4 py-3 rounded-xl border border-natural-wheat text-sm focus:outline-none focus:ring-2 focus:ring-natural-clay/20 focus:border-natural-clay bg-natural-cream/20 text-natural-espresso font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-natural-espresso mb-1.5">สาขาประจำการ (Branch)</label>
                  <select 
                    name="staffBranch"
                    className="w-full px-4 py-3 rounded-xl border border-natural-wheat text-sm focus:outline-none focus:ring-2 focus:ring-natural-clay/20 focus:border-natural-clay bg-natural-cream/20 text-natural-espresso font-medium"
                  >
                    <option value="สาขานราธิวาส">สาขานราธิวาส</option>
                    <option value="สาขายะลา">สาขายะลา</option>
                    <option value="สาขาปัตตานี">สาขาปัตตานี</option>
                    <option value="สาขาหาดใหญ่">สาขาหาดใหญ่</option>
                    <option value="สาขาหลัก (HQ)">สาขาหลัก (HQ)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-natural-clay hover:bg-natural-clay-dark text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
                >
                  เข้าสู่ระบบพนักงาน ✓
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Staff Logged-in Info Banner & Active Multi-Staff Roster */}
        {isStaffMode && currentStaff && (
          <div className="mb-6 bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3.5">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700 font-serif font-black shrink-0 text-base">
                  👥
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950 font-serif">
                    ทีมพนักงานที่กำลังออนไลน์อยู่พร้อมกัน ({activeStaffList.length} คน)
                  </h4>
                  <p className="text-xs text-amber-800/80 leading-relaxed">
                    ระบบรองรับการเข้าสู่ระบบพร้อมกันหลายคน ทีมงานสามารถบันทึกและสลับผู้รับออเดอร์ได้อิสระ
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-all cursor-pointer shadow-3xs"
                >
                  + เพิ่มพนักงานเข้าสู่ระบบ
                </button>
                <button
                  onClick={handleStaffLogout}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 transition-all cursor-pointer shadow-3xs"
                >
                  ออกจากระบบทั้งหมด 🔄
                </button>
              </div>
            </div>

            {/* Active Staff Badges */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-200/60">
              {activeStaffList.map((st) => (
                <div 
                  key={st.id}
                  onClick={() => {
                    setCurrentStaff({ name: st.name, branch: st.branch });
                    localStorage.setItem('nunuh_logged_in_staff', JSON.stringify({ name: st.name, branch: st.branch }));
                  }}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                    currentStaff?.name === st.name && currentStaff?.branch === st.branch
                      ? 'bg-amber-200/80 border-amber-400 font-bold text-amber-950 shadow-3xs'
                      : 'bg-white/80 border-amber-200 text-amber-900 hover:bg-amber-100/50'
                  }`}
                >
                  <span>👤 <strong>{st.name}</strong> ({st.branch})</span>
                  {currentStaff?.name === st.name && (
                    <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded-md">ใช้งานอยู่</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveStaffSession(st.id);
                    }}
                    className="text-amber-700 hover:text-red-600 font-bold px-1"
                    title="ออกจากระบบเฉพาะพนักงานท่านนี้"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff Mode Information Banner */}
        {isStaffMode && !currentStaff && (
          <div className="mb-6 bg-amber-50/90 border border-amber-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700 font-serif font-black shrink-0 text-lg">
                🛡️
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950 font-serif">สิทธิ์การใช้งานสำหรับพนักงานรับออเดอร์ (Staff Workspace Portal)</h4>
                <p className="text-xs text-amber-800/80 leading-relaxed mt-0.5">
                  ระบบได้รับการจำกัดสิทธิ์ความปลอดภัยขั้นสูง: สามารถบันทึกรับออเดอร์ใหม่ และเปิดแบบชุดเสนอแนะจากดีไซเนอร์เท่านั้น 
                  ทางระบบได้ปิดกั้นสรุปยอดการเงิน สถิติทางธุรกิจ ประวัติลูกค้า ตลอดจนปุ่มแก้ไขดีไซน์อื่นๆ เรียบร้อยแล้วเพื่อความปลอดภัยสูงสุดของแบรนด์ NUNUH
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-3xs">
                เปิดระบบความปลอดภัยพนักงาน ✓
              </span>
            </div>
          </div>
        )}

        {/* Admin/Owner Copy Staff Link Widget */}
        {!isCustomerMode && !isStaffMode && (
          <div className="mb-6 bg-white border border-natural-wheat rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-natural-clay/10 flex items-center justify-center text-natural-clay shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-natural-espresso font-serif">ระบบสิทธิ์พนักงานรับออเดอร์ (Staff Ordering Portal)</h4>
                <p className="text-xs text-natural-espresso/70 leading-relaxed mt-0.5">
                  ส่งลิงก์ด้านขวาให้กับพนักงานรับหน้าร้าน เพื่อให้พนักงานใช้งานเฉพาะหน้า <strong>"รับออเดอร์ใหม่"</strong> และ <strong>"แบบชุดเสนอแนะนำ (แคตตาล็อกอ่านอย่างเดียว)"</strong> 
                  โดยที่ระบบจะซิงค์ข้อมูลเรียลไทม์ขึ้นมาที่โต๊ะดีไซเนอร์หลังบ้าน และพนักงานจะไม่สามารถดูยอดการเงินหรือสถิติส่วนบุคคลของลูกค้าท่านอื่นได้
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0 self-start md:self-center">
              <button
                onClick={() => {
                  const staffUrl = `${window.location.origin}${window.location.pathname}?mode=staff`;
                  navigator.clipboard.writeText(staffUrl);
                  setCopiedStaffLink(true);
                  setTimeout(() => setCopiedStaffLink(false), 3000);
                }}
                className={`px-4.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all duration-300 flex items-center space-x-2 shadow-xs cursor-pointer ${
                  copiedStaffLink 
                    ? 'bg-natural-sage text-white' 
                    : 'bg-natural-clay hover:bg-natural-clay-dark text-white'
                }`}
              >
                <span>{copiedStaffLink ? 'คัดลอกลิงก์สำเร็จ! ✓' : '📋 คัดลอกลิงก์รับออเดอร์สำหรับพนักงาน'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Stats Banner */}
        {!isCustomerMode && !isStaffMode && <DashboardStats orders={orders} onSelectTab={setActiveTab} />}

        {/* Tab Content Display Area with Framer Motion Transition */}
        <div className="mt-2 min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {activeTab === 'tracker' && (
                <div className="space-y-4">
                  <div className="border-b border-natural-wheat pb-3">
                    <h2 className="text-xl font-serif font-bold text-natural-espresso">ระบบติดตามและอัพเดตสเตตัสงาน (Order Tracking Board)</h2>
                    <p className="text-xs text-natural-espresso/60">คลิกการ์ดรายการเพื่อขยายข้อมูลความต้องการ สรุปยอดค้างชำระ และข้อมูลสัดส่วนการวัดตัวลูกค้า</p>
                  </div>
                  <OrderTracker 
                    orders={filteredOrdersForStaff} 
                    catalogue={catalogue}
                    onUpdateOrderStatus={handleUpdateOrderStatus}
                    onDeleteOrder={handleDeleteOrder}
                    onEditOrder={handleUpdateOrder}
                    onConfirmPickupSignature={handleConfirmPickupSignature}
                  />
                </div>
              )}

              {activeTab === 'orderForm' && (
                <div className="space-y-4">
                  <div className="border-b border-natural-wheat pb-3">
                    <h2 className="text-xl font-serif font-bold text-natural-espresso">ลงบันทึกออเดอร์ตัดเย็บใหม่ (Create Custom Order)</h2>
                    <p className="text-xs text-natural-espresso/60">กรอกข้อมูลผู้จอง สเปกแบบตัดเย็บ รายการเนื้อผ้า อัตราสัดส่วนวัดตัว ตลอดจนราคาและกำหนดส่งมอบชุด</p>
                  </div>
                  <OrderForm 
                    catalogue={catalogue} 
                    onAddOrder={handleAddOrder}
                    nextOrderNumber={getNextOrderNumber()}
                    orders={orders}
                    preselectedDesignId={preselectedDesignId}
                    onClearPreselectedDesign={() => setPreselectedDesignId('custom')}
                    staffName={currentStaff?.name}
                    staffBranch={currentStaff?.branch}
                    activeStaffList={activeStaffList}
                  />
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className="space-y-4">
                  <div className="border-b border-natural-wheat pb-3">
                    <h2 className="text-xl font-serif font-bold text-natural-espresso">ตารางเวลาจัดเตรียมและจัดส่งเสื้อผ้า (Timeline & Calendar)</h2>
                    <p className="text-xs text-natural-espresso/60">ตรวจสอบกำหนดการส่งงานแบบปฏิทินรายวัน และดูจัดลำดับรอบเตรียมแพ็คจัดส่งที่รอคุณอยู่อย่างง่ายดาย</p>
                  </div>
                  <DeliveryCalendar 
                    orders={orders} 
                    onUpdateOrderStatus={handleUpdateOrderStatus}
                  />
                </div>
              )}

              {activeTab === 'catalogue' && (
                <div className="space-y-4">
                  <div className="border-b border-natural-wheat pb-3">
                    <h2 className="text-xl font-serif font-bold text-natural-espresso">คลังแบบชุดและชุดเสนอแนะเฉพาะตัว (Designer Catalogue Panel)</h2>
                    <p className="text-xs text-natural-espresso/60">แคตตาล็อกแบบพรีเมียมพร้อมเครื่องมือผสมผสานสไตล์ชุดแบบด่วน เพื่อแชร์เป็นข้อความทางการประเมินราคาส่งให้ลูกค้า</p>
                  </div>
                  <DressCatalogue 
                    catalogue={catalogue} 
                    onSelectDesignForOrder={handleSelectDesignForOrder}
                    onAddCatalogueItem={handleAddCatalogueItem}
                    onDeleteCatalogueItem={handleDeleteCatalogueItem}
                    onUpdateCatalogueItem={handleUpdateCatalogueItem}
                    isReadOnly={isStaffMode}
                  />
                </div>
              )}

              {activeTab === 'customerDashboard' && (
                <div className="space-y-4">
                  <div className="border-b border-natural-wheat pb-3">
                    <h2 className="text-xl font-serif font-bold text-natural-espresso">ระบบศูนย์ข้อมูลลูกค้าและรีวิวความพึงพอใจ (Customer CRM & Satisfaction Feedback)</h2>
                    <p className="text-xs text-natural-espresso/60">วิเคราะห์ข้อมูลประวัติการสั่งตัด จำแนกกลุ่มลูกค้าประเภท IDD, IDH และระดับบัตรสมาชิก พร้อมเจาะลึกรายละเอียดสัดส่วนตัวและติดตามรีวิวคำติชมสะสมในที่เดียว</p>
                  </div>
                  <CustomerDashboard 
                    orders={orders}
                    reviews={reviews}
                    onSelectTab={setActiveTab}
                    onAddReview={handleAddReview}
                    onUpdateReview={handleUpdateReview}
                    onDeleteReview={handleDeleteReview}
                  />
                </div>
              )}

              {activeTab === 'customer' && (
                <div className="space-y-4">
                  <div className="border-b border-natural-wheat pb-3">
                    <h2 className="text-xl font-serif font-bold text-natural-espresso">ศูนย์บริการและติดตามความคืบหน้าของลูกค้า (Customer Care & Booking)</h2>
                    <p className="text-xs text-natural-espresso/60">พื้นที่สำหรับลูกค้าเพื่อจองแบบสไตล์คอลเลกชัน ค้นหาคิวประวัติ และประเมินความคืบหน้าง่ายๆ ด้วยเบอร์โทรศัพท์</p>
                  </div>
                  <CustomerPortal 
                    orders={orders}
                    catalogue={catalogue}
                    reviews={reviews}
                    onAddReview={handleAddReview}
                    onAddOrder={handleAddOrder}
                    onUpdateOrders={saveOrdersToStorage}
                    nextOrderNumber={getNextOrderNumber()}
                    isCustomerLocked={isCustomerMode}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="settings-modal">
            <div className="flex min-h-screen items-center justify-center p-4 text-center">
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsSettingsOpen(false)}
                className="fixed inset-0 bg-natural-espresso/35 backdrop-blur-xs transition-opacity"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="relative transform overflow-hidden rounded-3xl bg-white p-6 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-natural-wheat z-50 max-h-[90vh] flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-natural-wheat pb-4 mb-4 shrink-0">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-9 w-9 rounded-xl bg-natural-espresso text-natural-cream flex items-center justify-center shadow-2xs">
                      <Settings className="h-5 w-5 text-natural-ochre" />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-bold text-natural-espresso">
                        ตั้งค่าระบบห้องเสื้อและการเชื่อมต่อ
                      </h3>
                      <p className="text-[11px] text-natural-espresso/60">จัดการข้อมูลทั่วไป การติดต่อ และระบบเชื่อมต่อ LINE Official Account</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="rounded-full p-1.5 text-natural-espresso/40 hover:bg-natural-sand/50 hover:text-natural-espresso transition-all cursor-pointer"
                  >
                    <span className="sr-only">ปิด</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Settings Navigation Tabs */}
                <div className="flex border-b border-natural-sand/60 mb-4 shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsTab('general')}
                    className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      settingsTab === 'general'
                        ? 'border-natural-clay text-natural-clay font-black'
                        : 'border-transparent text-natural-espresso/60 hover:text-natural-espresso'
                    }`}
                  >
                    <Store className="h-3.5 w-3.5" />
                    <span>1. ข้อมูลทั่วไป & ห้องเสื้อ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab('line');
                      fetchLineConfigStatus();
                    }}
                    className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer relative ${
                      settingsTab === 'line'
                        ? 'border-emerald-600 text-emerald-800 font-black'
                        : 'border-transparent text-natural-espresso/60 hover:text-emerald-700'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    <span>2. เชื่อมต่อ LINE OA & บอทแจ้งเตือน</span>
                    {lineConfigStatus?.tokenSet && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>
                </div>

                {/* Body */}
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const payload = {
                      boutiquePhone,
                      boutiqueLogo,
                      ownerLineUserId,
                      lineChannelAccessToken,
                      lineChannelSecret,
                      lineOaId,
                      lineOaChatUrl,
                      theme
                    };
                    await fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    localStorage.setItem('nunuh_boutique_phone', boutiquePhone);
                    localStorage.setItem('nunuh_boutique_logo', boutiqueLogo);
                    localStorage.setItem('nunuh_owner_line_user_id', ownerLineUserId);
                    localStorage.setItem('nunuh_line_channel_access_token', lineChannelAccessToken);
                    localStorage.setItem('nunuh_line_channel_secret', lineChannelSecret);
                    localStorage.setItem('nunuh_line_oa_id', lineOaId);
                    localStorage.setItem('nunuh_line_oa_chat_url', lineOaChatUrl);
                    
                    fetchLineConfigStatus();
                    setIsSettingsOpen(false);
                  } catch (err) {
                    console.error('Failed to save settings:', err);
                    setIsSettingsOpen(false);
                  }
                }} className="space-y-4 overflow-y-auto pr-1 flex-1">
                  
                  {settingsTab === 'general' && (
                    <div className="space-y-4">
                      {/* Database Persistence Status Badge */}
                      <div className="bg-natural-sand/30 p-3.5 rounded-2xl border border-natural-wheat/70 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-natural-espresso flex items-center gap-1.5">
                            <Database className="h-3.5 w-3.5 text-natural-clay" />
                            <span>คลาวด์ดาต้าเบส (Firebase Firestore)</span>
                          </span>
                          <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Firebase Cloud (nuhpre-order) 🟢</span>
                          </span>
                        </div>
                        
                        <div className="bg-white/80 p-2.5 rounded-xl border border-natural-wheat/60 text-[11px] text-natural-espresso space-y-1.5 font-medium">
                          <div className="flex justify-between items-center text-[10.5px]">
                            <span className="text-natural-espresso/60">Firebase Project ID:</span>
                            <code className="font-mono font-bold bg-natural-sand/50 px-2 py-0.5 rounded text-emerald-900">nuhpre-order</code>
                          </div>
                          <div className="flex justify-between items-center text-[10.5px]">
                            <span className="text-natural-espresso/60">ฐานข้อมูล Collections:</span>
                            <span className="font-semibold text-natural-espresso">orders, catalogue, settings, system</span>
                          </div>
                          <div className="flex justify-between items-center text-[10.5px]">
                            <span className="text-natural-espresso/60">สถานะการซิงค์สด (Real-time):</span>
                            <span className="font-bold text-emerald-700 flex items-center gap-1">
                              <Check className="h-3 w-3" /> เปิดใช้งาน (onSnapshot Listener)
                            </span>
                          </div>
                        </div>

                        {firebaseTestResult && (
                          <div className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                            firebaseTestResult.success
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-rose-50 border-rose-200 text-rose-900'
                          }`}>
                            <span className="text-sm mt-0.5">{firebaseTestResult.success ? '✅' : '⚠️'}</span>
                            <div className="flex-1">
                              <p className="font-bold">{firebaseTestResult.message}</p>
                              {firebaseTestResult.latencyMs !== undefined && (
                                <p className="text-[10px] opacity-80 mt-0.5">
                                  ความเร็วในการตอบสนอง (Latency): {firebaseTestResult.latencyMs} มิลลิวินาที
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isTestingFirebase}
                            onClick={async () => {
                              setIsTestingFirebase(true);
                              try {
                                const result = await testFirestoreConnection();
                                setFirebaseTestResult(result);
                              } catch (err: any) {
                                setFirebaseTestResult({
                                  success: false,
                                  message: err?.message || 'เกิดข้อผิดพลาดในการทดสอบ'
                                });
                              } finally {
                                setIsTestingFirebase(false);
                              }
                            }}
                            className="flex-1 px-3 py-1.5 bg-natural-espresso hover:bg-natural-clay text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 text-natural-ochre ${isTestingFirebase ? 'animate-spin' : ''}`} />
                            <span>{isTestingFirebase ? 'กำลังทดสอบเชื่อมต่อ...' : 'ทดสอบการเชื่อมต่อ Firebase สด'}</span>
                          </button>
                          
                          <a
                            href="https://console.firebase.google.com/project/nuhpre-order/firestore"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-natural-sand/50 hover:bg-natural-sand text-natural-espresso border border-natural-wheat rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                          >
                            <span>เปิด Firebase Console</span>
                            <ExternalLink className="h-3 w-3 text-natural-espresso/60" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-natural-espresso/70 mb-1.5 flex items-center space-x-1">
                          <Phone className="h-3 w-3 text-natural-clay" />
                          <span>เบอร์โทรศัพท์ห้องเสื้อ (Atelier Phone Number)</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={boutiquePhone}
                          onChange={(e) => handleUpdateBoutiquePhone(e.target.value)}
                          placeholder="เช่น 086-555-1234"
                          className="w-full text-sm px-3 py-2.5 rounded-xl border border-natural-wheat focus:outline-none focus:ring-2 focus:ring-natural-clay/20 focus:border-natural-clay bg-white text-natural-espresso font-semibold"
                        />
                        <p className="text-[10px] text-natural-espresso/45 mt-1 leading-relaxed">
                          * เบอร์โทรศัพท์นี้จะถูกนำไปใช้อัปเดตข้อมูลการติดต่อในใบเสร็จรับเงิน, เอกสารพิมพ์ใบออเดอร์ และปุ่มสำหรับลูกค้าเพื่อ "โทรติดต่อห้องเสื้อ" อัตโนมัติ
                        </p>
                      </div>

                      {/* Company Logo Setting */}
                      <div className="pt-3 border-t border-natural-wheat/50 space-y-2">
                        <label className="block text-xs font-bold text-natural-espresso/80 flex items-center justify-between">
                          <span className="flex items-center space-x-1.5">
                            <ImageIcon className="h-3.5 w-3.5 text-natural-clay" />
                            <span>โลโก้บริษัท / โลโก้ห้องเสื้อ (Company Logo)</span>
                          </span>
                          {boutiqueLogo && (
                            <button
                              type="button"
                              onClick={() => handleUpdateBoutiqueLogo('')}
                              className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>ลบโลโก้ / คืนค่าเริ่มต้น</span>
                            </button>
                          )}
                        </label>

                        <div className="flex items-center gap-3 bg-natural-sand/20 p-3 rounded-2xl border border-natural-wheat/60">
                          <div className="h-14 w-14 rounded-2xl bg-white border border-natural-wheat/80 flex items-center justify-center p-1 shadow-2xs overflow-hidden shrink-0">
                            {boutiqueLogo ? (
                              <img
                                src={boutiqueLogo}
                                alt="Company Logo Preview"
                                className="h-full w-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-natural-espresso/30 text-center">
                                <Store className="h-6 w-6 text-natural-ochre" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-1.5">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-natural-espresso hover:bg-natural-clay text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-2xs">
                              <Upload className="h-3.5 w-3.5 text-natural-ochre" />
                              <span>อัปโหลดรูปภาพโลโก้</span>
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp, image/svg+xml"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleLogoFileUpload(f);
                                }}
                              />
                            </label>
                            <p className="text-[10px] text-natural-espresso/50 leading-tight">
                              รองรับไฟล์ PNG (พื้นหลังโปร่งใส), JPG, SVG, WebP ระบบจะปรับขนาดและแสดงผลทันที
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Sound Notification Setting */}
                      <div className="pt-3 border-t border-natural-wheat/50 space-y-2">
                        <label className="block text-xs font-bold text-natural-espresso/80 flex items-center justify-between">
                          <span className="flex items-center space-x-1">
                            <Bell className="h-3.5 w-3.5 text-amber-600" />
                            <span>เปิดเสียงแจ้งเตือนออเดอร์ใหม่ (Sound Alert)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !soundEnabled;
                              setSoundEnabled(next);
                              localStorage.setItem('nunuh_sound_enabled', String(next));
                              if (next) playNewOrderSound();
                            }}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                              soundEnabled ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            {soundEnabled ? '🔔 เปิดใช้งาน' : '🔕 ปิดเสียง'}
                          </button>
                        </label>
                        <div className="flex justify-between items-center bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                          <span className="text-[10.5px] text-amber-900 font-medium">ทดสอบระบบเสียงกระดิ่งแจ้งเตือน:</span>
                          <button
                            type="button"
                            onClick={() => playNewOrderSound()}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Volume2 className="h-3 w-3" />
                            <span>ทดลองฟังเสียง</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'line' && (
                    <div className="space-y-4">
                      {/* Connection Diagnostic Banner */}
                      <div className={`p-3.5 rounded-2xl border ${
                        lineConfigStatus?.tokenSet
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : 'bg-amber-50 border-amber-200 text-amber-950'
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 font-bold text-xs">
                            <span className="text-base">{lineConfigStatus?.tokenSet ? '🟢' : '🟡'}</span>
                            <span>
                              {lineConfigStatus?.tokenSet
                                ? 'LINE Messaging API เชื่อมต่อสำเร็จ (พร้อมส่งแจ้งเตือนอัตโนมัติ)'
                                : 'ยังไม่ได้เชื่อมต่อ LINE Channel Access Token (โหมดแมนนวล/จำลอง)'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={fetchLineConfigStatus}
                            className="text-[10.5px] font-bold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>รีเฟรชสถานะ</span>
                          </button>
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-90">
                          {lineConfigStatus?.tokenSet
                            ? 'ระบบพร้อมส่งข้อความแจ้งเตือนสถานะชุดสั่งตัดเข้า LINE แชทของลูกค้าโดยตรงเมื่อมีการอัปเดตสถานะในระบบ'
                            : 'เมื่อใส่ Channel Access Token ด้านล่างนี้ ระบบจะสามารถยิง Push Message เข้าแอป LINE ของลูกค้าและเจ้าของร้านได้โดยตรง 100%'}
                        </p>
                      </div>

                      {/* Webhook URL Copy Box */}
                      <div className="bg-natural-sand/30 p-3 rounded-2xl border border-natural-wheat/70 space-y-1.5">
                        <label className="block text-xs font-bold text-natural-espresso flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span>LINE Webhook URL (นำไปใส่ใน LINE Developers Console)</span>
                          </span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                            Endpoint พร้อมใช้งาน
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={lineConfigStatus?.webhookUrl || `${window.location.origin}/api/webhook/line`}
                            className="w-full text-xs font-mono bg-white px-3 py-2 rounded-xl border border-natural-wheat select-all text-natural-espresso font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const url = lineConfigStatus?.webhookUrl || `${window.location.origin}/api/webhook/line`;
                              navigator.clipboard.writeText(url);
                              setCopiedWebhook(true);
                              setTimeout(() => setCopiedWebhook(false), 2000);
                            }}
                            className="shrink-0 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          >
                            {copiedWebhook ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedWebhook ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-natural-espresso/60 leading-tight">
                          * นำ URL นี้ไปวางใน Messaging API &gt; Webhook URL บน <a href="https://developers.line.biz/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold inline-flex items-center gap-0.5">LINE Developers <ExternalLink className="h-2.5 w-2.5" /></a> และกดเปิด <strong>"Use webhook"</strong>
                        </p>
                      </div>

                      {/* LINE Channel Access Token */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-natural-espresso/80 flex items-center space-x-1.5">
                          <Key className="h-3.5 w-3.5 text-emerald-600" />
                          <span>LINE Channel Access Token (Long-lived)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={lineChannelAccessToken}
                          onChange={(e) => setLineChannelAccessToken(e.target.value)}
                          placeholder="วาง Channel Access Token ที่ได้จาก LINE Developers ที่นี่ (เช่น e8x8a9B...)"
                          className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-natural-wheat focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white text-natural-espresso"
                        />
                        <p className="text-[10px] text-natural-espresso/50">
                          * หาได้จาก LINE Developers Console &gt; Channel Settings &gt; แท็บ <strong>Messaging API</strong> &gt; ด้านล่างสุดกด Issue "Channel access token (long-lived)"
                        </p>
                      </div>

                      {/* LINE Channel Secret */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-natural-espresso/80 flex items-center space-x-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>LINE Channel Secret (สำหรับตรวจสอบ Signature Webhook)</span>
                        </label>
                        <input
                          type="password"
                          value={lineChannelSecret}
                          onChange={(e) => setLineChannelSecret(e.target.value)}
                          placeholder="เช่น 7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d"
                          className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-natural-wheat focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white text-natural-espresso"
                        />
                        <p className="text-[10px] text-natural-espresso/50">
                          * หาได้จาก LINE Developers Console &gt; Channel Settings &gt; แท็บ <strong>Basic settings</strong> &gt; Channel secret
                        </p>
                      </div>

                      {/* LINE OA ID & Chat URL */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-natural-espresso/80">LINE OA ID (Basic ID)</label>
                          <input
                            type="text"
                            value={lineOaId}
                            onChange={(e) => setLineOaId(e.target.value)}
                            placeholder="เช่น @237aynfq"
                            className="w-full text-xs px-3 py-2 rounded-xl border border-natural-wheat bg-white font-bold text-emerald-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-natural-espresso/80">LINE User ID เจ้าของร้าน (รับแจ้งเตือน)</label>
                          <input
                            type="text"
                            value={ownerLineUserId}
                            onChange={(e) => setOwnerLineUserId(e.target.value)}
                            placeholder="เช่น Uf150dba359d9..."
                            className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-natural-wheat bg-white text-rose-950 font-bold"
                          />
                        </div>
                      </div>

                      {/* Live LINE Connection Push Tester */}
                      <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                            <span>🧪</span>
                            <span>เครื่องมือทดสอบส่งแจ้งเตือนเข้า LINE (Test Push Message)</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={testPushUserId}
                            onChange={(e) => setTestPushUserId(e.target.value)}
                            placeholder="ใส่ LINE User ID ของคุณเพื่อทดสอบ (ขึ้นต้นด้วย U...)"
                            className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-emerald-300 bg-white text-emerald-950"
                          />
                          <button
                            type="button"
                            disabled={isTestingPush}
                            onClick={handleTestPushMessage}
                            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                          >
                            {isTestingPush ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            <span>{isTestingPush ? 'กำลังส่ง...' : 'ทดสอบส่ง'}</span>
                          </button>
                        </div>
                        {testPushResult && (
                          <div className={`p-2.5 rounded-xl text-xs ${
                            testPushResult.success ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            <p className="font-bold">{testPushResult.msg}</p>
                            {testPushResult.tip && (
                              <p className="text-[11px] mt-1 opacity-90 leading-tight">💡 {testPushResult.tip}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Thai Setup Guide Accordion/Notes */}
                      <div className="bg-natural-sand/20 p-3 rounded-2xl border border-natural-wheat/60 space-y-2 text-[11px] text-natural-espresso/80">
                        <p className="font-bold text-natural-espresso flex items-center gap-1">
                          <HelpCircle className="h-3.5 w-3.5 text-natural-clay" />
                          <span>สรุป 3 ขั้นตอนเพื่อให้ระบบแจ้งเตือนเข้า LINE ลูกค้าอัตโนมัติ 100%:</span>
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-[10.5px] leading-relaxed text-natural-espresso/70">
                          <li><strong>ตั้งค่า Webhook:</strong> นำ Webhook URL ด้านบนไปใส่ใน LINE Developers Console และเปิดใช้งาน Webhook</li>
                          <li><strong>เปิดสิทธิ์ใน LINE OA:</strong> เข้า <a href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold">manager.line.biz</a> &gt; ตั้งค่า &gt; ตั้งค่าการตอบกลับ &gt; เลือก <strong>เปิด "Webhook"</strong> และ <strong>เปิด "แชท"</strong></li>
                          <li><strong>บันทึก Token:</strong> นำ Channel Access Token มาวางในหน้านี้ แล้วกด "บันทึกตั้งค่า"</li>
                        </ol>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-natural-wheat/50 flex justify-end space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateBoutiquePhone('086-555-1234');
                      }}
                      className="px-3 py-2 text-xs font-bold text-natural-espresso/60 hover:text-natural-espresso hover:bg-natural-sand/30 rounded-xl transition-all cursor-pointer"
                    >
                      คืนค่าเริ่มต้น
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold text-white bg-natural-clay hover:bg-natural-clay-dark rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>บันทึกตั้งค่าทั้งหมด</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 🟢 Floating Small Corner Badge for Logged-In Staff Count - Main App Only */}
      {!isCustomerMode && !isStaffMode && (
        <div className="fixed bottom-4 right-4 z-40 no-print">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStaffDetailModal(!showStaffDetailModal)}
              className="flex items-center space-x-2.5 px-3.5 py-2 rounded-full bg-white/95 border border-emerald-300 text-emerald-950 hover:bg-emerald-50 transition-all shadow-lg hover:shadow-xl cursor-pointer backdrop-blur-md"
              title="คลิกเพื่อดูรายชื่อพนักงานที่กำลังเข้าสู่ระบบขณะนี้"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="flex items-center space-x-1.5 text-xs font-bold">
                <span>👥 พนักงานออนไลน์:</span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-xs">
                  {activeStaffList.length} คน
                </span>
              </div>
            </button>

            {/* Popover showing details of logged-in staff */}
            {showStaffDetailModal && (
              <div className="absolute bottom-12 right-0 w-80 bg-white rounded-2xl p-4 shadow-2xl border border-emerald-200 text-natural-espresso z-50 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between pb-2.5 border-b border-natural-sand/50 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="font-bold text-natural-espresso text-xs font-serif">
                      พนักงานที่กำลังออนไลน์อยู่ ({activeStaffList.length} คน)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStaffDetailModal(false)}
                    className="text-natural-espresso/40 hover:text-natural-espresso font-bold p-1 text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {activeStaffList.length === 0 ? (
                  <div className="py-4 text-center text-natural-espresso/60 italic text-[11px]">
                    ยังไม่มีพนักงานเข้าสู่ระบบในขณะนี้
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {activeStaffList.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80 text-emerald-950 gap-2"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="text-base shrink-0">👤</span>
                          <div className="truncate">
                            <p className="font-bold text-xs truncate">{st.name}</p>
                            <p className="text-[10px] text-emerald-800/80 truncate">{st.branch}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <span className="text-[10px] bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                            ออนไลน์ 🟢
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveStaffSession(st.id)}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-[10px] transition-all cursor-pointer"
                            title="เจ้าของแอปบังคับออกจากระบบให้พนักงานท่านนี้"
                          >
                            ออกระบบ ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-natural-sand/40 flex items-center justify-between text-[10px] text-natural-espresso/60">
                  <span>ซิงค์ข้อมูล Real-time 100%</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddStaffModal(true);
                      setShowStaffDetailModal(false);
                    }}
                    className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                  >
                    + เพิ่มพนักงาน
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. ATELIER FOOTER */}
      <footer className="mt-20 border-t border-natural-wheat bg-white/40 py-10 text-center text-natural-espresso/50 text-xs">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-serif font-bold tracking-widest uppercase text-natural-espresso">NUNUH BOUTIQUE</p>
          <p className="font-medium text-natural-espresso/60">ระบบคูตูร์แฮนด์เมดและจัดการรายการรับออเดอร์ลูกค้าอย่างมีระดับ</p>
          <p className="pt-2 text-[10px] text-natural-espresso/40">NUNUH Atelier © 2026. All rights reserved. Designed with precision for premium clothing salons.</p>
        </div>
      </footer>

    </div>
  );
}
