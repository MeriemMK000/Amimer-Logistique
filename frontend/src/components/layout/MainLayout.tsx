'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarWidth = sidebarCollapsed ? 72 : 260;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile unless mobileOpen */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content area */}
      <div
        className="hidden lg:block fixed top-0 right-0 z-30 transition-all duration-300"
        style={{ left: sidebarWidth }}
      >
        <Header onMenuClick={() => setMobileOpen(true)} />
      </div>
      <div className="lg:hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
      </div>

      <div
        className="transition-all duration-300 lg:pt-16"
        style={{ marginLeft: 0 }}
      >
        <div className="hidden lg:block" style={{ marginLeft: sidebarWidth }}>
          <main className="p-6">{children}</main>
        </div>
        <div className="lg:hidden">
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
