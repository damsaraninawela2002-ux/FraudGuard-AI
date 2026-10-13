import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(20,184,166,0.05),rgba(248,250,252,0))] text-navy">
      {/* Left Navigation Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area (offset by 256px on desktop) */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
