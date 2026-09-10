import React, { StrictMode, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: any) {
    console.error('App ErrorBoundary caught:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-6 text-center text-[#2D2421]">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-[#E6DCD0] space-y-4">
            <div className="w-16 h-16 bg-[#F3ECE1] text-[#B96248] rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
              👗
            </div>
            <h1 className="text-xl font-bold font-serif">ระบบจัดการห้องเสื้อ NUNUH</h1>
            <p className="text-sm text-[#2D2421]/70 leading-relaxed">
              กำลังรีเฟรชการเชื่อมต่อฐานข้อมูล กรุณากดปุ่มด้านล่างเพื่อเริ่มการทำงานใหม่อีกครั้งค่ะ
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('nunuh_deleted_order_ids');
                window.location.reload();
              }}
              className="w-full py-3 bg-[#B96248] hover:bg-[#984E37] text-white font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              🔄 รีเฟรชหน้าจอ (Reload Application)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
