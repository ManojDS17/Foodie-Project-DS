import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileNavDrawer } from './MobileNavDrawer';

export const MasterLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F2F2F2] w-full">
      {/* Desktop Sticky Left Sidebar (hidden on mobile) */}
      <div className="hidden md:flex flex-shrink-0 sticky top-0 h-screen z-30 self-start">
        <Sidebar />
      </div>

      {/* Mobile Slide-Out Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />
        
        <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl w-full mx-auto pb-20 md:pb-6 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (hidden on desktop) */}
      <MobileBottomNav />
    </div>
  );
};
