import React from 'react';
import { MenuStripBar } from './MenuStripBar';
import { PageTabBar, PageDef } from './PageTabBar';
import { StatusFooterBar } from './StatusFooterBar';

interface AppShellProps {
  children: React.ReactNode;
  pages: PageDef[];
  currentPageId: string;
  onPageChange: (id: string) => void;
  onOpenSettings: () => void;
  onQuit: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  pages,
  currentPageId,
  onPageChange,
  onOpenSettings,
  onQuit,
}) => {
  return (
    <div className="flex flex-col h-screen bg-rv-window overflow-hidden">
      {/* Top Menu Strip */}
      <MenuStripBar onOpenSettings={onOpenSettings} onQuit={onQuit} />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </main>

      {/* Page Tab Bar */}
      <PageTabBar 
        pages={pages} 
        currentPageId={currentPageId} 
        onPageChange={onPageChange} 
      />

      {/* Status Footer Bar */}
      <StatusFooterBar />
    </div>
  );
};
