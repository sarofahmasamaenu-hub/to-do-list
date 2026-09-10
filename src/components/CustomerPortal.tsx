import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus, CatalogueItem, STATUS_MAP, Measurements, STANDARD_SIZE_CHART, CustomerReview, PRODUCTION_PIPELINE_STEPS } from '../types';
import { 
  Search, 
  Sparkles, 
  Phone, 
  Calendar, 
  DollarSign, 
  Clock, 
  Ruler, 
  CheckCircle2, 
  Scissors, 
  Instagram, 
  User, 
  FileText, 
  Info, 
  Check, 
  ChevronRight, 
  X,
  MessageSquare,
  Share2,
  Bookmark,
  Image as ImageIcon,
  UploadCloud,
  Printer,
  Award,
  CreditCard,
  History,
  Camera,
  Trash2,
  Star,
  Lock,
  Copy,
  Send,
  ExternalLink
} from 'lucide-react';
import PrintOrderModal from './PrintOrderModal';
import FeedbackSection from './FeedbackSection';
import { compressImage } from '../utils/image';
import { getDaysDifference } from '../utils/dateDuration';

interface CustomerPortalProps {
  orders: Order[];
  catalogue: CatalogueItem[];
  reviews?: CustomerReview[];
  boutiqueLogo?: string;
  boutiquePhone?: string;
  onAddReview?: (newReview: CustomerReview) => void;
  onAddOrder: (newOrder: Order) => void;
  onUpdateOrders?: (updatedOrders: Order[]) => void;
  nextOrderNumber: string;
  isCustomerLocked?: boolean;
}

export default function CustomerPortal({ 
  orders, 
  catalogue, 
  reviews = [], 
  boutiqueLogo: propBoutiqueLogo,
  boutiquePhone: propBoutiquePhone,
  onAddReview, 
  onAddOrder, 
  onUpdateOrders, 
  nextOrderNumber, 
  isCustomerLocked = false 
}: CustomerPortalProps) {
  // Retrieve custom LINE OA settings from localStorage (configured by admin)
  const lineOaId = localStorage.getItem('nunuh_line_oa_id') || '@237aynfq';
  const boutiquePhone = propBoutiquePhone || localStorage.getItem('nunuh_boutique_phone') || '086-555-1234';
  const boutiqueLogo = propBoutiqueLogo || localStorage.getItem('nunuh_boutique_logo') || '';

  const getLineOaHref = (id: string) => {
    const clean = (id || '@237aynfq').trim().replace(/^@/, '');
    return `https://line.me/R/ti/p/@${clean}`;
  };

  // States for Order Tracking
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedOrders, setSearchedOrders] = useState<Order[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLineLocked, setIsLineLocked] = useState(false);
  const [isReviewOnlyMode, setIsReviewOnlyMode] = useState(false);
  const [lockedOrderNumber, setLockedOrderNumber] = useState('');
  const [isCustomerIdentityLocked, setIsCustomerIdentityLocked] = useState(false);
  const [lockedCustomerIdentityQuery, setLockedCustomerIdentityQuery] = useState('');

  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Avatar file input ref
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // States for Customer Profile & Loyalty Card
  const [profileAvatar, setProfileAvatar] = useState<string>('');
  const [showPrivileges, setShowPrivileges] = useState<boolean>(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [copiedLineSummary, setCopiedLineSummary] = useState<boolean>(false);

  // Customer Profile Editing States
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editSocial, setEditSocial] = useState<string>('');

  // Delete attached order reference photo or slip
  const handleDeleteOrderPhoto = (orderId: string, photoType: 'customImage' | 'customImage2' | 'slipImage') => {
    if (!confirm('คุณต้องการลบรูปภาพที่แนบไว้สำหรับออเดอร์นี้ใช่หรือไม่?')) return;

    const updatedGlobalOrders = orders.map(o => {
      if (o.id === orderId) {
        const copy = { ...o };
        if (photoType === 'customImage') copy.customImage = undefined;
        if (photoType === 'customImage2') copy.customImage2 = undefined;
        if (photoType === 'slipImage') copy.slipImage = undefined;
        return copy;
      }
      return o;
    });

    if (onUpdateOrders) {
      onUpdateOrders(updatedGlobalOrders);
    }

    if (searchedOrders) {
      setSearchedOrders(prev => prev ? prev.map(o => {
        if (o.id === orderId) {
          const copy = { ...o };
          if (photoType === 'customImage') copy.customImage = undefined;
          if (photoType === 'customImage2') copy.customImage2 = undefined;
          if (photoType === 'slipImage') copy.slipImage = undefined;
          return copy;
        }
        return o;
      }) : null);
    }
  };

  // Customer Review states for past orders
  const [activeReviewOrderId, setActiveReviewOrderId] = useState<string | null>(null);
  const [reviewRatingDress, setReviewRatingDress] = useState<number>(5);
  const [reviewRatingFabric, setReviewRatingFabric] = useState<number>(5);
  const [reviewRatingService, setReviewRatingService] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);

  // Sync avatar when searchedOrders changes
  useEffect(() => {
    if (searchedOrders && searchedOrders.length > 0) {
      const cleanPhone = searchedOrders[0].customerPhone.replace(/[\s-()]/g, '');
      const savedAvatar = localStorage.getItem(`nunuh_customer_avatar_${cleanPhone}`);
      if (savedAvatar) {
        setProfileAvatar(savedAvatar);
      } else {
        setProfileAvatar('');
      }
    } else {
      setProfileAvatar('');
    }
  }, [searchedOrders]);

  // Handle Avatar Portrait upload & conversion to Base64 with compression
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && searchedOrders && searchedOrders.length > 0) {
      const file = e.target.files[0];
      try {
        const compressedBase64 = await compressImage(file, 400, 400, 0.85);
        const cleanPhone = searchedOrders[0].customerPhone.replace(/[\s-()]/g, '');
        localStorage.setItem(`nunuh_customer_avatar_${cleanPhone}`, compressedBase64);
        setProfileAvatar(compressedBase64);
      } catch (err) {
        console.error('Error compressing avatar image:', err);
      }
    }
  };

  const handleRemoveAvatar = () => {
    if (searchedOrders && searchedOrders.length > 0) {
      const cleanPhone = searchedOrders[0].customerPhone.replace(/[\s-()]/g, '');
      localStorage.removeItem(`nunuh_customer_avatar_${cleanPhone}`);
      setProfileAvatar('');
    }
  };

  const startEditingProfile = (currentName: string, currentPhone: string, currentSocial: string) => {
    setEditName(currentName.replace(/^คุณ\s*/, '').trim());
    setEditPhone(currentPhone);
    setEditSocial(currentSocial === 'ไม่มีระบุช่องทางติดต่อ' ? '' : currentSocial);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = () => {
    if (!searchedOrders || searchedOrders.length === 0 || !onUpdateOrders) return;

    const originalPhone = searchedOrders[0].customerPhone;
    const cleanOriginalPhone = originalPhone.replace(/[\s-()]/g, '');
    const cleanNewPhone = editPhone.replace(/[\s-()]/g, '');

    const finalName = editName.trim().startsWith('คุณ') ? editName.trim() : `คุณ ${editName.trim()}`;
    const finalPhone = editPhone.trim();
    const finalSocial = editSocial.trim();

    // 1. Update all orders in the global list that belong to this customer
    const updatedGlobalOrders = orders.map(order => {
      const orderCleanPhone = order.customerPhone.replace(/[\s-()]/g, '');
      if (orderCleanPhone === cleanOriginalPhone) {
        return {
          ...order,
          customerName: finalName,
          customerPhone: finalPhone,
          customerSocial: finalSocial || undefined
        };
      }
      return order;
    });

    // 2. Sync localStorage items if phone changed
    if (cleanOriginalPhone !== cleanNewPhone) {
      // Copy avatar
      const savedAvatar = localStorage.getItem(`nunuh_customer_avatar_${cleanOriginalPhone}`);
      if (savedAvatar) {
        localStorage.setItem(`nunuh_customer_avatar_${cleanNewPhone}`, savedAvatar);
        localStorage.removeItem(`nunuh_customer_avatar_${cleanOriginalPhone}`);
      }
      // Copy birthday or other localStorage customer-specific settings if any
      const savedBirthday = localStorage.getItem(`nunuh_customer_birthday_${cleanOriginalPhone}`);
      if (savedBirthday) {
        localStorage.setItem(`nunuh_customer_birthday_${cleanNewPhone}`, savedBirthday);
        localStorage.removeItem(`nunuh_customer_birthday_${cleanOriginalPhone}`);
      }
    }

    // 3. Trigger global state save
    onUpdateOrders(updatedGlobalOrders);

    // 4. Update local searchedOrders state to reflect the edited profile and orders
    const updatedSearchedOrders = searchedOrders.map(order => {
      return {
        ...order,
        customerName: finalName,
        customerPhone: finalPhone,
        customerSocial: finalSocial || undefined
      };
    });
    setSearchedOrders(updatedSearchedOrders);

    // If search query matches the phone number, update it to keep the search query updated too
    if (searchQuery.replace(/[\s-()]/g, '') === cleanOriginalPhone) {
      setSearchQuery(finalPhone);
    }

    setIsEditingProfile(false);
  };

  const handleAddFeedback = (orderId: string, content: string, sender: 'customer' | 'tailor') => {
    if (!onUpdateOrders) return;
    
    const updated = orders.map(o => {
      if (o.id === orderId) {
        const newMsg = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender,
          content,
          timestamp: new Date().toISOString()
        };
        return {
          ...o,
          feedbacks: [...(o.feedbacks || []), newMsg]
        };
      }
      return o;
    });
    
    onUpdateOrders(updated);
    
    // Also update searchedOrders state so the change displays immediately
    if (searchedOrders) {
      const updatedSearched = searchedOrders.map(o => {
        if (o.id === orderId) {
          const newMsg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sender,
            content,
            timestamp: new Date().toISOString()
          };
          return {
            ...o,
            feedbacks: [...(o.feedbacks || []), newMsg]
          };
        }
        return o;
      });
      setSearchedOrders(updatedSearched);
    }
  };

  const handleDeleteFeedback = (orderId: string, messageId: string) => {
    if (!onUpdateOrders) return;
    
    const updated = orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          feedbacks: (o.feedbacks || []).filter(msg => msg.id !== messageId)
        };
      }
      return o;
    });
    
    onUpdateOrders(updated);
    
    if (searchedOrders) {
      const updatedSearched = searchedOrders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            feedbacks: (o.feedbacks || []).filter(msg => msg.id !== messageId)
          };
        }
        return o;
      });
      setSearchedOrders(updatedSearched);
    }
  };

  // Helper function to search across orders and return all orders for the matched customer
  const performSearch = (queryStr: string, allOrders?: Order[]) => {
    let sourceOrders = allOrders && allOrders.length > 0 ? allOrders : orders;
    
    // If still empty, fallback to localStorage
    if (!sourceOrders || sourceOrders.length === 0) {
      try {
        const saved = localStorage.getItem('nunuh_orders');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            sourceOrders = parsed;
          }
        }
      } catch (e) {}
    }

    const query = (queryStr || '').trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, '');
    const cleanQuery = query.replace(/[\s-()#_]/g, '');

    if (!query) {
      return { matchedOrders: null, searched: false, isCustomerIdentified: false };
    }

    // Normalize search query: remove Thai title prefixes (คุณ, นางสาว, น.ส., นาง, นาย, ด.ญ., ด.ช., พี่, น้อง, ช่าง, ลูกค้า)
    const strippedTitleQuery = query.replace(/^(คุณ|นางสาว|น\.ส\.|นาง|นาย|ด\.ญ\.|ด\.ช\.|พี่|น้อง|ช่าง|ลูกค้า)\s*/i, '').trim();
    const cleanStrippedQuery = strippedTitleQuery.replace(/[- \s\t\n()#_]/g, '');

    const matched = (sourceOrders || []).filter(order => {
      if (!order) return false;
      const phoneDigits = (order.customerPhone || '').replace(/\D/g, '');
      const cleanPhone = (order.customerPhone || '').replace(/[\s-()]/g, '');
      const orderNum = (order.orderNumber || '').toLowerCase();
      const cleanOrderNum = orderNum.replace(/[- \s#_]/g, '');
      const customerName = (order.customerName || '').toLowerCase();
      const nameNoTitle = customerName.replace(/^(คุณ|นางสาว|น\.ส\.|นาง|นาย|ด\.ญ\.|ด\.ช\.|พี่|น้อง|ช่าง|ลูกค้า)\s*/i, '').trim();
      const nameNoSpaces = nameNoTitle.replace(/[- \s\t\n]/g, '');
      const customerNickname = (order.customerNickname || '').toLowerCase();
      const sku = (order.sku || '').toLowerCase();
      const lineUserId = (order.lineUserId || '').toLowerCase();
      const extOrderId = (order.externalOrderId || '').toLowerCase();
      const dressType = (order.dressType || '').toLowerCase();
      const fabricType = (order.fabricType || '').toLowerCase();
      const tailorName = (order.tailorName || '').toLowerCase();
      const branch = (order.branch || '').toLowerCase();
      const idhNumber = (order.idhNumber || '').toLowerCase();
      const notes = (order.notes || '').toLowerCase();

      // 1. Phone number matching (exact, substring, or digit matching)
      const matchesPhone = 
        (queryDigits.length >= 2 && (phoneDigits.includes(queryDigits) || queryDigits.includes(phoneDigits))) ||
        (cleanQuery.length >= 2 && cleanPhone.includes(cleanQuery));

      // 2. Order number / SKU / Line / Ext ID / IDH matching
      const matchesOrderNum = 
        orderNum.includes(query) || 
        (cleanQuery.length >= 1 && cleanOrderNum.includes(cleanQuery)) ||
        order.id?.toLowerCase() === query;
      const matchesSku = sku && (sku.includes(query) || (cleanQuery.length >= 2 && sku.replace(/[- \s]/g, '').includes(cleanQuery)));
      const matchesExtId = extOrderId && extOrderId.includes(query);
      const matchesIdh = idhNumber && (idhNumber.includes(query) || idhNumber.includes(cleanQuery));
      const matchesLine = lineUserId && lineUserId === query;

      // 3. Customer name matching (full name, stripped title, without spaces)
      const matchesDirectName = 
        customerName.includes(query) || 
        (nameNoTitle && nameNoTitle.includes(strippedTitleQuery)) ||
        (cleanStrippedQuery.length >= 1 && nameNoSpaces.includes(cleanStrippedQuery));

      // 4. Customer nickname matching
      const matchesNickname = customerNickname && (
        customerNickname.includes(query) || 
        customerNickname.includes(strippedTitleQuery) || 
        query.includes(customerNickname)
      );

      // 5. Dress & Fabric & Tailor & Branch & Notes matching
      const matchesDress = dressType && (dressType.includes(query) || dressType.includes(strippedTitleQuery));
      const matchesFabric = fabricType && fabricType.includes(query);
      const matchesTailor = tailorName && (tailorName.includes(query) || tailorName.includes(strippedTitleQuery));
      const matchesBranch = branch && branch.includes(query);
      const matchesNotes = notes && notes.includes(query);

      // 6. Word tokens matching (e.g. searching first name only or last name only)
      const words = query.split(/[\s,+/]+/).filter(w => w.length >= 2);
      const matchesWords = words.length > 0 && words.some(w => 
        customerName.includes(w) || 
        nameNoTitle.includes(w) || 
        (customerNickname && customerNickname.includes(w)) ||
        dressType.includes(w) ||
        tailorName.includes(w)
      );

      return (
        matchesPhone || 
        matchesOrderNum || 
        matchesSku || 
        matchesExtId || 
        matchesIdh ||
        matchesLine || 
        matchesDirectName || 
        matchesNickname || 
        matchesDress || 
        matchesFabric || 
        matchesTailor || 
        matchesBranch || 
        matchesNotes || 
        matchesWords
      );
    });

    if (matched.length > 0) {
      // Find all associated phone numbers and normalized customer names from matched orders
      const matchedPhones = new Set(
        matched.map(o => (o.customerPhone || '').replace(/\D/g, '')).filter(Boolean)
      );
      const matchedNames = new Set(
        matched.map(o => (o.customerName || '').replace(/^(คุณ|นางสาว|น\.ส\.|นาง|นาย|ด\.ญ\.|ด\.ช\.|พี่|น้อง|ช่าง|ลูกค้า)\s*/i, '').replace(/[- \s\t\n]/g, '').toLowerCase()).filter(Boolean)
      );
      const matchedOrderIds = new Set(matched.map(o => o.id));

      // Retrieve ALL orders belonging to this customer
      const allCustomerOrders = (sourceOrders || []).filter(o => {
        const pDigits = (o.customerPhone || '').replace(/\D/g, '');
        const cNameNorm = (o.customerName || '').replace(/^(คุณ|นางสาว|น\.ส\.|นาง|นาย|ด\.ญ\.|ด\.ช\.|พี่|น้อง|ช่าง|ลูกค้า)\s*/i, '').replace(/[- \s\t\n]/g, '').toLowerCase();
        return (pDigits && matchedPhones.has(pDigits)) || (cNameNorm && matchedNames.has(cNameNorm)) || matchedOrderIds.has(o.id);
      });

      // Sort newest orders first
      allCustomerOrders.sort((a, b) => {
        return (b.orderNumber || '').localeCompare(a.orderNumber || '', undefined, { numeric: true });
      });

      return { matchedOrders: allCustomerOrders, searched: true, isCustomerIdentified: true };
    }

    return { matchedOrders: [], searched: true, isCustomerIdentified: false };
  };

  // Flag to ensure URL parameter search only sets state on initial mount
  const isInitialUrlCheckDone = useRef(false);

  // Initial check from URL search parameters on mount & sync background order updates
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearchParam = params.get('search');
    const urlPhoneParam = params.get('phone');
    const actionParam = params.get('action');
    const isReviewAction = actionParam === 'review' || params.get('review') === 'true';
    const queryToUse = urlSearchParam || urlPhoneParam || searchQuery || '';

    if (!isInitialUrlCheckDone.current && (urlSearchParam || urlPhoneParam)) {
      if (queryToUse) {
        setSearchQuery(queryToUse);
        if (isReviewAction) {
          setIsReviewOnlyMode(true);
          setLockedOrderNumber(queryToUse);
          const cleanQuery = queryToUse.trim().toLowerCase();
          const singleOrder = orders.find(o => o.orderNumber.toLowerCase() === cleanQuery || o.id === cleanQuery);
          if (singleOrder) {
            setSearchedOrders([singleOrder]);
            setHasSearched(true);
            const existingReview = reviews?.find(r => r.orderId === singleOrder.id || r.orderNumber === singleOrder.orderNumber);
            if (!existingReview) {
              setActiveReviewOrderId(singleOrder.id);
            }
          } else {
            const { matchedOrders, searched } = performSearch(queryToUse, orders);
            setSearchedOrders(matchedOrders);
            setHasSearched(searched);
          }
        } else {
          const { matchedOrders, searched, isCustomerIdentified } = performSearch(queryToUse, orders);
          setSearchedOrders(matchedOrders);
          setHasSearched(searched);
          if (isCustomerLocked && isCustomerIdentified && matchedOrders && matchedOrders.length > 0) {
            setIsCustomerIdentityLocked(true);
            setLockedCustomerIdentityQuery(matchedOrders[0].customerPhone || matchedOrders[0].customerName || matchedOrders[0].orderNumber || queryToUse);
          }
        }
      }
      isInitialUrlCheckDone.current = true;
    } else if (searchQuery.trim()) {
      if (isReviewOnlyMode && lockedOrderNumber) {
        const cleanQuery = lockedOrderNumber.trim().toLowerCase();
        const singleOrder = orders.find(o => o.orderNumber.toLowerCase() === cleanQuery || o.id === cleanQuery);
        if (singleOrder) {
          setSearchedOrders([singleOrder]);
        }
      } else {
        // Background order update (e.g. server sync): re-sync searched orders without wiping query
        const { matchedOrders, searched } = performSearch(searchQuery, orders);
        setSearchedOrders(matchedOrders);
        if (searched) setHasSearched(true);
      }
    }
  }, [orders]);

  // Handle Search Input Change with live search
  const handleSearchInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReviewOnlyMode) return;
    const val = e.target.value;
    setSearchQuery(val);

    if (!val.trim()) {
      setSearchedOrders(null);
      setHasSearched(false);
      return;
    }

    let currentOrdersList = orders;
    if (!currentOrdersList || currentOrdersList.length === 0) {
      try {
        const res = await fetch('/api/orders');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            currentOrdersList = data;
            if (onUpdateOrders) onUpdateOrders(data);
          }
        }
      } catch (err) {}
    }

    const { matchedOrders, searched, isCustomerIdentified } = performSearch(val, currentOrdersList);
    setSearchedOrders(matchedOrders);
    setHasSearched(searched);

    if (isCustomerLocked && isCustomerIdentified && matchedOrders && matchedOrders.length > 0) {
      setLockedCustomerIdentityQuery(matchedOrders[0].customerPhone || matchedOrders[0].customerName || matchedOrders[0].orderNumber || val);
    }
  };

  // Handle Search Form Submit
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReviewOnlyMode) return;
    if (!searchQuery.trim()) {
      setSearchedOrders(null);
      setHasSearched(false);
      return;
    }

    let currentOrdersList = orders;
    if (!currentOrdersList || currentOrdersList.length === 0) {
      try {
        const res = await fetch('/api/orders');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            currentOrdersList = data;
            if (onUpdateOrders) onUpdateOrders(data);
          }
        }
      } catch (err) {}
    }

    const { matchedOrders, searched, isCustomerIdentified } = performSearch(searchQuery, currentOrdersList);
    setSearchedOrders(matchedOrders);
    setHasSearched(searched);

    if (isCustomerLocked && isCustomerIdentified && matchedOrders && matchedOrders.length > 0) {
      setLockedCustomerIdentityQuery(matchedOrders[0].customerPhone || matchedOrders[0].customerName || matchedOrders[0].orderNumber || searchQuery);
    }
  };

  // Handle Customer Review Image Upload
  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingImage(true);
    try {
      const compressed = await compressImage(file);
      setReviewImage(compressed);
    } catch (err) {
      console.error('Failed to compress image:', err);
    } finally {
      setIsCompressingImage(false);
    }
  };

  // Submit Review from Customer Portal
  const submitCustomerReview = (order: Order) => {
    if (!onAddReview) {
      console.warn('onAddReview handler is missing in props');
    }

    const calculatedRating = Math.round((reviewRatingDress + reviewRatingFabric + reviewRatingService) / 3);

    const newReview: CustomerReview = {
      id: `rev-${Date.now()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      dressType: order.dressType,
      rating: calculatedRating,
      ratingDress: reviewRatingDress,
      ratingFabric: reviewRatingFabric,
      ratingService: reviewRatingService,
      comment: reviewComment || 'ลูกค้าไม่ได้กรอกความคิดเห็นเพิ่มเติม',
      tailorNote: '',
      reviewImage: reviewImage || undefined,
      createdAt: new Date().toISOString()
    };

    if (onAddReview) {
      onAddReview(newReview);
    } else {
      // Direct LocalStorage fallback if prop is missing
      const savedReviews = localStorage.getItem('nunuh_reviews');
      let parsedReviews: CustomerReview[] = [];
      if (savedReviews) {
        try {
          parsedReviews = JSON.parse(savedReviews);
        } catch (e) {}
      }
      const updatedReviews = [newReview, ...parsedReviews];
      localStorage.setItem('nunuh_reviews', JSON.stringify(updatedReviews));
    }

    // Show beautiful success
    alert('ขอบคุณสำหรับรีวิวความพึงพอใจและคำติชมของคุณมากๆ ค่ะ! ความคิดเห็นของคุณจะส่งตรงไปยังทีมงานดีไซเนอร์และช่างฝีมือของ NUNUH ทันทีค่ะ 💖');

    // Reset state
    setActiveReviewOrderId(null);
    setReviewRatingDress(5);
    setReviewRatingFabric(5);
    setReviewRatingService(5);
    setReviewComment('');
    setReviewImage(null);
  };

  // Get Progress Percentage based on Status (22 Production Pipeline Steps)
  const getStatusProgress = (status: OrderStatus | string): number => {
    if (status === OrderStatus.COMPLETED) return 100;
    const index = PRODUCTION_PIPELINE_STEPS.indexOf(status as OrderStatus);
    if (index >= 0) {
      return Math.round(((index + 1) / PRODUCTION_PIPELINE_STEPS.length) * 100);
    }
    switch (status) {
      case OrderStatus.RECEIVED: return 10;
      case OrderStatus.DESIGNING: return 20;
      case OrderStatus.CUTTING: return 35;
      case OrderStatus.SEWING: return 50;
      case OrderStatus.FITTING: return 70;
      case OrderStatus.READY: return 90;
      case OrderStatus.COMPLETED: return 100;
      default: return 5;
    }
  };



  return (
    <div className="space-y-12">
      
      {/* HEADER SECTION */}
      <div className="bg-natural-espresso text-natural-cream p-8 rounded-3xl text-center space-y-3 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-natural-clay/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-natural-ochre/15 rounded-full blur-3xl"></div>
        
        <div className="mx-auto bg-natural-sand/15 w-14 h-14 rounded-2xl flex items-center justify-center mb-2">
          <Sparkles className="h-7 w-7 text-natural-ochre" />
        </div>
        
        <h3 className="font-serif font-extrabold text-2xl sm:text-3xl tracking-wide text-natural-sand">
          NUNUH Customer Lounge
        </h3>
        <p className="text-sm max-w-xl mx-auto text-natural-cream/80 leading-relaxed">
          ยินดีต้อนรับเข้าสู่พื้นที่พิเศษสำหรับลูกค้าคนสำคัญ คุณสามารถตรวจสอบสถานะ คิวตัดเย็บ และขนาดสัดส่วนการวัดตัวของท่านได้
        </p>
      </div>

      {/* SECTION 1: SEARCH & TRACK STATUS */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-natural-wheat shadow-sm space-y-6">
        <div className="flex items-center space-x-3 border-b border-natural-sand pb-4">
          <div className="p-2 bg-natural-sand text-natural-clay rounded-xl">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-lg text-natural-espresso">ค้นหาประวัติการสั่งตัด & ข้อมูลชุดของลูกค้าทั้งหมด</h4>
            <p className="text-xs text-natural-espresso/60">ค้นหาได้ทั้งชื่อลูกค้า (เช่น คุณมัสยา, ซารอฟะห์), เบอร์มือถือ (เช่น 0801462230) หรือหมายเลขคิวออเดอร์ (เช่น NU-26008)</p>
          </div>
        </div>

        {/* Search Bar Form or Locked Review Banner */}
        {isReviewOnlyMode ? (
          <div className="bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-amber-500/10 border border-pink-300/80 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-3xs animate-fade-in my-1">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-pink-600 text-white rounded-2xl shadow-xs shrink-0">
                <Star className="h-6 w-6 fill-amber-300 text-amber-300" />
              </div>
              <div>
                <h4 className="font-serif font-black text-sm sm:text-base text-pink-950 flex items-center gap-2">
                  <span>🔒 หน้ารีวิวความพึงพอใจสำหรับออเดอร์ #{searchedOrders && searchedOrders[0] ? searchedOrders[0].orderNumber : searchQuery}</span>
                </h4>
                <p className="text-xs text-natural-espresso/70 mt-0.5">
                  {searchedOrders && searchedOrders[0] ? `เรียนคุณ ${searchedOrders[0].customerName.replace('คุณ', '').trim()} (${searchedOrders[0].dressType})` : ''} — ระบบจำกัดการเข้าถึงเฉพาะออเดอร์นี้ของคุณเพื่อความเป็นส่วนตัวค่ะ ✨
                </p>
              </div>
            </div>
            <div className="bg-white/90 border border-pink-200 px-3.5 py-2 rounded-xl text-xs font-bold text-pink-900 shadow-3xs flex items-center gap-1.5 shrink-0">
              <Lock className="h-4 w-4 text-pink-600" />
              <span>สงวนสิทธิ์เฉพาะออเดอร์นี้</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-natural-espresso/45" />
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อลูกค้า (เช่น คุณมัสยา, ซารอฟะห์), เบอร์มือถือ หรือ หมายเลขคิว เพื่อค้นหา..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  className="w-full text-sm pl-12 pr-10 py-3.5 rounded-xl border border-natural-wheat focus:outline-none focus:ring-2 focus:ring-natural-clay/20 focus:border-natural-clay bg-natural-cream/15 text-natural-espresso font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchedOrders(null);
                      setHasSearched(false);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-natural-espresso/40 hover:text-natural-espresso rounded-full hover:bg-stone-100 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="bg-natural-espresso hover:bg-natural-clay text-natural-cream hover:text-white font-serif font-bold px-8 py-3.5 rounded-xl transition-all duration-300 shadow-sm cursor-pointer whitespace-nowrap"
              >
                ค้นหารายการออเดอร์
              </button>
            </form>

            {/* Quick search suggestions from real orders in system */}
            {(() => {
              const sourceOrders = orders && orders.length > 0 ? orders : [];
              const chips: { label: string; query: string }[] = [];
              
              sourceOrders.slice(0, 8).forEach(o => {
                if (o.customerName && !chips.some(c => c.query === o.customerName)) {
                  chips.push({ label: o.customerName, query: o.customerName });
                }
                if (o.customerPhone && !chips.some(c => c.query === o.customerPhone)) {
                  chips.push({ label: o.customerPhone, query: o.customerPhone });
                }
                if (o.orderNumber && !chips.some(c => c.query === o.orderNumber)) {
                  chips.push({ label: o.orderNumber, query: o.orderNumber });
                }
              });

              return (
                <div className="flex items-center flex-wrap gap-2 text-xs text-natural-espresso/70 pt-1">
                  <span className="text-[11px] text-natural-espresso/50 font-medium">💡 คลิกค้นหาทันที:</span>
                  {chips.length > 0 ? (
                    chips.slice(0, 6).map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSearchQuery(chip.query);
                          const { matchedOrders, searched } = performSearch(chip.query, orders);
                          setSearchedOrders(matchedOrders);
                          setHasSearched(searched);
                        }}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-natural-sand/70 hover:text-natural-espresso text-natural-espresso/80 rounded-lg text-[11px] font-medium transition-all cursor-pointer border border-stone-200/60"
                      >
                        {chip.label}
                      </button>
                    ))
                  ) : (
                    <span className="text-[11px] text-natural-espresso/40">พิมพ์ชื่อ เบอร์ หรือรหัสออเดอร์ในช่องค้นหา</span>
                  )}
                  {sourceOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchedOrders(sourceOrders);
                        setHasSearched(true);
                      }}
                      className="px-2.5 py-1 bg-natural-sand/60 hover:bg-natural-sand text-natural-espresso font-bold rounded-lg text-[11px] transition-all cursor-pointer border border-natural-wheat"
                    >
                      📋 แสดงทุกออเดอร์ ({sourceOrders.length})
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Search Results Display */}
        <div className="space-y-6">
          {/* Initial Empty State - Before Searching */}
          {(!hasSearched || searchedOrders === null) && (
            <div className="bg-gradient-to-br from-[#fcfbf9] via-white to-[#f7f5ef] border-2 border-dashed border-natural-wheat/80 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xs animate-fade-in my-2">
              <div className="w-16 h-16 bg-natural-sand/50 text-natural-espresso rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-natural-wheat/60">
                <Search className="h-8 w-8 text-natural-clay" />
              </div>

              <div className="max-w-lg mx-auto space-y-2">
                <h3 className="font-serif font-extrabold text-xl sm:text-2xl text-natural-espresso">
                  ศูนย์ค้นหาและติดตามข้อมูลการสั่งตัดทั้งหมด (Customer Portal)
                </h3>
                <p className="text-xs sm:text-sm text-natural-espresso/70 leading-relaxed">
                  กรุณากรอก <strong className="text-natural-espresso underline">ชื่อลูกค้า</strong>, <strong className="text-natural-espresso underline">เบอร์โทรศัพท์มือถือ</strong> หรือ <strong className="text-natural-espresso underline">หมายเลขคิวออเดอร์</strong> ในช่องค้นหาด้านบน แล้วกดปุ่ม <strong>"ค้นหารายการออเดอร์"</strong> เพื่อดูข้อมูลการสั่งชุด สัดส่วนการวัดตัว และประวัติการตัดเย็บทั้งหมดของคุณค่ะ
                </p>
                {orders && orders.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchedOrders(orders);
                        setHasSearched(true);
                      }}
                      className="px-5 py-2.5 bg-natural-espresso hover:bg-natural-clay text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-natural-ochre" />
                      <span>เปิดดูรายการออเดอร์ทั้งหมดในระบบ ({orders.length} รายการ)</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2 text-left">
                <div className="bg-white/90 p-4 rounded-2xl border border-natural-wheat/60 shadow-3xs flex items-start space-x-3">
                  <div className="p-2 bg-rose-50 text-rose-700 rounded-xl shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-natural-espresso">ค้นหาด้วยชื่อลูกค้า</p>
                    <p className="text-[11px] text-natural-espresso/60 mt-0.5">พิมพ์ชื่อหรือชื่อเล่น เช่น <span className="text-natural-clay font-bold">คุณมัสยา</span>, <span className="text-natural-clay font-bold">ซารอฟะห์</span></p>
                  </div>
                </div>

                <div className="bg-white/90 p-4 rounded-2xl border border-natural-wheat/60 shadow-3xs flex items-start space-x-3">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl shrink-0 mt-0.5">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-natural-espresso">ค้นหาด้วยเบอร์มือถือ</p>
                    <p className="text-[11px] text-natural-espresso/60 mt-0.5">พิมพ์เบอร์ที่ลงทะเบียน เช่น <span className="font-mono text-natural-clay font-bold">0801462230</span></p>
                  </div>
                </div>

                <div className="bg-white/90 p-4 rounded-2xl border border-natural-wheat/60 shadow-3xs flex items-start space-x-3">
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-xl shrink-0 mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-natural-espresso">ค้นหาด้วยเลขคิวออเดอร์</p>
                    <p className="text-[11px] text-natural-espresso/60 mt-0.5">พิมพ์รหัสออเดอร์ เช่น <span className="font-mono text-natural-clay font-bold">NU-26008</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasSearched && searchedOrders && searchedOrders.length > 0 && (() => {
            const mainOrder = searchedOrders[0];
            const cName = mainOrder.customerName;
            const cPhone = mainOrder.customerPhone;
            const cSocial = mainOrder.customerSocial || 'ไม่มีระบุช่องทางติดต่อ';
            const cCategory = mainOrder.customerCategory || 'ทั่วไป';
            const cMeasurements = mainOrder.measurements;

            const totalOrders = searchedOrders.length;
            const activeOrdersList = searchedOrders.filter(o => o.status !== OrderStatus.COMPLETED);
            const pastOrdersList = searchedOrders.filter(o => o.status === OrderStatus.COMPLETED);
            const totalSpent = searchedOrders.reduce((sum, o) => sum + o.price - (o.discount || 0), 0);
            const loyaltyPoints = Math.floor(totalSpent / 100);

            // Priority order of tiers: 1. PRIME, 2. PRIVILEGE, 3. TRADER, 4. MEMBER
            const tierPriority: Record<'PRIME' | 'PRIVILEGE' | 'TRADER' | 'MEMBER', number> = {
              'PRIME': 1,
              'PRIVILEGE': 2,
              'TRADER': 3,
              'MEMBER': 4
            };

            // Check if any order has an explicit membershipTier set and pick the highest priority one
            let explicitTier: 'PRIME' | 'PRIVILEGE' | 'TRADER' | 'MEMBER' | null = null;
            for (const order of searchedOrders) {
              if (order.membershipTier) {
                if (!explicitTier || tierPriority[order.membershipTier] < tierPriority[explicitTier]) {
                  explicitTier = order.membershipTier;
                }
              }
            }

            let tierId: 'PRIME' | 'PRIVILEGE' | 'TRADER' | 'MEMBER' = 'MEMBER';
            if (explicitTier) {
              tierId = explicitTier;
            } else {
              // Fallback based on job type and orders count
              if (cCategory === 'IDD') {
                tierId = 'PRIME';
              } else if (cCategory === 'IDH') {
                tierId = 'PRIVILEGE';
              } else if (totalOrders >= 3) {
                tierId = 'TRADER';
              } else {
                tierId = 'MEMBER';
              }
            }

            let tierName = tierId;
            let tierFullName = '';
            let tierCardBg = '';
            let tierBadgeBg = '';

            if (tierId === 'PRIME') {
              tierFullName = 'PRIME VIP ELITE';
              tierCardBg = 'bg-gradient-to-br from-black via-zinc-900 to-stone-950 text-yellow-100 border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]';
              tierBadgeBg = 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30';
            } else if (tierId === 'PRIVILEGE') {
              tierFullName = 'PRIVILEGE ROYAL VIP';
              tierCardBg = 'bg-gradient-to-br from-[#3b0712] via-[#5c0d1e] to-[#1a0206] text-rose-100 border border-rose-500/30';
              tierBadgeBg = 'bg-rose-500/15 text-rose-700 border-rose-500/30';
            } else if (tierId === 'TRADER') {
              tierFullName = 'TRADER GOLD MEMBER';
              tierCardBg = 'bg-gradient-to-br from-[#064e3b] via-[#022c22] to-[#043e2e] text-emerald-100 border border-emerald-400/20';
              tierBadgeBg = 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
            } else {
              tierFullName = 'STANDARD BOUTIQUE MEMBER';
              tierCardBg = 'bg-gradient-to-br from-[#2c221e] via-[#1a1311] to-[#2c221e] text-natural-cream border border-natural-wheat/25';
              tierBadgeBg = 'bg-natural-espresso/10 text-natural-espresso border-natural-espresso/20';
            }

            // Calculate status breakdown for this customer's phone number
            const statusBreakdown: Partial<Record<OrderStatus, number>> = {
              [OrderStatus.RECEIVED]: searchedOrders.filter(o => o.status === OrderStatus.RECEIVED).length,
              [OrderStatus.DESIGNING]: searchedOrders.filter(o => o.status === OrderStatus.DESIGNING).length,
              [OrderStatus.CUTTING]: searchedOrders.filter(o => o.status === OrderStatus.CUTTING).length,
              [OrderStatus.SEWING]: searchedOrders.filter(o => o.status === OrderStatus.SEWING).length,
              [OrderStatus.FITTING]: searchedOrders.filter(o => o.status === OrderStatus.FITTING).length,
              [OrderStatus.READY]: searchedOrders.filter(o => o.status === OrderStatus.READY).length,
              [OrderStatus.COMPLETED]: searchedOrders.filter(o => o.status === OrderStatus.COMPLETED).length,
            };

            // Filter displayed list based on selection tab & status filter
            const displayedOrders = searchedOrders.filter(order => {
              if (selectedStatusFilter !== 'ALL' && order.status !== selectedStatusFilter) return false;
              if (activeHistoryTab === 'active') return order.status !== OrderStatus.COMPLETED;
              if (activeHistoryTab === 'completed') return order.status === OrderStatus.COMPLETED;
              return true;
            });

            return (
              <div className="space-y-8 animate-fade-in">
                {/* 1. CUSTOMER PROFILE & MEMBERSHIP CARD DASHBOARD */}
                <div id="customer-profile-dashboard" className="bg-gradient-to-br from-[#fbfaf8] via-white to-[#f6f4ee] p-6 sm:p-8 rounded-3xl border border-natural-wheat/70 shadow-xs space-y-8">
                  {/* TOP LEVEL */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-natural-sand pb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-natural-espresso text-natural-cream rounded-xl shadow-xs">
                        <User className="h-6 w-6 text-natural-ochre" />
                      </div>
                      <div>
                        <h3 className="font-serif font-extrabold text-xl text-natural-espresso">ข้อมูลโปรไฟล์ผู้สั่งตัด (Client Profile Dashboard)</h3>
                        <p className="text-xs text-natural-espresso/60">ขอบคุณที่คุณให้ NUNUH Boutique ได้ดูแลออกแบบสรรสร้างงานศิลปะแพทเทิร์นของคุณค่ะ</p>
                      </div>
                    </div>
                  </div>

                  {/* GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* LEFT COLUMN: Client Portrait */}
                    <div className="space-y-6 flex flex-col justify-between">
                      {/* Portrait Photo Upload & Display */}
                      <div className="bg-white p-5 rounded-2xl border border-natural-sand shadow-2xs space-y-4">
                        <h5 className="font-serif font-bold text-xs text-natural-espresso flex items-center space-x-2 border-b border-natural-sand pb-2">
                          <span>🖼️ รูปลูกค้าคนสำคัญ (Client Portrait)</span>
                        </h5>
                        
                        <div className="flex items-center space-x-5">
                          {/* Avatar Circle with upload camera trigger */}
                          <div className="flex flex-col items-center shrink-0">
                            <div className="relative group">
                              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-natural-clay/30 bg-natural-sand/10 flex items-center justify-center relative shadow-inner">
                                {profileAvatar ? (
                                  <img 
                                    src={profileAvatar} 
                                    alt="Client Portrait" 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="text-center text-natural-espresso/25 flex flex-col items-center">
                                    <User className="h-10 w-10 text-natural-espresso/20" />
                                    <span className="text-[9px] font-bold text-natural-espresso/40">ไม่มีรูปโปรไฟล์</span>
                                  </div>
                                )}

                                {/* Hidden file input */}
                                <input 
                                  type="file" 
                                  ref={avatarInputRef} 
                                  accept="image/*" 
                                  onChange={handleAvatarUpload} 
                                  className="hidden" 
                                />

                                {/* Hover overlay button */}
                                <button
                                  type="button"
                                  onClick={() => avatarInputRef.current?.click()}
                                  className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer"
                                  title="คลิกเพื่อเลือกหรือเปลี่ยนรูปโปรไฟล์"
                                >
                                  <Camera className="h-5 w-5 mb-0.5" />
                                  <span>{profileAvatar ? 'เปลี่ยนรูป' : 'ใส่รูป'}</span>
                                </button>
                              </div>

                              {/* Camera badge button */}
                              <button
                                type="button"
                                onClick={() => avatarInputRef.current?.click()}
                                className="absolute bottom-0 right-0 p-1.5 bg-natural-clay hover:bg-natural-clay/90 text-white rounded-full shadow-md transition-all cursor-pointer border border-white"
                                title="ใส่/เปลี่ยนรูปโปรไฟล์"
                              >
                                <Camera className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Direct Add/Change Profile Photo Button */}
                            <button
                              type="button"
                              onClick={() => avatarInputRef.current?.click()}
                              className="mt-2 text-[10px] bg-natural-clay hover:bg-natural-clay/90 text-white px-2.5 py-1 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                            >
                              <Camera className="h-3 w-3" />
                              <span>{profileAvatar ? 'เปลี่ยนรูปโปรไฟล์' : 'เพิ่มรูปโปรไฟล์'}</span>
                            </button>
                          </div>
                          
                          <div className="space-y-1 flex-1">
                            {isEditingProfile ? (
                              <div className="space-y-2 w-full animate-fade-in text-xs">
                                <div>
                                  <label className="block text-[9px] font-bold text-natural-espresso/50 uppercase">ชื่อผู้สั่งตัด (Name)</label>
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full text-xs px-2 py-1 rounded border border-natural-sand focus:outline-none focus:ring-1 focus:ring-natural-clay bg-white text-natural-espresso font-medium"
                                    placeholder="ชื่อ-นามสกุล"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-natural-espresso/50 uppercase">เบอร์โทรศัพท์ (Phone)</label>
                                  <input
                                    type="text"
                                    value={editPhone}
                                    onChange={(e) => setEditPhone(e.target.value)}
                                    className="w-full text-xs px-2 py-1 rounded border border-natural-sand focus:outline-none focus:ring-1 focus:ring-natural-clay bg-white text-natural-espresso font-medium"
                                    placeholder="เบอร์โทรศัพท์"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-natural-espresso/50 uppercase">Line / ช่องทางติดต่อ (Contact)</label>
                                  <input
                                    type="text"
                                    value={editSocial}
                                    onChange={(e) => setEditSocial(e.target.value)}
                                    className="w-full text-xs px-2 py-1 rounded border border-natural-sand focus:outline-none focus:ring-1 focus:ring-natural-clay bg-white text-natural-espresso font-medium"
                                    placeholder="Line ID / IG"
                                  />
                                </div>

                                {/* Profile photo actions inside edit form */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-100">
                                  <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-1 rounded font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Camera className="h-3 w-3 text-stone-500" />
                                    <span>{profileAvatar ? 'เปลี่ยนรูปโปรไฟล์' : 'แนบรูปโปรไฟล์'}</span>
                                  </button>

                                  {profileAvatar && (
                                    <button 
                                      type="button"
                                      onClick={handleRemoveAvatar}
                                      className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded font-bold transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      <span>ลบรูป</span>
                                    </button>
                                  )}
                                </div>

                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={handleSaveProfile}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                  >
                                    บันทึก
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingProfile(false)}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-750 px-2.5 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-center space-x-1.5">
                                  <h4 className="font-serif font-black text-base text-natural-espresso leading-tight">
                                    คุณ {cName.replace('คุณ', '').trim()}
                                  </h4>
                                </div>
                                <p className="text-xs text-natural-espresso/70 font-medium flex items-center">
                                  <Phone className="h-3.5 w-3.5 mr-1.5 text-natural-clay" /> {cPhone}
                                </p>
                                <div className="text-xs text-natural-espresso/60 font-medium flex flex-wrap items-center gap-1.5">
                                  <span className="text-natural-clay">✉️ ช่องทางติดต่อ:</span>
                                  {lineOaId ? (
                                    <a 
                                      href={getLineOaHref(lineOaId)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#05b34c] font-black px-2 py-0.5 rounded border border-[#06C755]/30 inline-flex items-center space-x-1 transition-all"
                                      title={`คลิกเพื่อแชทกับแอดมิน ${lineOaId} บน LINE ทันที`}
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      <span>{cSocial} (LINE {lineOaId})</span>
                                    </a>
                                  ) : (
                                    <span className="bg-natural-sand/15 text-natural-espresso/80 font-bold px-2 py-0.5 rounded border border-natural-wheat/50 inline-flex items-center space-x-1">
                                      <MessageSquare className="h-3 w-3" />
                                      <span>{cSocial}</span>
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditingProfile(cName, cPhone, cSocial)}
                                    className="text-[10px] bg-natural-sand/20 hover:bg-natural-sand/40 text-natural-espresso font-bold px-2.5 py-1 rounded-lg border border-natural-wheat/80 cursor-pointer transition-all"
                                  >
                                    ✏️ แก้ไขข้อมูลโปรไฟล์
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="text-[10px] bg-natural-clay/10 hover:bg-natural-clay/20 text-natural-clay font-bold px-2.5 py-1 rounded-lg border border-natural-clay/30 flex items-center gap-1 cursor-pointer transition-all"
                                  >
                                    <Camera className="h-3 w-3" />
                                    <span>{profileAvatar ? 'เปลี่ยนรูปโปรไฟล์' : 'ใส่รูปโปรไฟล์'}</span>
                                  </button>

                                  {profileAvatar && (
                                    <button 
                                      type="button"
                                      onClick={handleRemoveAvatar}
                                      className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1 rounded-lg border border-red-200 flex items-center gap-1 cursor-pointer transition-all"
                                      title="ลบรูปโปรไฟล์ออก"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      <span>ลบรูปโปรไฟล์</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Support Summary (replacing loyalty card) */}
                    <div className="space-y-6 flex flex-col justify-between">
                      <div className="bg-white p-5 rounded-2xl border border-natural-sand shadow-2xs space-y-4 flex-1 flex flex-col justify-center">
                        <h5 className="font-serif font-bold text-xs text-natural-espresso flex items-center space-x-2 border-b border-natural-sand pb-2">
                          <span>📊 ประวัติการสนับสนุน (Boutique Support Summary)</span>
                        </h5>
                        {/* Mini Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="bg-natural-sand/10 p-4 rounded-2xl border border-natural-sand/40">
                            <p className="text-[10px] text-natural-espresso/50 font-bold uppercase tracking-wider">ชุดสั่งตัดรวม</p>
                            <p className="text-base font-serif font-black text-natural-clay mt-1">{totalOrders} ชุด</p>
                          </div>
                          <div className="bg-natural-sand/10 p-4 rounded-2xl border border-natural-sand/40">
                            <p className="text-[10px] text-natural-espresso/50 font-bold uppercase tracking-wider">ยอดสนับสนุนทั้งหมด</p>
                            <p className="text-base font-serif font-black text-natural-clay mt-1">฿{totalSpent.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1.5 STATUS BREAKDOWN CARD BY PHONE NUMBER */}
                <div className="bg-gradient-to-br from-[#faf8f5] via-white to-[#f5f2ea] p-5 sm:p-6 rounded-3xl border border-natural-wheat shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-natural-sand pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-natural-clay/10 text-natural-clay rounded-xl border border-natural-clay/20">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-serif font-extrabold text-sm sm:text-base text-natural-espresso flex items-center gap-2">
                          <span>สรุปสถานะออเดอร์เบอร์โทรศัพท์:</span>
                          <span className="font-mono bg-natural-espresso text-natural-cream px-2 py-0.5 rounded text-xs font-bold">{cPhone || 'ไม่ระบุเบอร์'}</span>
                        </h4>
                        <p className="text-[11px] text-natural-espresso/60">
                          พบคลิปออเดอร์สั่งตัดรวมทั้งหมด <strong className="text-natural-clay font-bold">{totalOrders} ออเดอร์</strong> (คลิกที่ปุ่มสถานะด้านล่างเพื่อกรองดูเฉพาะชุดในสถานะนั้นๆ ได้ค่ะ)
                        </p>
                      </div>
                    </div>
                    {selectedStatusFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setSelectedStatusFilter('ALL')}
                        className="text-[11px] bg-natural-clay text-white font-bold px-3 py-1.5 rounded-xl hover:bg-natural-clay/90 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        <span>ล้างตัวกรอง (ดูทุกสถานะ)</span>
                      </button>
                    )}
                  </div>

                  {/* STATUS GRID SUMMARY */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
                    {[
                      { status: OrderStatus.RECEIVED, label: 'รับออเดอร์', icon: '📥', bg: 'bg-amber-500/10 border-amber-300 text-amber-900' },
                      { status: OrderStatus.DESIGNING, label: 'เตรียมแบบ/ผ้า', icon: '🎨', bg: 'bg-orange-500/10 border-orange-300 text-orange-900' },
                      { status: OrderStatus.CUTTING, label: 'ขึ้นแบบตัดผ้า', icon: '✂️', bg: 'bg-yellow-500/10 border-yellow-300 text-yellow-900' },
                      { status: OrderStatus.SEWING, label: 'เย็บประกอบ', icon: '🪡', bg: 'bg-blue-500/10 border-blue-300 text-blue-900' },
                      { status: OrderStatus.FITTING, label: 'ฟิตติ้งชุด', icon: '📐', bg: 'bg-purple-500/10 border-purple-300 text-purple-900' },
                      { status: OrderStatus.READY, label: 'พร้อมส่งมอบ', icon: '✨', bg: 'bg-emerald-500/15 border-emerald-400 text-emerald-950 font-extrabold ring-1 ring-emerald-400/40' },
                      { status: OrderStatus.COMPLETED, label: 'ส่งมอบสำเร็จ', icon: '🏁', bg: 'bg-gray-100 border-gray-300 text-gray-700' }
                    ].map((item) => {
                      const count = statusBreakdown[item.status as OrderStatus] || 0;
                      const isSelected = selectedStatusFilter === item.status;
                      return (
                        <button
                          key={item.status}
                          type="button"
                          onClick={() => {
                            setSelectedStatusFilter(isSelected ? 'ALL' : item.status);
                            setActiveHistoryTab('all');
                          }}
                          className={`p-2.5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'ring-2 ring-natural-clay shadow-sm scale-102 bg-white'
                              : count > 0
                              ? `${item.bg} hover:shadow-2xs`
                              : 'bg-stone-50 text-stone-400 border-stone-200/60 opacity-60'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full mb-1">
                            <span className="text-base">{item.icon}</span>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${count > 0 ? 'bg-white/90 text-natural-espresso shadow-3xs' : 'bg-stone-200/50 text-stone-400'}`}>
                              {count}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold line-clamp-1">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* LINE ACTION BAR FOR SENDING SUMMARY VIA LINE */}
                  <div className="pt-3 border-t border-natural-sand/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white/70 p-3 rounded-2xl border border-natural-wheat/60">
                    <div className="flex items-center space-x-2 text-xs font-bold text-natural-espresso">
                      <div className="w-7 h-7 rounded-lg bg-[#06C755] text-white flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
                        💬
                      </div>
                      <div>
                        <span className="block font-bold text-emerald-900">แชร์รายงานสรุปเข้า LINE:</span>
                        <span className="block text-[10px] text-natural-espresso/60 font-normal">แชร์สถานะออเดอร์ทั้งหมดของเบอร์ {cPhone} พร้อมลิงก์ติดตามแบบ Real-time 100%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const portalUrl = `${window.location.origin}${window.location.pathname}?tab=customer&search=${encodeURIComponent(cPhone || '')}&mode=customer`;
                          const activeStatuses = Array.from(new Set(searchedOrders.map(o => o.status))) as OrderStatus[];
                          const statusLines = activeStatuses.map(st => {
                            const count = searchedOrders.filter(o => o.status === st).length;
                            const label = STATUS_MAP[st]?.label || st;
                            return `• 📌 ${label}: ${count} ชุด`;
                          });

                          const summaryText = [
                            `📲 สรุปสถานะงานสั่งตัด - NUNUH Atelier`,
                            `----------------------------------`,
                            `👤 คุณ: ${cName}`,
                            `📱 เบอร์โทรศัพท์: ${cPhone || 'ไม่ระบุ'}`,
                            `📦 จำนวนออเดอร์สั่งตัดรวม: ${totalOrders} รายการ`,
                            ``,
                            `📊 สรุปสถานะล่าสุด:`,
                            ...statusLines,
                            ``,
                            `🔍 ดูรูปภาพและติดตามสถานะล่าสุดออนไลน์ได้ที่:`,
                            portalUrl
                          ].filter(Boolean).join('\n');

                          const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(summaryText)}`;
                          window.open(lineUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="flex-1 sm:flex-none text-xs bg-[#06C755] hover:bg-[#05b34c] text-white font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>แชร์เข้า LINE</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const portalUrl = `${window.location.origin}${window.location.pathname}?tab=customer&search=${encodeURIComponent(cPhone || '')}&mode=customer`;
                          const activeStatuses = Array.from(new Set(searchedOrders.map(o => o.status))) as OrderStatus[];
                          const statusLines = activeStatuses.map(st => {
                            const count = searchedOrders.filter(o => o.status === st).length;
                            const label = STATUS_MAP[st]?.label || st;
                            return `• 📌 ${label}: ${count} ชุด`;
                          });

                          const summaryText = [
                            `📲 สรุปสถานะงานสั่งตัด - NUNUH Atelier`,
                            `----------------------------------`,
                            `👤 คุณ: ${cName}`,
                            `📱 เบอร์โทรศัพท์: ${cPhone || 'ไม่ระบุ'}`,
                            `📦 จำนวนออเดอร์สั่งตัดรวม: ${totalOrders} รายการ`,
                            ``,
                            `📊 สรุปสถานะล่าสุด:`,
                            ...statusLines,
                            ``,
                            `🔍 ดูรูปภาพและติดตามสถานะล่าสุดออนไลน์ได้ที่:`,
                            portalUrl
                          ].filter(Boolean).join('\n');

                          try {
                            await navigator.clipboard.writeText(summaryText);
                          } catch {
                            const ta = document.createElement('textarea');
                            ta.value = summaryText;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                          }
                          setCopiedLineSummary(true);
                          setTimeout(() => setCopiedLineSummary(false), 3000);
                        }}
                        className="flex-1 sm:flex-none text-xs bg-white hover:bg-stone-50 text-natural-espresso border border-natural-sand font-bold px-3.5 py-2 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {copiedLineSummary ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-natural-clay" />}
                        <span>{copiedLineSummary ? 'คัดลอกข้อความสำเร็จ!' : 'คัดลอกข้อความ LINE'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. TAB SELECTION FOR NEW VS OLD ORDERS */}
                <div className="border-b border-natural-sand pb-1 flex justify-between items-center">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setActiveHistoryTab('all')}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        activeHistoryTab === 'all'
                          ? 'bg-natural-espresso text-natural-cream shadow-xs'
                          : 'bg-natural-sand/40 hover:bg-natural-sand text-natural-espresso/70'
                      }`}
                    >
                      🗂️ ออเดอร์ทั้งหมด ({totalOrders})
                    </button>
                    <button
                      onClick={() => setActiveHistoryTab('active')}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        activeHistoryTab === 'active'
                          ? 'bg-natural-clay text-white shadow-xs'
                          : 'bg-natural-sand/40 hover:bg-natural-sand text-natural-espresso/70'
                      }`}
                    >
                      🛍️ กำลังตัดเย็บชุดใหม่ ({activeOrdersList.length})
                    </button>
                    <button
                      onClick={() => setActiveHistoryTab('completed')}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        activeHistoryTab === 'completed'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-natural-sand/40 hover:bg-natural-sand text-natural-espresso/70'
                      }`}
                    >
                      📜 ประวัติชุดเก่าสำเร็จแล้ว ({pastOrdersList.length})
                    </button>
                  </div>
                  
                  <span className="text-[11px] text-natural-espresso/45 font-bold italic font-serif hidden sm:inline">
                    NUNUH Customer History Journal
                  </span>
                </div>

                {/* 3. CONDITIONAL RENDERED LIST */}
                <div className="space-y-6">
                  {displayedOrders.length === 0 ? (
                    <div className="bg-natural-sand/10 border border-dashed border-natural-wheat rounded-2xl py-8 px-4 text-center text-natural-espresso/50">
                      <History className="h-8 w-8 mx-auto text-natural-espresso/25 mb-2" />
                      <p className="font-semibold text-xs">ไม่มีรายการออเดอร์ในหมวดหมู่นี้</p>
                      <p className="text-[10px] mt-0.5">ลองเลือกดูหมวดหมู่อื่นเพื่อตรวจสอบความถูกต้องค่ะ</p>
                    </div>
                  ) : (
                    displayedOrders.map((order) => {
                      const isCompleted = order.status === OrderStatus.COMPLETED;
                      const progress = getStatusProgress(order.status);
                      const currentStatus = STATUS_MAP[order.status];
                      const unpaid = Math.max(0, order.price - order.deposit - (order.discount || 0) - (order.finalPaymentAmount || 0));

                      {/* RENDERING ACTIVE ORDER (NEW/IN PROGRESS) */}
                      if (!isCompleted) {
                        return (
                          <div 
                            key={order.id} 
                            className="p-5 sm:p-7 rounded-2xl border border-natural-wheat bg-white space-y-6 shadow-sm relative overflow-hidden"
                          >
                            {/* Status accent strip */}
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-natural-clay"></div>

                            {/* Order Head */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-natural-sand pb-4">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-xs font-black bg-natural-espresso text-natural-cream px-2 py-0.5 rounded">
                                    {order.orderNumber}
                                  </span>
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${currentStatus.colorClass}`}>
                                    {currentStatus.label}
                                  </span>
                                  {order.sku && (
                                    <span className="bg-natural-clay/10 text-natural-clay text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border border-natural-clay/25 uppercase">
                                      SKU: {order.sku}
                                    </span>
                                  )}
                                  {order.isMatchingSet && (
                                    <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                                      ✨ งานเข้าชุด {order.idhNumber ? `(IDH: ${order.idhNumber})` : ''}
                                    </span>
                                  )}
                                </div>
                                <h5 className="font-serif font-bold text-base text-natural-espresso mt-1.5">
                                  ชุดใหม่: {order.dressType} — สี {order.fabricColor}
                                </h5>
                              </div>

                              <div className="text-left sm:text-right">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-natural-espresso/40">กำหนดจัดส่ง/ส่งมอบ</p>
                                <p className="text-sm font-bold text-natural-espresso">
                                  {new Date(order.deliveryDate).toLocaleDateString('th-TH', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  })}
                                </p>
                              </div>
                            </div>

                            {/* Stepper Pipeline */}
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-natural-espresso/70 flex items-center">
                                  <Clock className="h-3.5 w-3.5 mr-1.5 text-natural-clay" /> 
                                  ความคืบหน้าการจัดทำแบบชุดของท่าน:
                                </span>
                                <span className="text-xs font-mono font-bold text-natural-clay">
                                  {progress}%
                                </span>
                              </div>

                              {/* Progress bar background */}
                              <div className="w-full bg-natural-sand h-3.5 rounded-full overflow-hidden border border-natural-wheat/50 p-0.5">
                                <div 
                                  className="bg-natural-clay h-full rounded-full transition-all duration-1000 ease-out"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>

                              {/* Current Step Highlight Card */}
                              <div className="bg-natural-sand/20 border border-natural-wheat/80 p-4 rounded-xl space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-lg bg-natural-espresso text-natural-cream flex items-center justify-center font-bold text-xs">
                                      {Math.max(1, PRODUCTION_PIPELINE_STEPS.indexOf(order.status as OrderStatus) + 1)}
                                    </span>
                                    <div>
                                      <p className="text-[10px] font-bold text-natural-espresso/60 uppercase tracking-wider">
                                        สถานะปัจจุบัน
                                      </p>
                                      <p className="text-sm font-extrabold text-natural-espresso">
                                        {STATUS_MAP[order.status]?.label || order.status}
                                      </p>
                                    </div>
                                  </div>

                                  <span className="text-[11px] font-semibold text-natural-clay bg-white/80 px-2.5 py-1 rounded-lg border border-natural-wheat/80 shadow-3xs flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-natural-clay" /> วันที่สถานะล่าสุด: {order.statusDate || order.orderDate}
                                  </span>
                                </div>

                                <div className="flex items-start space-x-2.5 bg-white/70 p-3 rounded-lg border border-natural-wheat/50">
                                  <Info className="h-4 w-4 text-natural-clay flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-natural-espresso/80 leading-relaxed">
                                    {currentStatus.description}
                                  </p>
                                </div>
                              </div>

                              {/* Status History Logs for Customer */}
                              {order.statusHistory && order.statusHistory.length > 0 && (
                                <div className="bg-natural-sand/15 border border-natural-wheat/70 rounded-xl p-3.5 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-natural-espresso flex items-center gap-1.5">
                                      <History className="h-3.5 w-3.5 text-natural-clay" /> ไทม์ไลน์ประวัติการอัปเดตงาน (Production Progress Timeline)
                                    </p>
                                    <span className="text-[10px] text-natural-espresso/60 font-mono">
                                      รวม {getDaysDifference(order.orderDate, order.status === OrderStatus.COMPLETED ? (order.statusDate || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0])} วัน
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                    {order.statusHistory.map((h, hIdx) => {
                                      const isLast = hIdx === order.statusHistory!.length - 1;
                                      const todayStr = new Date().toISOString().split('T')[0];
                                      const nextDate = isLast
                                        ? (order.status === OrderStatus.COMPLETED ? (order.statusDate || h.date) : todayStr)
                                        : order.statusHistory![hIdx + 1].date;
                                      const daysInStage = getDaysDifference(h.date, nextDate);

                                      return (
                                        <div key={hIdx} className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] bg-white/90 p-2.5 rounded-lg border border-natural-wheat/40 gap-1.5">
                                          <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-natural-espresso">
                                                {STATUS_MAP[h.status as OrderStatus]?.label || h.status}
                                              </span>
                                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                isLast 
                                                  ? (order.status === OrderStatus.COMPLETED ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')
                                                  : 'bg-natural-sand/50 text-natural-espresso/70'
                                              }`}>
                                                {isLast 
                                                  ? (order.status === OrderStatus.COMPLETED ? `เสร็จสิ้น (${daysInStage} วัน)` : `ปัจจุบัน (${daysInStage} วัน)`)
                                                  : `${daysInStage} วัน`}
                                              </span>
                                            </div>
                                            {h.note && (
                                              <p className="text-[10px] text-natural-espresso/70 mt-0.5">{h.note}</p>
                                            )}
                                          </div>
                                          <span className="text-[10px] font-mono text-natural-espresso/60 shrink-0">
                                            📅 {h.date} {isLast ? '' : `➔ ${order.statusHistory![hIdx + 1].date}`}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Technical details Grid (Specs, Measurements, Balances) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                              
                              {/* Sub-Card: Dress Details */}
                              <div className="bg-white p-4 rounded-xl border border-natural-wheat space-y-3 shadow-3xs">
                                <h6 className="font-serif font-bold text-xs text-natural-espresso border-b border-natural-sand pb-1.5 flex items-center">
                                  <Scissors className="h-3.5 w-3.5 mr-1.5 text-natural-clay" /> รายละเอียดชิ้นงาน
                                </h6>
                                <div className="space-y-1.5 text-xs text-natural-espresso/80">
                                  <p><span className="font-semibold text-natural-espresso/50">ประเภทชุด:</span> {order.dressType}</p>
                                  <p><span className="font-semibold text-natural-espresso/50">ชนิดเนื้อผ้า:</span> {order.fabricType}</p>
                                  <p><span className="font-semibold text-natural-espresso/50">สีที่เลือกตัด:</span> {order.fabricColor}</p>
                                  {order.customDesign && (
                                    <p className="bg-natural-sand/35 p-1.5 rounded text-[11px] font-medium border border-natural-wheat/40 mt-1 text-natural-espresso/90">
                                      📐 {order.customDesign.silhouette} | {order.customDesign.neckline} | {order.customDesign.sleeves}
                                    </p>
                                  )}
                                  {(() => {
                                    const resolvedImg = order.customImage || (order.selectedDesignId ? catalogue.find(c => c.id === order.selectedDesignId)?.image : null);
                                    const hasImages = resolvedImg || order.customImage2;
                                    if (!hasImages) return null;

                                    return (
                                      <div className="mt-2.5 pt-2.5 border-t border-natural-sand/60">
                                        <p className="text-[10px] text-natural-espresso/45 font-bold mb-1 uppercase tracking-wider">รูปภาพแบบชุดอ้างอิง</p>
                                        <div className={`grid ${resolvedImg && order.customImage2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                          {resolvedImg && (
                                            <div className="relative group rounded-lg overflow-hidden border border-natural-wheat h-28 bg-natural-sand/5 flex items-center justify-center">
                                              <img 
                                                src={resolvedImg} 
                                                alt="Design Reference 1" 
                                                className="h-full object-contain cursor-zoom-in"
                                                referrerPolicy="no-referrer"
                                                onClick={() => {
                                                  const imgWindow = window.open();
                                                  if (imgWindow) {
                                                    imgWindow.document.write(`<img src="${resolvedImg}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                                  }
                                                }}
                                              />
                                              {order.customImage && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteOrderPhoto(order.id, 'customImage')}
                                                  className="absolute top-1 right-1 p-1 bg-red-500/90 hover:bg-red-600 text-white rounded-full transition-all cursor-pointer shadow-sm z-10"
                                                  title="ลบรูปภาพแบบชุดช่องที่ 1"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                          {order.customImage2 && (
                                            <div className="relative group rounded-lg overflow-hidden border border-natural-wheat h-28 bg-natural-sand/5 flex items-center justify-center">
                                              <img 
                                                src={order.customImage2} 
                                                alt="Design Reference 2" 
                                                className="h-full object-contain cursor-zoom-in"
                                                referrerPolicy="no-referrer"
                                                onClick={() => {
                                                  const imgWindow = window.open();
                                                  if (imgWindow) {
                                                    imgWindow.document.write(`<img src="${order.customImage2}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                                  }
                                                }}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteOrderPhoto(order.id, 'customImage2')}
                                                className="absolute top-1 right-1 p-1 bg-red-500/90 hover:bg-red-600 text-white rounded-full transition-all cursor-pointer shadow-sm z-10"
                                                title="ลบรูปภาพแบบชุดช่องที่ 2"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  {order.slipImage && (
                                    <div className="mt-2.5 pt-2.5 border-t border-natural-sand/60">
                                      <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] text-natural-espresso/45 font-bold uppercase tracking-wider">หลักฐานการชำระเงิน (สลิปโอนเงิน)</p>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteOrderPhoto(order.id, 'slipImage')}
                                          className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5 cursor-pointer"
                                          title="ลบรูปสลิปการชำระเงิน"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                          <span>ลบสลิป</span>
                                        </button>
                                      </div>
                                      <div className="relative group rounded-lg overflow-hidden border border-natural-wheat h-28 bg-natural-sand/5 flex items-center justify-center">
                                        <img 
                                          src={order.slipImage} 
                                          alt="Payment Slip" 
                                          className="h-full object-contain cursor-zoom-in"
                                          referrerPolicy="no-referrer"
                                          onClick={() => {
                                            const imgWindow = window.open();
                                            if (imgWindow) {
                                              imgWindow.document.write(`<img src="${order.slipImage}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                            }
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteOrderPhoto(order.id, 'slipImage')}
                                          className="absolute top-1 right-1 p-1 bg-red-500/90 hover:bg-red-600 text-white rounded-full transition-all cursor-pointer shadow-sm z-10"
                                          title="ลบสลิปโอนเงิน"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                               {/* Sub-Card: Measurements or IDH Notice */}
                               {(() => {
                                 const isIDHOrder = order.customerCategory === 'IDH' || 
                                   (order.dressType && order.dressType.toUpperCase().includes('IDH')) || 
                                   Boolean(order.idhNumber && order.idhNumber.trim().length > 0) || 
                                   (order.dressType && order.dressType.includes('ผ้าคลุม'));

                                 if (isIDHOrder) {
                                   return (
                                     <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/60 shadow-3xs space-y-2 flex flex-col justify-center">
                                       <div className="flex items-center space-x-2 text-amber-950">
                                         <span className="text-xl">🧕</span>
                                         <div>
                                           <h6 className="font-serif font-bold text-xs text-amber-950">งานสั่งตัดประเภท IDH (ผ้าคลุม)</h6>
                                           <p className="text-[10px] text-amber-900/80 mt-0.5">สินค้าประเภท IDH เป็นผ้าคลุมสั่งสำเร็จ ไม่มีตารางวัดตัวค่ะ</p>
                                         </div>
                                       </div>
                                       {order.measurements.standardSize && (
                                         <div className="mt-1 pt-1.5 border-t border-amber-200/40 flex items-center gap-1.5 text-xs">
                                           <span className="text-[10px] text-amber-900/80 font-bold">ไซส์ผ้าคลุม:</span>
                                           <span className="bg-amber-800 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                                             {order.measurements.standardSize}
                                           </span>
                                         </div>
                                       )}
                                     </div>
                                   );
                                 }

                                 return (
                                   <div className="bg-white p-4 rounded-xl border border-natural-wheat space-y-3 shadow-3xs">
                                     <h6 className="font-serif font-bold text-xs text-natural-espresso border-b border-natural-sand pb-1.5 flex items-center">
                                       <Ruler className="h-3.5 w-3.5 mr-1.5 text-natural-clay" /> สัดส่วนเฉพาะออเดอร์นี้
                                     </h6>
                                     <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                                       <div className="bg-natural-cream/35 p-1 rounded">
                                         <p className="text-[9px] text-natural-espresso/45 font-bold">อก</p>
                                         <p className="font-mono font-bold text-natural-espresso">{order.measurements.chest} ซม.</p>
                                       </div>
                                       <div className="bg-natural-cream/35 p-1 rounded">
                                         <p className="text-[9px] text-natural-espresso/45 font-bold">เอว</p>
                                         <p className="font-mono font-bold text-natural-espresso">{order.measurements.waist} ซม.</p>
                                       </div>
                                       <div className="bg-natural-cream/35 p-1 rounded">
                                         <p className="text-[9px] text-natural-espresso/45 font-bold">สะโพก</p>
                                         <p className="font-mono font-bold text-natural-espresso">{order.measurements.hips} ซม.</p>
                                       </div>
                                       <div className="bg-natural-cream/35 p-1 rounded">
                                         <p className="text-[9px] text-natural-espresso/45 font-bold">ไหล่</p>
                                         <p className="font-mono font-bold text-natural-espresso">{order.measurements.shoulder} ซม.</p>
                                       </div>
                                       <div className="bg-natural-cream/35 p-1 rounded">
                                         <p className="text-[9px] text-natural-espresso/45 font-bold">ความยาว</p>
                                         <p className="font-mono font-bold text-natural-espresso">{order.measurements.length} ซม.</p>
                                       </div>
                                       <div className="bg-natural-cream/35 p-1 rounded">
                                         <p className="text-[9px] text-natural-espresso/45 font-bold">ส่วนสูง</p>
                                         <p className="font-mono font-bold text-natural-espresso">{order.measurements.height} ซม.</p>
                                       </div>
                                       {order.measurements.frontChest && order.measurements.frontChest !== '-' && (
                                         <div className="bg-natural-cream/35 p-1 rounded">
                                           <p className="text-[9px] text-natural-espresso/45 font-bold">บ่าหน้า</p>
                                           <p className="font-mono font-bold text-natural-espresso">{order.measurements.frontChest} ซม.</p>
                                         </div>
                                       )}
                                       {order.measurements.backChest && order.measurements.backChest !== '-' && (
                                         <div className="bg-natural-cream/35 p-1 rounded">
                                           <p className="text-[9px] text-natural-espresso/45 font-bold">บ่าหลัง</p>
                                           <p className="font-mono font-bold text-natural-espresso">{order.measurements.backChest} ซม.</p>
                                         </div>
                                       )}
                                       {order.measurements.frontLength && order.measurements.frontLength !== '-' && (
                                         <div className="bg-natural-cream/35 p-1 rounded">
                                           <p className="text-[9px] text-natural-espresso/45 font-bold">ยาวหน้า</p>
                                           <p className="font-mono font-bold text-natural-espresso">{order.measurements.frontLength} ซม.</p>
                                         </div>
                                       )}
                                       {order.measurements.backLength && order.measurements.backLength !== '-' && (
                                         <div className="bg-natural-cream/35 p-1 rounded">
                                           <p className="text-[9px] text-natural-espresso/45 font-bold">ยาวหลัง</p>
                                           <p className="font-mono font-bold text-natural-espresso">{order.measurements.backLength} ซม.</p>
                                         </div>
                                       )}
                                       {order.measurements.wrist && order.measurements.wrist !== '-' && (
                                         <div className="bg-natural-cream/35 p-1 rounded">
                                           <p className="text-[9px] text-natural-espresso/45 font-bold">ข้อมือ</p>
                                           <p className="font-mono font-bold text-natural-espresso">{order.measurements.wrist} ซม.</p>
                                         </div>
                                       )}
                                     </div>
                                   </div>
                                 );
                               })()}

                              {/* Sub-Card: Payments */}
                              <div className="bg-white p-4 rounded-xl border border-natural-wheat space-y-3 flex flex-col justify-between shadow-3xs">
                                <div className="space-y-1">
                                  <h6 className="font-serif font-bold text-xs text-natural-espresso border-b border-natural-sand pb-1.5 flex items-center">
                                    <DollarSign className="h-3.5 w-3.5 mr-1 text-natural-clay" /> การเงิน & สัญญาจองคิว
                                  </h6>
                                  <div className="flex justify-between items-center text-xs pt-1">
                                    <span className="text-natural-espresso/50 font-medium">ราคาสุทธิ:</span>
                                    <span className="font-bold text-natural-espresso">{order.price.toLocaleString()} ฿</span>
                                  </div>
                                  {!!order.discount && (
                                    <div className="flex justify-between items-center text-xs text-amber-700">
                                      <span className="font-medium">ส่วนลด:</span>
                                      <span className="font-bold">-{order.discount.toLocaleString()} ฿</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-natural-espresso/50 font-medium">มัดจำแล้ว:</span>
                                    <span className="font-bold text-natural-sage">{order.deposit.toLocaleString()} ฿</span>
                                  </div>
                                  {!!order.finalPaymentAmount && (
                                    <div className="flex justify-between items-center text-xs text-emerald-800">
                                      <span className="font-medium">ชำระส่วนต่างเพิ่ม:</span>
                                      <span className="font-bold">
                                        -{order.finalPaymentAmount.toLocaleString()} ฿
                                        {order.finalPaymentDate ? ` (${order.finalPaymentDate})` : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-natural-sand flex justify-between items-center">
                                  <span className="text-[10px] text-natural-espresso/40 font-bold uppercase">ยอดคงค้างชำระ</span>
                                  <span className={`text-sm font-black ${unpaid > 0 ? 'text-natural-clay' : 'text-natural-sage'}`}>
                                    {unpaid > 0 ? `${unpaid.toLocaleString()} ฿` : 'ชำระครบถ้วนแล้ว ✓'}
                                  </span>
                                </div>
                              </div>

                            </div>

                            {/* Support note & contact button */}
                            <div className="pt-4 border-t border-natural-sand flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                              <p className="text-natural-espresso/50 flex items-center italic">
                                <Info className="h-3.5 w-3.5 mr-1" /> หากพบจุดคลาดเคลื่อนของสัดส่วน กรุณาติดต่อสตูดิโอเพื่อปรับแต่งโครงสร้างก่อนช่างลงกรรไกรตัดผ้าค่ะ
                              </p>
                              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                                {lineOaId && (
                                  <a 
                                    href={getLineOaHref(lineOaId)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>แชท LINE {lineOaId} 💬</span>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setPrintingOrder(order)}
                                  className="bg-natural-clay hover:bg-natural-clay-dark text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  <span>พิมพ์ใบออเดอร์เฉพาะจุด 🖨️</span>
                                </button>
                                <a 
                                  href={`tel:${boutiquePhone}`}
                                  className="bg-natural-sand hover:bg-natural-wheat text-natural-espresso font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer border border-natural-wheat/30"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>โทรติดต่อห้องเสื้อ</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      {/* RENDERING PAST ORDER (COMPLETED/OLD) */}
                      return (
                        <div 
                          key={order.id} 
                          className="p-5 sm:p-6 rounded-2xl border border-emerald-200/60 bg-emerald-50/10 hover:bg-emerald-50/25 transition-colors space-y-4 shadow-2xs relative overflow-hidden"
                        >
                          {/* Completed accent strip */}
                          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-600"></div>

                          {/* Completed Header */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-natural-sand pb-3">
                            <div className="flex items-center space-x-2.5">
                              <span className="font-mono text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded shadow-3xs">
                                {order.orderNumber}
                              </span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> ส่งมอบเรียบร้อยสำเร็จ ✓
                              </span>
                              {order.sku && (
                                <span className="text-natural-espresso/40 font-mono text-[10px] font-bold">
                                  SKU: {order.sku}
                                </span>
                              )}
                              {order.isMatchingSet && (
                                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                                  ✨ งานเข้าชุด {order.idhNumber ? `(IDH: ${order.idhNumber})` : ''}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] font-medium text-natural-espresso/50">
                              ส่งมอบเมื่อ: {new Date(order.deliveryDate).toLocaleDateString('th-TH', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                          </div>

                          {/* Info Body */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            {/* Portrait Thumbnail */}
                            <div className="flex items-center space-x-3.5 md:col-span-2">
                              <div className="w-14 h-14 bg-natural-sand rounded-xl overflow-hidden border border-natural-wheat flex-shrink-0">
                                <img 
                                  src={order.customImage || (order.selectedDesignId ? catalogue.find(c => c.id === order.selectedDesignId)?.image : null) || "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&q=80&w=200"} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="space-y-0.5 text-xs">
                                <p className="font-serif font-extrabold text-natural-espresso">{order.dressType}</p>
                                <p className="text-natural-espresso/75 font-medium">ชนิดผ้า: {order.fabricType} | สี: {order.fabricColor}</p>
                                <p className="text-[10px] text-natural-espresso/45">วันที่สั่งจอง: {new Date(order.orderDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                              </div>
                            </div>

                            {/* Standard specs or IDH badge */}
                            {order.customerCategory === 'IDH' || order.dressType?.toUpperCase().includes('IDH') || order.idhNumber || order.dressType?.includes('ผ้าคลุม') ? (
                              <div className="text-xs bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/50 flex items-center justify-between text-amber-950 font-bold">
                                <span className="flex items-center gap-1.5 text-[11px]">
                                  <span>🧕</span>
                                  <span>ผ้าคลุม (IDH) — ไม่มีวัดตัว</span>
                                </span>
                                {order.measurements.standardSize && (
                                  <span className="text-[10px] bg-amber-800 text-white px-2 py-0.5 rounded-full font-bold">
                                    ไซส์ {order.measurements.standardSize}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs space-y-1 bg-natural-sand/20 p-2.5 rounded-xl border border-natural-wheat/40">
                                <p className="text-[9px] text-natural-espresso/45 font-bold uppercase tracking-wider">ขนาดชุดที่ตัดสำเร็จ</p>
                                <div className="font-mono font-bold text-natural-espresso/85 grid grid-cols-3 gap-1 text-center text-[10px]">
                                  <div>อก: {order.measurements.chest} ซม.</div>
                                  <div>เอว: {order.measurements.waist} ซม.</div>
                                  <div>สะโพก: {order.measurements.hips} ซม.</div>
                                  {order.measurements.frontChest && order.measurements.frontChest !== '-' && (
                                    <div>บ่าหน้า: {order.measurements.frontChest} ซม.</div>
                                  )}
                                  {order.measurements.backChest && order.measurements.backChest !== '-' && (
                                    <div>บ่าหลัง: {order.measurements.backChest} ซม.</div>
                                  )}
                                  {order.measurements.frontLength && order.measurements.frontLength !== '-' && (
                                    <div>ยาวหน้า: {order.measurements.frontLength} ซม.</div>
                                  )}
                                  {order.measurements.backLength && order.measurements.backLength !== '-' && (
                                    <div>ยาวหลัง: {order.measurements.backLength} ซม.</div>
                                  )}
                                  {order.measurements.wrist && order.measurements.wrist !== '-' && (
                                    <div>ข้อมือ: {order.measurements.wrist} ซม.</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Mini financials */}
                            <div className="text-right text-xs">
                              <p className="text-[10px] text-natural-espresso/45 font-bold uppercase">ราคาชำระแล้ว (Paid)</p>
                              <p className="text-base font-serif font-black text-emerald-800">฿{(order.price - (order.discount || 0)).toLocaleString()}</p>
                              <p className="text-[10px] text-emerald-700/75 font-bold">ชำระเต็มจำนวนแล้ว ✓</p>
                            </div>
                          </div>

                          {/* Customer Review Section */}
                          {(() => {
                            const existingReview = reviews?.find(r => r.orderId === order.id || r.orderNumber === order.orderNumber);
                            return (
                              <div className="space-y-3.5 pt-2 border-t border-natural-sand/50">
                                {/* Existing Review Display */}
                                {existingReview && (
                                  <div className="bg-white/80 p-4 rounded-xl border border-emerald-200/50 space-y-3 shadow-3xs animate-fade-in">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                        <span>คุณได้ประเมินความพึงพอใจแล้ว เรียบร้อยค่ะ</span>
                                      </span>
                                      <span className="text-[10px] text-natural-espresso/45">
                                        {new Date(existingReview.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2.5 bg-emerald-50/20 p-2 rounded-lg border border-emerald-100/40 text-[10px] font-bold text-natural-espresso/80 text-center">
                                      <div>ทรงชุด: {existingReview.ratingDress || existingReview.rating} ⭐</div>
                                      <div>คุณภาพผ้า: {existingReview.ratingFabric || existingReview.rating} ⭐</div>
                                      <div>การบริการ: {existingReview.ratingService || existingReview.rating} ⭐</div>
                                    </div>

                                    <div className="text-xs text-natural-espresso/80 font-medium bg-stone-50 p-2.5 rounded-lg border border-stone-200/40 italic">
                                      "{existingReview.comment}"
                                    </div>

                                    {existingReview.reviewImage && (
                                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-natural-sand/60">
                                        <img 
                                          src={existingReview.reviewImage} 
                                          alt="Review attached" 
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    )}

                                    {existingReview.tailorNote && (
                                      <div className="bg-amber-50/40 border border-amber-200/40 p-2.5 rounded-lg text-[10px] text-natural-espresso/85 leading-relaxed">
                                        <span className="font-bold text-amber-800">📌 บันทึกคำแนะนำส่งตรงถึงช่างเย็บ:</span> {existingReview.tailorNote}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Write Review Button */}
                                {!existingReview && activeReviewOrderId !== order.id && (
                                  <div className="flex justify-center py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveReviewOrderId(order.id);
                                        setReviewRatingDress(5);
                                        setReviewRatingFabric(5);
                                        setReviewRatingService(5);
                                        setReviewComment('');
                                        setReviewImage(null);
                                      }}
                                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-natural-clay to-natural-clay-dark hover:from-natural-espresso hover:to-natural-espresso text-white rounded-xl text-xs font-black shadow-3xs transition-all flex items-center justify-center space-x-2 cursor-pointer animate-pulse hover:animate-none"
                                    >
                                      <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                                      <span>เขียนรีวิวความพึงพอใจสำหรับชุดนี้ ⭐</span>
                                    </button>
                                  </div>
                                )}

                                {/* Write Review Form */}
                                {!existingReview && activeReviewOrderId === order.id && (
                                  <div className="bg-white p-5 rounded-2xl border border-natural-wheat shadow-xs space-y-4 animate-fade-in">
                                    <div className="flex justify-between items-center border-b border-natural-sand pb-2">
                                      <h5 className="font-serif font-extrabold text-xs text-natural-espresso flex items-center gap-1.5">
                                        <Star className="h-4 w-4 text-natural-ochre fill-natural-ochre" />
                                        <span>แบบประเมินความพึงพอใจ — ออเดอร์ {order.orderNumber}</span>
                                      </h5>
                                      <button
                                        type="button"
                                        onClick={() => setActiveReviewOrderId(null)}
                                        className="text-natural-espresso/40 hover:text-natural-espresso p-1 rounded-lg hover:bg-stone-100 cursor-pointer"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>

                                    {/* Multi-criteria Star ratings */}
                                    <div className="space-y-3 bg-stone-50/50 p-4 rounded-xl border border-stone-200/40">
                                      {/* Criterion 1: Dress silhouette / Fit */}
                                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                        <span className="text-xs font-bold text-natural-espresso/85">1. ความพึงพอใจในทรงชุด สัดส่วนสวมใส่ และแพทเทิร์น</span>
                                        <div className="flex items-center space-x-1 shrink-0">
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                              key={star}
                                              type="button"
                                              onClick={() => setReviewRatingDress(star)}
                                              className="p-0.5 focus:outline-none cursor-pointer"
                                            >
                                              <Star 
                                                className={`h-5 w-5 transition-all ${
                                                  star <= reviewRatingDress 
                                                    ? 'text-amber-400 fill-amber-400 scale-110' 
                                                    : 'text-stone-300 hover:text-amber-200'
                                                }`}
                                              />
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Criterion 2: Fabric Quality */}
                                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-t border-stone-200/30 pt-2.5">
                                        <span className="text-xs font-bold text-natural-espresso/85">2. คุณภาพของชนิดผ้า เนื้อผ้าสัมผัส และสีสันตรงใจ</span>
                                        <div className="flex items-center space-x-1 shrink-0">
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                              key={star}
                                              type="button"
                                              onClick={() => setReviewRatingFabric(star)}
                                              className="p-0.5 focus:outline-none cursor-pointer"
                                            >
                                              <Star 
                                                className={`h-5 w-5 transition-all ${
                                                  star <= reviewRatingFabric 
                                                    ? 'text-amber-400 fill-amber-400 scale-110' 
                                                    : 'text-stone-300 hover:text-amber-200'
                                                }`}
                                              />
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Criterion 3: Staff Service */}
                                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-t border-stone-200/30 pt-2.5">
                                        <span className="text-xs font-bold text-natural-espresso/85">3. การบริการ คำแนะนำ และความใส่ใจดูแลของดีไซเนอร์</span>
                                        <div className="flex items-center space-x-1 shrink-0">
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                              key={star}
                                              type="button"
                                              onClick={() => setReviewRatingService(star)}
                                              className="p-0.5 focus:outline-none cursor-pointer"
                                            >
                                              <Star 
                                                className={`h-5 w-5 transition-all ${
                                                  star <= reviewRatingService 
                                                    ? 'text-amber-400 fill-amber-400 scale-110' 
                                                    : 'text-stone-300 hover:text-amber-200'
                                                }`}
                                              />
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Comment Field */}
                                    <div className="space-y-1">
                                      <label className="block text-[10px] font-extrabold text-natural-espresso/60 uppercase tracking-wider">
                                        ความรู้สึกลูกค้า หรือคำติชมเมื่อลองสวมใส่จริง
                                      </label>
                                      <textarea
                                        rows={3}
                                        placeholder="เขียนระบุรายละเอียดความรู้สึกประทับใจ หรือข้อเสนอแนะเพิ่มเติมเพื่อให้ช่างเย็บปรับปรุงในอนาคต..."
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        className="w-full bg-stone-50 border border-natural-wheat rounded-xl px-3 py-2 text-xs text-natural-espresso placeholder:text-natural-espresso/40 focus:outline-none focus:ring-1 focus:ring-natural-clay focus:bg-white"
                                      />
                                    </div>

                                    {/* Photo Upload and Compressor */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-extrabold text-natural-espresso/60 uppercase tracking-wider">
                                          แนบรูปรีวิวขณะที่ใส่ชุดจริง (ไม่บังคับ)
                                        </label>
                                        <div className="relative">
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleReviewImageUpload}
                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                            disabled={isCompressingImage}
                                          />
                                          <div className="bg-stone-50 border border-dashed border-natural-wheat/80 rounded-xl p-3 text-center text-xs hover:bg-stone-100/50 transition-all flex items-center justify-center space-x-2">
                                            <Camera className="h-4 w-4 text-natural-espresso/40" />
                                            <span className="font-bold text-natural-espresso/70">
                                              {isCompressingImage ? 'กำลังเตรียมไฟล์รูปภาพ...' : '📷 อัปโหลดรูปสวมใส่จริง'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {reviewImage && (
                                        <div className="flex items-center space-x-3 bg-emerald-50/30 p-2.5 rounded-xl border border-emerald-100 relative">
                                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-natural-sand flex-shrink-0">
                                            <img src={reviewImage} alt="Uploaded review" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-emerald-800 truncate">อัปโหลดเรียบร้อย ✓</p>
                                            <p className="text-[9px] text-natural-espresso/40">ภาพถูกจัดสรรย่อขนาดพอดีคลัง</p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => setReviewImage(null)}
                                            className="absolute top-1 right-1 p-1 bg-stone-200 hover:bg-stone-300 rounded-full text-natural-espresso/60 cursor-pointer"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex justify-end space-x-2 pt-1 border-t border-stone-100">
                                      <button
                                        type="button"
                                        onClick={() => setActiveReviewOrderId(null)}
                                        className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-natural-espresso/85 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                      >
                                        ยกเลิก
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => submitCustomerReview(order)}
                                        disabled={isCompressingImage}
                                        className="px-5 py-2 bg-natural-clay hover:bg-natural-clay-dark text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1 shadow-2xs cursor-pointer disabled:opacity-55"
                                      >
                                        <span>ส่งประเมินรีวิวให้ทางร้าน 💖</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Print details button for specific historical order */}
                          <div className="pt-3 border-t border-natural-sand/50 flex justify-between items-center text-xs">
                            <span className="text-[10px] text-natural-espresso/40 flex items-center gap-1">
                              📖 บันทึกไว้ในคลังประวัติความพึงพอใจของห้องเสื้อ NUNUH
                            </span>
                            
                            <div className="flex items-center flex-wrap gap-2.5">
                              <a 
                                href={`https://line.me/R/msg/text/?${encodeURIComponent(
                                  `⚜️ ข้อมูลสถานะชุดสั่งตัด NUNUH Boutique ⚜️\nคุณ: ${order.customerName}\nรหัสออเดอร์: ${order.orderNumber}\nชุด: ${order.dressType}\nสถานะล่าสุด: ${STATUS_MAP[order.status]?.label || order.status}\nติดตามความคืบหน้าได้ที่: ${window.location.origin}/?tab=customer&search=${encodeURIComponent(order.customerPhone || order.orderNumber)}&mode=customer`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#05b34c] hover:text-[#04943f] font-bold flex items-center space-x-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200/60"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                <span>แชร์สถานะเข้า LINE 📲</span>
                              </a>
                              {lineOaId && (
                                <>
                                  <a 
                                    href={getLineOaHref(lineOaId)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#05b34c] hover:text-[#04943f] font-bold flex items-center space-x-1 cursor-pointer"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>คุยผ่าน LINE {lineOaId} 💬</span>
                                  </a>
                                  <span className="text-natural-sand">|</span>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => setPrintingOrder(order)}
                                className="text-natural-clay hover:text-natural-clay-dark font-bold flex items-center space-x-1 cursor-pointer"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>พิมพ์ใบเสร็จ & รายละเอียดชุดย้อนหลัง 🖨️</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {hasSearched && searchedOrders && searchedOrders.length === 0 && (
            <div className="bg-natural-sand/15 border border-dashed border-natural-wheat rounded-2xl py-12 px-6 text-center text-natural-espresso/60 animate-fade-in">
              <User className="h-10 w-10 mx-auto text-natural-espresso/25 mb-3" />
              <p className="font-bold text-natural-espresso text-base">ไม่พบคิวออเดอร์ตัดเย็บจากคำค้นหาของคุณ</p>
              <p className="text-xs mt-1.5 max-w-md mx-auto text-natural-espresso/70 leading-relaxed">
                ลองตรวจสอบตัวสะกดเบอร์โทรศัพท์มือถือ (เช่น 0801462230) หรือหมายเลขคิวออเดอร์ (เช่น NU-26001) อีกครั้ง หรือสอบถามข้อมูลเพิ่มเติมกับทางทีมงานดีไซเนอร์ NUNUH ค่ะ
              </p>
            </div>
          )}
        </div>
      </div>

      <PrintOrderModal 
        order={printingOrder} 
        isOpen={printingOrder !== null} 
        onClose={() => setPrintingOrder(null)} 
        boutiqueLogo={boutiqueLogo}
        boutiquePhone={boutiquePhone}
      />
    </div>
  );
}
