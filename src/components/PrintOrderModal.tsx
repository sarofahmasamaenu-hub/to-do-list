import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Order, STATUS_MAP, STANDARD_SIZE_CHART, CatalogueItem } from '../types';
import { INITIAL_CATALOGUE } from '../initialData';
import { Printer, X, Scissors, User, Phone, Calendar, DollarSign, Sparkles, Receipt, CheckSquare, Square } from 'lucide-react';

interface PrintOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintOrderModal({ order, isOpen, onClose }: PrintOrderModalProps) {
  if (!isOpen || !order) return null;

  const boutiquePhone = localStorage.getItem('nunuh_boutique_phone') || '086-555-1234';
  const boutiqueLogo = localStorage.getItem('nunuh_boutique_logo') || '';
  const [documentType, setDocumentType] = useState<'order' | 'receipt'>('order');
  const [receiptPaymentType, setReceiptPaymentType] = useState<'deposit' | 'full'>(
    order.deposit > 0 && Math.max(0, order.price - order.deposit - (order.discount || 0)) > 0 ? 'deposit' : 'full'
  );
  const [agreedTerms, setAgreedTerms] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
  });

  const toggleTerm = (index: number) => {
    setAgreedTerms(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const discountVal = order.discount || 0;
  const finalPayVal = order.finalPaymentAmount || 0;
  const unpaidAmount = Math.max(0, order.price - order.deposit - discountVal - finalPayVal);

  // ดึงรูปภาพสำหรับพิมพ์ (จากอัปโหลด หรือจากแคตตาล็อก หรือรูปสเก็ตช์นางแบบตั้งต้น)
  let displayImage = order.customImage;
  let displayImage2 = order.customImage2;
  let imageSourceLabel = "ภาพอ้างอิงดีไซน์สั่งตัด";

  if (!displayImage && order.selectedDesignId) {
    let catalogueList: CatalogueItem[] = [];
    try {
      const saved = localStorage.getItem('nunuh_catalogue');
      if (saved) {
        catalogueList = JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    
    if (!catalogueList || catalogueList.length === 0) {
      catalogueList = INITIAL_CATALOGUE;
    }
    
    const matchedItem = catalogueList.find(item => item.id === order.selectedDesignId);
    if (matchedItem) {
      displayImage = matchedItem.image;
      imageSourceLabel = `แบบชุด: ${matchedItem.name}`;
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const formattedOrderDate = new Date(order.orderDate).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedDeliveryDate = new Date(order.deliveryDate).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const measurementFields = [
    { key: 'chest', label: 'รอบอก', unit: 'ซม.' },
    { key: 'waist', label: 'รอบเอว', unit: 'ซม.' },
    { key: 'hips', label: 'สะโพก', unit: 'ซม.' },
    { key: 'shoulder', label: 'ไหล่กว้าง', unit: 'ซม.' },
    { key: 'sleeveLength', label: 'ความยาวแขน', unit: 'ซม.' },
    { key: 'armhole', label: 'รอบวงแขน', unit: 'ซม.' },
    { key: 'length', label: 'ความยาวชุด', unit: 'ซม.' },
    { key: 'neck', label: 'รอบคอ', unit: 'ซม.' },
    { key: 'height', label: 'ส่วนสูง', unit: 'ซม.' },
    { key: 'weight', label: 'น้ำหนัก', unit: 'กก.' },
    { key: 'frontChest', label: 'บ่าหน้า', unit: 'ซม.' },
    { key: 'backChest', label: 'บ่าหลัง', unit: 'ซม.' },
    { key: 'frontLength', label: 'ยาวหน้า', unit: 'ซม.' },
    { key: 'backLength', label: 'ยาวหลัง', unit: 'ซม.' },
    { key: 'wrist', label: 'ข้อมือ', unit: 'ซม.' },
  ];

  const isValueValid = (val: any) => {
    if (val === undefined || val === null) return false;
    const str = String(val).trim();
    return str !== '' && str !== '-' && str !== '0' && str !== '0.0' && str !== 'none';
  };

  const activeMeasurements = measurementFields.filter(field => 
    isValueValid(order.measurements[field.key as keyof typeof order.measurements])
  );

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-natural-espresso/45 backdrop-blur-sm flex items-center justify-center p-4 print-modal-portal">
      {/* Container Card */}
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-natural-wheat flex flex-col max-h-[90vh]">
        
        {/* Top Control Header - No Print */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-natural-wheat bg-natural-cream/30 gap-3 no-print">
          <div className="flex items-center space-x-2">
            <div className="h-9 w-9 rounded-lg bg-natural-clay/10 flex items-center justify-center text-natural-clay">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-natural-espresso text-sm">พิมพ์เอกสารทางการ</h4>
              <p className="text-[10px] text-natural-espresso/50">พิมพ์ใบสั่งตัด ใบวัดตัว หรือใบเสร็จรับเงินสำหรับลูกค้า</p>
            </div>
          </div>

          {/* Document Type Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-natural-sand/25 p-1 rounded-xl border border-natural-wheat/50">
              <button
                type="button"
                onClick={() => setDocumentType('order')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                  documentType === 'order'
                    ? 'bg-natural-clay text-white shadow-xs'
                    : 'text-natural-espresso/60 hover:text-natural-espresso hover:bg-natural-sand/30'
                }`}
              >
                <span>📋 ใบวัดตัว & สั่งตัด</span>
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('receipt')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                  documentType === 'receipt'
                    ? 'bg-natural-clay text-white shadow-xs'
                    : 'text-natural-espresso/60 hover:text-natural-espresso hover:bg-natural-sand/30'
                }`}
              >
                <span>🧾 ใบเสร็จรับเงิน</span>
              </button>
            </div>

            {/* Sub Selector for Receipt payment type */}
            {documentType === 'receipt' && (
              <div className="flex items-center space-x-1 bg-natural-sand/15 p-1 rounded-lg border border-natural-wheat/30">
                <button
                  type="button"
                  onClick={() => setReceiptPaymentType('deposit')}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${
                    receiptPaymentType === 'deposit'
                      ? 'bg-natural-clay/20 text-natural-clay border border-natural-clay/25'
                      : 'text-natural-espresso/50 hover:text-natural-espresso'
                  }`}
                >
                  มัดจำ & ยอดคงเหลือ
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptPaymentType('full')}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${
                    receiptPaymentType === 'full'
                      ? 'bg-natural-clay/20 text-natural-clay border border-natural-clay/25'
                      : 'text-natural-espresso/50 hover:text-natural-espresso'
                  }`}
                >
                  ชำระเต็มจำนวน
                </button>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrint}
                className="bg-natural-clay hover:bg-natural-clay-dark text-white font-serif font-bold text-xs py-2 px-4 rounded-xl transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>{documentType === 'order' ? 'พิมพ์ใบออเดอร์' : 'พิมพ์ใบเสร็จ'}</span>
              </button>
              <button
                onClick={onClose}
                className="bg-natural-sand/50 hover:bg-natural-sand text-natural-espresso p-2 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="p-8 overflow-y-auto bg-natural-sand/15 flex-1 flex justify-center">
          
          {/* Printable Sheet (Standard A4 Proportions on Screen) */}
          <div className="print-only-modal print-card-container bg-white w-full max-w-3xl p-8 sm:p-12 border border-natural-wheat shadow-lg rounded-xl text-natural-espresso relative" id="nunuh-print-sheet">
            
            {/* Elegant Header Accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-natural-clay via-natural-ochre to-natural-sage rounded-t-xl print:hidden"></div>

            {documentType === 'receipt' ? (
              /* ========================================================= */
              /* RECEIPT VIEW */
              /* ========================================================= */
              <div className="space-y-6">
                {/* Header Shop Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-natural-wheat/80 pb-6 gap-4">
                  <div className="flex items-center space-x-3.5">
                    {boutiqueLogo && (
                      <img 
                        src={boutiqueLogo} 
                        alt="Company Logo" 
                        className="h-12 w-auto max-h-12 max-w-[140px] object-contain" 
                      />
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-serif font-extrabold text-2xl tracking-widest text-natural-espresso">NUNUH</span>
                        <span className="text-xs bg-natural-clay/10 text-natural-clay px-2 py-0.5 rounded font-bold uppercase tracking-wider font-serif">Couture</span>
                      </div>
                      <p className="text-[10px] text-natural-espresso/60 leading-relaxed font-sans max-w-sm">
                        NUNUN INTERNATIONAL <br />
                        โทร: {boutiquePhone} | LINE: @237aynfq
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right space-y-1">
                    <h2 className="font-serif font-bold text-xl text-natural-clay uppercase tracking-wider">
                      {receiptPaymentType === 'deposit' ? 'ใบเสร็จรับเงินมัดจำ' : 'ใบเสร็จรับเงิน'}
                    </h2>
                    <p className="text-xs font-mono font-bold text-natural-espresso">
                      No. <span className="text-natural-clay font-extrabold">REC-{order.orderNumber}</span>
                    </p>
                    <p className="text-[10px] text-natural-espresso/50">
                      อ้างอิงใบสั่งซื้อ: {order.orderNumber}
                    </p>
                  </div>
                </div>

                {/* Customer Info Grid for Receipt */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 border-b border-natural-sand text-xs">
                  <div className="space-y-1">
                    <p className="text-[10px] text-natural-espresso/45 font-bold uppercase">ข้อมูลผู้ชำระเงิน</p>
                    <p className="font-bold text-natural-espresso flex items-center flex-wrap gap-1">
                      <User className="h-3 w-3 mr-0.5 text-natural-clay/60 shrink-0" />
                      <span>{order.customerName}</span>
                      {order.customerNickname && (
                        <span className="text-[11px] font-medium text-natural-espresso/70">
                          ({order.customerNickname})
                        </span>
                      )}
                    </p>
                    <p className="text-natural-espresso/70 flex items-center">
                      <Phone className="h-3 w-3 mr-1 text-natural-clay/60" /> {order.customerPhone}
                    </p>
                    {order.customerSocial && (
                      <p className="text-natural-espresso/60 font-medium">📱 IG/LINE: {order.customerSocial}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-natural-espresso/45 font-bold uppercase">ข้อมูลการออกใบเสร็จ</p>
                    <p className="font-semibold text-natural-espresso">
                      วันที่สั่งซื้อ: {formattedOrderDate}
                    </p>
                    <p className="font-semibold text-natural-espresso">
                      วันที่รับเงิน: {formattedOrderDate}
                    </p>
                    <p className="text-natural-clay font-bold">
                      กำหนดรับชุด: {formattedDeliveryDate}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-natural-espresso/45 font-bold uppercase font-sans">รายละเอียดช่องทางรับเงิน</p>
                    <p className="font-bold text-natural-espresso">
                      💵 ชำระโดย: {order.paymentMethod || 'เงินโอน/เงินสด'}
                    </p>
                    <div className="inline-flex items-center text-[10px] mt-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                      🟢 สถานะออเดอร์: {STATUS_MAP[order.status]?.label || order.status}
                    </div>
                  </div>
                </div>

                {/* Receipt Item List Table */}
                <div className="py-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-natural-wheat text-natural-espresso/50 font-serif">
                        <th className="py-2.5 font-bold uppercase">ลำดับ</th>
                        <th className="py-2.5 font-bold uppercase">รายละเอียดสินค้า (Description)</th>
                        <th className="py-2.5 font-bold uppercase text-center">จำนวน</th>
                        <th className="py-2.5 font-bold uppercase text-right">ราคาต่อหน่วย</th>
                        <th className="py-2.5 font-bold uppercase text-right">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-sand/40">
                      <tr>
                        <td className="py-4 font-mono font-bold text-natural-clay">01</td>
                        <td className="py-4 space-y-1">
                          <p className="font-bold text-natural-espresso text-sm">
                            งานสั่งตัดชุดประเภท: <span className="text-natural-clay">{order.dressType}</span>
                          </p>
                          <p className="text-natural-espresso/60 text-[11px]">
                            รายละเอียดสเปค: เนื้อผ้า {order.fabricType} | เฉดสี {order.fabricColor}
                          </p>
                          {order.customDesign && (
                            <p className="text-natural-espresso/50 text-[10px]">
                              สไตล์ดีไซน์: คอ {order.customDesign.neckline} | แขน {order.customDesign.sleeves} | ทรง {order.customDesign.silhouette}
                            </p>
                          )}
                          {order.sku && (
                            <p className="text-natural-clay/70 font-mono text-[10px] uppercase font-bold">
                              รหัสสินค้า / SKU: {order.sku}
                            </p>
                          )}
                        </td>
                        <td className="py-4 text-center font-bold">1</td>
                        <td className="py-4 text-right font-mono">{order.price.toLocaleString()} ฿</td>
                        <td className="py-4 text-right font-mono font-bold">{order.price.toLocaleString()} ฿</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary Breakdown for Receipt */}
                <div className="bg-natural-sand/10 border border-natural-wheat/50 rounded-2xl p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Notes/Terms for payment */}
                  <div className="space-y-2.5 text-xs text-natural-espresso/70 justify-center flex flex-col">
                    <p className="font-bold text-natural-espresso">📝 ข้อกำหนดและนัดหมายการรับสินค้า:</p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                      {receiptPaymentType === 'deposit' ? (
                        <>
                          <li>ลูกค้าได้ชำระเงินมัดจำล่วงหน้าเรียบร้อยแล้วเป็นจำนวน <strong className="text-natural-clay font-bold">{order.deposit.toLocaleString()} ฿</strong></li>
                          <li><strong className="text-natural-clay-dark font-bold">ส่วนต่างค้างชำระคงเหลืออีก {unpaidAmount.toLocaleString()} ฿</strong> ต้องชำระเงินครบก่อนหรือในวันมารับชุด</li>
                        </>
                      ) : (
                        <>
                          <li>ลูกค้าชำระค่าบริการสั่งตัดแบบเต็มจำนวนเรียบร้อยแล้ว</li>
                          <li>ไม่มียอดค้างชำระเพิ่มเติมสำหรับออเดอร์นี้</li>
                        </>
                      )}
                      <li>ลูกค้าสามารถปรับแก้ไซส์ในวันฟิตติ้งเพิ่มเติมได้ฟรี 1 ครั้ง</li>
                      <li>หากมีการยกเลิกสินค้า ทางร้านขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี</li>
                      <li>ไม่สามารถเปลี่ยนแบบหรือเปลี่ยนไซส์หลังจากยืนยันการสั่งตัดแล้ว</li>
                    </ul>
                  </div>

                  {/* Right calculated pricing block */}
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-natural-sand/50">
                      <span className="text-natural-espresso/60 font-medium">รวมเงินค่าสินค้า (Gross Total)</span>
                      <span className="font-mono font-bold text-natural-espresso">{order.price.toLocaleString()} ฿</span>
                    </div>
                    {!!order.discount && (
                      <div className="flex justify-between py-1 border-b border-natural-sand/50">
                        <span className="text-amber-600 font-medium">ส่วนลดพิเศษ (Discount)</span>
                        <span className="font-mono font-bold text-amber-600">-{order.discount.toLocaleString()} ฿</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-natural-sand/50">
                      <span className="text-natural-espresso font-bold">ราคาสุทธิ (Net Amount)</span>
                      <span className="font-mono font-bold text-natural-espresso text-sm">{(order.price - (order.discount || 0)).toLocaleString()} ฿</span>
                    </div>

                    {receiptPaymentType === 'deposit' ? (
                      <>
                        <div className="flex justify-between py-1.5 border-b border-natural-sand/70 bg-natural-clay/5 px-2 rounded-lg">
                          <span className="text-natural-clay font-bold">ชำระเงินมัดจำแล้ว (Deposit Received)</span>
                          <span className="font-mono font-extrabold text-natural-clay text-sm">{order.deposit.toLocaleString()} ฿</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-natural-sand/80 bg-rose-50 px-2 rounded-lg border-2 border-rose-200">
                          <span className="text-rose-800 font-extrabold">ส่วนต่างคงเหลือที่ต้องชำระ (Balance Due)</span>
                          <span className="font-mono font-black text-rose-700 text-lg">{unpaidAmount.toLocaleString()} ฿</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between py-1.5 border-b border-natural-sand/70 bg-emerald-50 px-2 rounded-lg">
                          <span className="text-emerald-800 font-bold">ชำระแล้วเต็มจำนวน (Amount Received)</span>
                          <span className="font-mono font-extrabold text-emerald-800 text-sm">{(order.price - (order.discount || 0)).toLocaleString()} ฿</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-natural-sand/80 bg-emerald-50 px-2 rounded-lg border-2 border-emerald-200">
                          <span className="text-emerald-800 font-extrabold">ส่วนต่างที่ต้องชำระ (Balance Due)</span>
                          <span className="font-mono font-black text-emerald-800 text-lg">0 ฿</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Signatures & Stamp for Receipt */}
                <div className="pt-4 flex justify-between items-end gap-6 text-[10px] text-natural-espresso/60">
                  {/* Status Stamp Box */}
                  <div className="flex-1 flex justify-start">
                    {receiptPaymentType === 'deposit' ? (
                      <div className="border-2 border-dashed border-natural-clay/40 text-natural-clay bg-natural-clay/5 px-5 py-3 rounded-2xl flex flex-col items-center justify-center font-serif rotate-[-2deg] font-bold tracking-wider max-w-[200px]">
                        <span className="text-xs uppercase">NUNUH COUTURE</span>
                        <span className="text-[14px] font-black uppercase tracking-widest mt-1">DEPOSIT PAID</span>
                        <span className="text-[10px] font-sans font-semibold text-natural-espresso/60 mt-0.5">รับเงินมัดจำแล้ว</span>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-emerald-500/40 text-emerald-600 bg-emerald-50 px-5 py-3 rounded-2xl flex flex-col items-center justify-center font-serif rotate-[-2deg] font-bold tracking-wider max-w-[200px]">
                        <span className="text-xs uppercase">NUNUH COUTURE</span>
                        <span className="text-[14px] font-black uppercase tracking-widest mt-1">PAID IN FULL</span>
                        <span className="text-[10px] font-sans font-semibold text-natural-espresso/60 mt-0.5">ชำระครบถ้วนแล้ว</span>
                      </div>
                    )}
                  </div>

                  {/* Recipients */}
                  <div className="flex gap-4">
                    <div className="text-center w-36 space-y-1">
                      <div className="border-b border-natural-espresso/30 h-10 w-full"></div>
                      <p className="font-semibold text-natural-espresso">ลงชื่อ: .......................................</p>
                      <p className="text-[9px] text-natural-espresso/40 font-bold uppercase">( ผู้รับเงิน )</p>
                    </div>
                    <div className="text-center w-36 space-y-1">
                      {order.pickupSignature ? (
                        <div className="h-10 w-full flex flex-col items-center justify-end">
                          <img src={order.pickupSignature} alt="Customer Signature" className="h-9 max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="border-b border-natural-espresso/30 h-10 w-full"></div>
                      )}
                      <p className="font-semibold text-natural-espresso text-[10px]">
                        {order.pickupSigneeName || order.customerName}
                      </p>
                      <p className="text-[9px] text-natural-espresso/40 font-bold uppercase">( ลูกค้าผู้ชำระเงิน / รับมอบชุด )</p>
                      {order.pickupSignedAt && <p className="text-[8px] text-emerald-700 font-mono">{order.pickupSignedAt}</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================= */
              /* ORIGINAL DETAILED ORDER VIEW */
              /* ========================================================= */
              <>
                {/* Header Shop Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-natural-wheat/80 pb-6 gap-4">
                  <div className="flex items-center space-x-3.5">
                    {boutiqueLogo && (
                      <img 
                        src={boutiqueLogo} 
                        alt="Company Logo" 
                        className="h-12 w-auto max-h-12 max-w-[140px] object-contain" 
                      />
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-serif font-extrabold text-2xl tracking-widest text-natural-espresso">NUNUH</span>
                        <span className="text-xs bg-natural-clay/10 text-natural-clay px-2 py-0.5 rounded font-bold uppercase tracking-wider font-serif">Couture</span>
                      </div>
                      <p className="text-[10px] text-natural-espresso/60 leading-relaxed font-sans max-w-sm">
                        NUNUN INTERNATIONAL <br />
                        โทร: {boutiquePhone} | LINE: @237aynfq
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right space-y-1">
                    <h2 className="font-serif font-bold text-xl text-natural-clay uppercase tracking-wider">ใบสั่งตัดชุดและวัดตัว</h2>
                    <p className="text-xs font-mono font-bold text-natural-espresso">
                      No. <span className="text-natural-clay font-extrabold">{order.orderNumber}</span>
                    </p>
                    <div className="inline-flex items-center text-[10px] bg-natural-sand/40 border border-natural-wheat/60 px-2 py-0.5 rounded-full font-bold">
                      🟢 สถานะ: {STATUS_MAP[order.status]?.label || order.status}
                    </div>
                  </div>
                </div>

                {/* Customer & Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-5 border-b border-natural-sand text-xs">
                  <div className="space-y-1">
                    <p className="text-[10px] text-natural-espresso/45 font-bold uppercase">ข้อมูลผู้สั่งซื้อ</p>
                    <p className="font-bold text-natural-espresso flex items-center flex-wrap gap-1">
                      <User className="h-3 w-3 mr-0.5 text-natural-clay/60 shrink-0" />
                      <span>{order.customerName}</span>
                      {order.customerNickname && (
                        <span className="text-[11px] font-medium text-natural-espresso/70">
                          ({order.customerNickname})
                        </span>
                      )}
                    </p>
                    <p className="text-natural-espresso/70 flex items-center">
                      <Phone className="h-3 w-3 mr-1 text-natural-clay/60" /> {order.customerPhone}
                    </p>
                    {order.customerSocial && (
                      <p className="text-natural-espresso/60 font-medium">📱 IG/LINE: {order.customerSocial}</p>
                    )}
                    {order.customerCategory && (
                      <p className="text-natural-espresso/80 font-bold text-[11px] mt-0.5">🏷️ ประเภทงาน: <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] inline-block">{order.customerCategory}</span></p>
                    )}
                    {order.membershipTier && (
                      <p className="text-natural-espresso/80 font-bold text-[11px] mt-0.5">💳 บัตรสมาชิก: <span className="text-yellow-800 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200 text-[10px] font-bold inline-block uppercase">{order.membershipTier}</span></p>
                    )}
                    {order.externalOrderId && (
                      <p className="text-natural-espresso/80 font-bold text-[11px] mt-0.5">🔗 รหัสจากกัน: <span className="text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 text-[10px] font-mono inline-block">{order.externalOrderId}</span></p>
                    )}
                    {order.branch && (
                      <p className="text-natural-espresso/80 font-bold text-[11px] mt-0.5">🏪 สาขา: <span className="text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10px] inline-block">{order.branch}</span></p>
                    )}
                    {order.staffName && (
                      <p className="text-natural-espresso/80 font-bold text-[11px] mt-0.5">👤 พนักงานรับออเดอร์: <span className="text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] inline-block">{order.staffName}</span></p>
                    )}
                    {order.tailorName && (
                      <p className="text-natural-espresso/80 font-bold text-[11px] mt-0.5">✂️ ช่างตัดเย็บ / ผู้รับผิดชอบ: <span className="text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[10px] font-bold inline-block">{order.tailorName}</span></p>
                    )}
                    {order.isMatchingSet && (
                      <p className="text-natural-espresso/80 font-bold text-[11px] mt-0.5">✨ งานเข้าชุด: <span className="text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 text-[10px] font-bold inline-block">{order.idhNumber ? `IDH: ${order.idhNumber}` : 'ใช่'}</span></p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-natural-espresso/45 font-bold uppercase">วันที่สั่งจองและจัดส่ง</p>
                    <p className="font-semibold text-natural-espresso flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1 text-natural-ochre" /> วันที่สั่งซื้อ: {formattedOrderDate}
                    </p>
                    <p className="font-bold text-natural-clay flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1 text-natural-clay" /> วันกำหนดส่ง: {formattedDeliveryDate}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-natural-espresso/45 font-bold uppercase">รายละเอียดประเภทงาน</p>
                    <p className="font-bold text-natural-espresso">ประเภทชุด: {order.dressType}</p>
                    <p className="text-natural-espresso/75">เนื้อผ้า: {order.fabricType}</p>
                    <p className="text-natural-espresso/75">เฉดสี: {order.fabricColor}</p>
                    {order.sku && (
                      <p className="text-natural-clay font-bold font-mono uppercase text-[11px]">SKU: {order.sku}</p>
                    )}
                  </div>
                </div>

                {/* Measurements Section */}
                {order.customerCategory === 'IDH' || order.dressType?.toUpperCase().includes('IDH') || order.idhNumber || order.dressType?.includes('ผ้าคลุม') ? (
                  <div className="py-3 border-b border-natural-sand">
                    <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200/50 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-amber-950 font-bold text-xs">
                        <span className="text-base">🧕</span>
                        <span>สินค้าประเภท IDH (ผ้าคลุมสำเร็จ) — ไม่มีตารางวัดตัว</span>
                      </div>
                      {order.measurements.standardSize && (
                        <span className="text-[10px] bg-amber-800 text-white px-2.5 py-0.5 rounded-full font-bold">
                          ไซส์ผ้าคลุม: {order.measurements.standardSize}
                        </span>
                      )}
                    </div>
                  </div>
                ) : activeMeasurements.length > 0 && (
                  <div className="py-4 border-b border-natural-sand">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-serif font-bold text-xs text-natural-espresso flex items-center">
                        <Scissors className="h-3.5 w-3.5 mr-1.5 text-natural-clay" /> ตารางขนาดสัดส่วนการวัดตัว (Tailoring Measurements)
                      </h4>
                      {order.measurements.standardSize && (
                        <span className="text-[9px] bg-natural-clay text-white px-2.5 py-0.5 rounded-full font-bold">
                          ไซส์มาตรฐาน: {order.measurements.standardSize}
                        </span>
                      )}
                    </div>

                    {/* Grid Measurements */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center text-xs mb-3">
                      {activeMeasurements.map((field) => {
                        const val = order.measurements[field.key as keyof typeof order.measurements];
                        return (
                          <div key={field.key} className="bg-natural-sand/20 p-2 rounded-lg border border-natural-wheat/40 flex flex-col justify-between min-h-[48px]">
                            <span className="block text-[9px] text-natural-espresso/50 font-bold uppercase">{field.label}</span>
                            <strong className="text-sm font-mono font-bold text-natural-espresso">{val} {field.unit}</strong>
                          </div>
                        );
                      })}
                      <div className="bg-natural-sand/20 p-2 rounded-lg border border-natural-wheat/40 flex flex-col justify-center min-h-[48px]">
                        <span className="block text-[9px] text-natural-espresso/50 font-bold uppercase">สไตล์สัดส่วน</span>
                        <strong className="text-[10px] font-bold text-natural-clay">
                          {order.measurements.standardSize ? `Standard ${order.measurements.standardSize}` : 'สั่งตัดส่วนตัว (Custom)'}
                        </strong>
                      </div>
                    </div>

                    {order.measurements.otherNotes && isValueValid(order.measurements.otherNotes) && (
                      <div className="text-xs bg-natural-sand/20 p-2 rounded-lg border border-natural-wheat/40 leading-relaxed text-natural-espresso/80">
                        <strong className="text-natural-espresso">📌 รายละเอียดสัดส่วนพิเศษเพิ่มเติม:</strong> {order.measurements.otherNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Design & Sketches Reference Section */}
                {(order.customDesign || (order.notes && isValueValid(order.notes)) || displayImage || displayImage2) && (
                  <div className="py-4 border-b border-natural-sand text-xs">
                    <h4 className="font-serif font-bold text-xs text-natural-espresso flex items-center mb-2">
                      <Sparkles className="h-3.5 w-3.5 mr-1.5 text-natural-ochre" /> รายละเอียดดีไซน์และรูปภาพประกอบ (Design & Reference Illustration)
                    </h4>
                    
                    <div className={`grid ${displayImage || displayImage2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                      {(order.customDesign || (order.notes && isValueValid(order.notes))) && (
                        <div className="space-y-2 flex flex-col justify-between">
                          <div className="space-y-2">
                            {order.customDesign && (
                              <div className="bg-natural-sand/20 p-2.5 rounded-lg border border-natural-wheat/30 space-y-1 text-xs">
                                <p className="font-bold text-natural-espresso border-b border-natural-sand/55 pb-1">📐 สไตล์ทรงสถาปัตย์ชุด</p>
                                <p><span className="text-natural-espresso/60">ทรงชุด (Silhouette):</span> <strong className="font-bold">{order.customDesign.silhouette}</strong></p>
                                <p><span className="text-natural-espresso/60">ดีไซน์คอ (Neckline):</span> <strong className="font-bold">{order.customDesign.neckline}</strong></p>
                                <p><span className="text-natural-espresso/60">ดีไซน์แขน (Sleeves):</span> <strong className="font-bold">{order.customDesign.sleeves}</strong></p>
                              </div>
                            )}
                            {order.notes && isValueValid(order.notes) && (
                              <div className="p-2.5 bg-natural-cream/40 border border-natural-sand rounded-lg italic text-natural-espresso/75 leading-relaxed">
                                " {order.notes} "
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {(displayImage || displayImage2) && (
                        <div className="space-y-1.5 flex flex-col justify-center">
                          <p className="text-[10px] text-natural-espresso/45 font-bold uppercase tracking-wider">
                            <span>🖼 {imageSourceLabel}</span>
                          </p>
                          <div className={`grid ${displayImage && displayImage2 ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5`}>
                            {displayImage && (
                              <div className="border border-natural-wheat rounded-xl p-1 bg-natural-sand/10 flex items-center justify-center max-h-40 overflow-hidden print:max-h-36">
                                <img 
                                  src={displayImage} 
                                  alt="Design Reference for print 1" 
                                  className="max-h-36 object-contain rounded-lg print:max-h-32 mx-auto"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            {displayImage2 && (
                              <div className="border border-natural-wheat rounded-xl p-1 bg-natural-sand/10 flex items-center justify-center max-h-40 overflow-hidden print:max-h-36">
                                <img 
                                  src={displayImage2} 
                                  alt="Design Reference for print 2" 
                                  className="max-h-36 object-contain rounded-lg print:max-h-32 mx-auto"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Financial Summary Box */}
                <div className="py-5 border-b border-natural-sand flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="font-serif font-bold text-xs text-natural-espresso flex items-center">
                      <DollarSign className="h-4 w-4 mr-1 text-natural-clay" /> รายการสรุปด้านการเงิน (Financial Statement)
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-natural-espresso/50">กรุณาตรวจสอบยอดชำระมัดจำ และยอดค้างจ่ายทั้งหมด</p>
                      {order.paymentMethod && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          ช่องทาง: {order.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`grid gap-2 w-full sm:w-auto text-center text-xs ${order.discount ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                    <div className="bg-white border border-natural-wheat p-2 rounded-xl min-w-[80px]">
                      <span className="block text-[9px] text-natural-espresso/45 font-bold uppercase">ราคาค่าชุด</span>
                      <strong className="text-sm font-mono font-bold text-natural-espresso">{order.price.toLocaleString()} ฿</strong>
                    </div>
                    {!!order.discount && (
                      <div className="bg-white border border-natural-wheat p-2 rounded-xl min-w-[80px]">
                        <span className="block text-[9px] text-amber-600 font-bold uppercase">ส่วนลด</span>
                        <strong className="text-sm font-mono font-bold text-amber-600">-{order.discount.toLocaleString()} ฿</strong>
                      </div>
                    )}
                    <div className="bg-white border border-natural-wheat p-2 rounded-xl min-w-[80px]">
                      <span className="block text-[9px] text-natural-clay font-bold uppercase">หักค่ามัดจำ</span>
                      <strong className="text-sm font-mono font-bold text-natural-clay">-{order.deposit.toLocaleString()} ฿</strong>
                    </div>
                    {!!order.finalPaymentAmount && (
                      <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl min-w-[80px]">
                        <span className="block text-[9px] text-emerald-800 font-bold uppercase">
                          ชำระส่วนต่าง ({order.finalPaymentMethod || order.paymentMethod || 'เงินโอน'})
                        </span>
                        <strong className="text-sm font-mono font-bold text-emerald-800">-{order.finalPaymentAmount.toLocaleString()} ฿</strong>
                      </div>
                    )}
                    <div className={`p-2 rounded-xl min-w-[110px] shadow-xs col-span-2 sm:col-span-1 ${
                      unpaidAmount === 0 ? 'bg-emerald-700 text-white' : 'bg-natural-clay text-white'
                    }`}>
                      <span className="block text-[9px] text-white/75 font-bold uppercase">
                        {unpaidAmount === 0 ? 'สถานะการชำระ' : 'คงค้าง ณ วันรับชุด'}
                      </span>
                      <strong className="text-sm font-mono font-extrabold">
                        {unpaidAmount === 0 ? 'ชำระครบถ้วน ✓' : `${unpaidAmount.toLocaleString()} ฿`}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Customer Body Photos Section (For tailors) */}
                {(order.customerPhotoFront || order.customerPhotoSide || order.customerPhotoBack || order.customerPhotoExtra1 || order.customerPhotoExtra2) && (
                  <div className="py-4 border-b border-natural-sand text-xs customer-photos-section">
                    <h4 className="font-serif font-bold text-xs text-natural-espresso flex items-center mb-2">
                      📸 ภาพถ่ายสัดส่วนสรีระลูกค้า (Customer Body Proportions)
                    </h4>
                    <div className="flex flex-wrap gap-4 justify-start">
                      {order.customerPhotoFront && (
                        <div className="text-center space-y-1">
                          <p className="text-[10px] text-natural-espresso/60 font-bold">ด้านหน้า (Front)</p>
                          <div className="border border-natural-wheat rounded-lg p-1 bg-natural-sand/5 flex items-center justify-center max-h-28 overflow-hidden">
                            <img src={order.customerPhotoFront} alt="Front View" className="max-h-24 object-contain rounded" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                      )}

                      {order.customerPhotoSide && (
                        <div className="text-center space-y-1">
                          <p className="text-[10px] text-natural-espresso/60 font-bold">ด้านข้าง (Side)</p>
                          <div className="border border-natural-wheat rounded-lg p-1 bg-natural-sand/5 flex items-center justify-center max-h-28 overflow-hidden">
                            <img src={order.customerPhotoSide} alt="Side View" className="max-h-24 object-contain rounded" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                      )}

                      {order.customerPhotoBack && (
                        <div className="text-center space-y-1">
                          <p className="text-[10px] text-natural-espresso/60 font-bold">ด้านหลัง (Back)</p>
                          <div className="border border-natural-wheat rounded-lg p-1 bg-natural-sand/5 flex items-center justify-center max-h-28 overflow-hidden">
                            <img src={order.customerPhotoBack} alt="Back View" className="max-h-24 object-contain rounded" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                      )}

                      {order.customerPhotoExtra1 && (
                        <div className="text-center space-y-1">
                          <p className="text-[10px] text-natural-espresso/60 font-bold">ภาพเพิ่มเติม 1 (Extra 1)</p>
                          <div className="border border-natural-wheat rounded-lg p-1 bg-natural-sand/5 flex items-center justify-center max-h-28 overflow-hidden">
                            <img src={order.customerPhotoExtra1} alt="Extra View 1" className="max-h-24 object-contain rounded" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                      )}

                      {order.customerPhotoExtra2 && (
                        <div className="text-center space-y-1">
                          <p className="text-[10px] text-natural-espresso/60 font-bold">ภาพเพิ่มเติม 2 (Extra 2)</p>
                          <div className="border border-natural-wheat rounded-lg p-1 bg-natural-sand/5 flex items-center justify-center max-h-28 overflow-hidden">
                            <img src={order.customerPhotoExtra2} alt="Extra View 2" className="max-h-24 object-contain rounded" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Terms and Signatures */}
                <div className="pt-6 text-[10px] text-natural-espresso/60 space-y-8">
                  <div className="bg-natural-sand/20 p-3.5 rounded-lg border border-natural-sand/60 leading-relaxed text-natural-espresso/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-natural-espresso block text-[10.5px]">เงื่อนไขการสั่งตัดและการรับชุด:</strong>
                      <span className="text-[9px] text-natural-espresso/45 font-medium print:hidden">(คลิกกล่องข้อความเพื่อติ๊กถูก/ยกเลิก)</span>
                    </div>
                    <div className="space-y-2">
                      {/* ข้อ 1 */}
                      <div 
                        onClick={() => toggleTerm(1)}
                        className="flex items-start space-x-2 cursor-pointer hover:bg-natural-sand/20 p-1 rounded transition-colors group"
                      >
                        <div className="mt-0.5 shrink-0 text-natural-espresso/80 group-hover:text-natural-espresso">
                          {agreedTerms[1] ? (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-natural-espresso/70 bg-white rounded-xs text-[10px] font-bold text-natural-espresso">✓</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-natural-espresso/40 bg-white rounded-xs"></span>
                          )}
                        </div>
                        <p className="flex-1 text-[9.5px] leading-relaxed">
                          <strong>การยกเลิกคำสั่งซื้อและการคืนเงินมัดจำ:</strong><br />
                          กรณีผู้ใช้บริการขอยกเลิกคำสั่งซื้อ ผู้ให้บริการ ขอสงวนสิทธิ์ในการริบเงินมัดจำทั้งหมดที่ได้รับไว้แล้ว เว้นแต่กรณีที่การยกเลิกดังกล่าวเกิดขึ้นจากความผิดพลาด ความบกพร่อง หรือการไม่ปฏิบัติตามข้อตกลงของผู้ให้บริการ ผู้ให้บริการยินดีคืนเงินมัดจำให้แก่ผู้ใช้บริการเต็มจำนวน
                        </p>
                      </div>

                      {/* ข้อ 2 */}
                      <div 
                        onClick={() => toggleTerm(2)}
                        className="flex items-start space-x-2 cursor-pointer hover:bg-natural-sand/20 p-1 rounded transition-colors group"
                      >
                        <div className="mt-0.5 shrink-0 text-natural-espresso/80 group-hover:text-natural-espresso">
                          {agreedTerms[2] ? (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-natural-espresso/70 bg-white rounded-xs text-[10px] font-bold text-natural-espresso">✓</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-natural-espresso/40 bg-white rounded-xs"></span>
                          )}
                        </div>
                        <p className="flex-1 text-[9.5px] leading-relaxed">
                          <strong>การปรับแก้ทรงและขนาดชุด (Fitting):</strong><br />
                          ผู้ใช้บริการมีสิทธิ์ขอปรับแก้ทรงหรือขนาดชุด (Fitting) โดยไม่มีค่าใช้จ่ายเพิ่มเติมได้จำนวน 1 (หนึ่ง) ครั้ง ณ วันและเวลานัดหมายก่อนการรับมอบสินค้า ทั้งนี้ การปรับแก้ดังกล่าวต้องอยู่ภายใต้แพทเทิร์น โครงสร้าง และรูปแบบเดิมตามที่ได้ตกลงกันไว้เท่านั้น
                        </p>
                      </div>

                      {/* ข้อ 3 */}
                      <div 
                        onClick={() => toggleTerm(3)}
                        className="flex items-start space-x-2 cursor-pointer hover:bg-natural-sand/20 p-1 rounded transition-colors group"
                      >
                        <div className="mt-0.5 shrink-0 text-natural-espresso/80 group-hover:text-natural-espresso">
                          {agreedTerms[3] ? (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-natural-espresso/70 bg-white rounded-xs text-[10px] font-bold text-natural-espresso">✓</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-natural-espresso/40 bg-white rounded-xs"></span>
                          )}
                        </div>
                        <p className="flex-1 text-[9.5px] leading-relaxed">
                          <strong>การชำระเงินและการรับมอบสินค้า:</strong><br />
                          ผู้ให้บริการขอสงวนสิทธิ์ในการส่งมอบสินค้าจนกว่าผู้ใช้บริการจะทำการชำระเงินส่วนที่เหลือสุทธิครบถ้วนตามที่ระบุในข้อตกลง โดยผู้ใช้บริการจะสามารถรับมอบหรือนำสินค้าออกจากสตูดิโอได้ ต่อเมื่อได้ทำการชำระเงินครบถ้วนเรียบร้อยแล้วเท่านั้น
                        </p>
                      </div>

                      {/* ข้อ 4 */}
                      <div 
                        onClick={() => toggleTerm(4)}
                        className="flex items-start space-x-2 cursor-pointer hover:bg-natural-sand/20 p-1 rounded transition-colors group"
                      >
                        <div className="mt-0.5 shrink-0 text-natural-espresso/80 group-hover:text-natural-espresso">
                          {agreedTerms[4] ? (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-natural-espresso/70 bg-white rounded-xs text-[10px] font-bold text-natural-espresso">✓</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-natural-espresso/40 bg-white rounded-xs"></span>
                          )}
                        </div>
                        <p className="flex-1 text-[9.5px] leading-relaxed">
                          <strong>การยืนยันรูปแบบและขนาดสินค้า:</strong><br />
                          เมื่อผู้ใช้บริการได้แสดงเจตนายืนยันการสั่งตัดเรียบร้อยแล้ว ให้ถือว่ารูปแบบ สไตล์ วัสดุ และขนาด (Size) ตามที่ระบุไว้เป็นอันยุติ ผู้ใช้บริการจะไม่สามารถขอเปลี่ยนแปลงรายการดังกล่าวได้อีกไม่ว่ากรณีใดๆ
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="flex justify-between items-end pt-6 gap-6">
                    <div className="text-center w-40 space-y-1">
                      <div className="border-b border-natural-espresso/30 h-10 w-full"></div>
                      <p className="font-semibold text-natural-espresso">ลงชื่อ: .......................................</p>
                      <p className="text-[9px] text-natural-espresso/40 font-bold uppercase">( ดีไซเนอร์ / ช่างผู้บันทึก )</p>
                    </div>
                    <div className="text-center w-40 space-y-1">
                      {order.pickupSignature ? (
                        <div className="h-10 w-full flex flex-col items-center justify-end">
                          <img src={order.pickupSignature} alt="Customer Signature" className="h-10 max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="border-b border-natural-espresso/30 h-10 w-full"></div>
                      )}
                      <p className="font-semibold text-natural-espresso text-[10px]">
                        {order.pickupSigneeName || order.customerName}
                      </p>
                      <p className="text-[9px] text-natural-espresso/40 font-bold uppercase">( ลายมือชื่อลูกค้าผู้สั่งตัด / รับมอบชุด )</p>
                      {order.pickupSignedAt && <p className="text-[8px] text-emerald-700 font-mono">{order.pickupSignedAt}</p>}
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

        </div>

      </div>
    </div>,
    document.body
  );
}
