'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Package, ExternalLink, ArrowLeft, Server, Users, BarChart2, FileSpreadsheet } from 'lucide-react';

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-lime-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="text-lime-400" size={40} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Inventory Management</h1>
            <p className="text-neutral-400">Choose your inventory access method</p>
          </div>

          <div className="space-y-4">
            {/* New Standalone Inventory App */}
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-lime-400/10 hover:bg-lime-400/20 border-2 border-lime-400 rounded-xl p-6 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-lime-400/20 rounded-lg">
                  <Server className="text-lime-400" size={28} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">Full Inventory System</h2>
                    <span className="px-2 py-0.5 bg-lime-400 text-black text-xs rounded font-bold">NEW</span>
                  </div>
                  <p className="text-neutral-400 mt-1">Complete inventory management with role-based access</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="px-2 py-1 bg-neutral-700 text-neutral-300 text-xs rounded flex items-center gap-1">
                      <Users size={12} /> Role-based Access
                    </span>
                    <span className="px-2 py-1 bg-neutral-700 text-neutral-300 text-xs rounded flex items-center gap-1">
                      <BarChart2 size={12} /> Stock Tracking
                    </span>
                    <span className="px-2 py-1 bg-neutral-700 text-neutral-300 text-xs rounded flex items-center gap-1">
                      <FileSpreadsheet size={12} /> Excel Import
                    </span>
                  </div>
                  <div className="mt-4 text-lime-400 font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                    Open Inventory App
                    <ExternalLink size={18} />
                  </div>
                </div>
              </div>
            </a>

            {/* Role-Based Access Info */}
            <div className="bg-neutral-700/50 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-3">Access Levels</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-neutral-300">Owner - Full access + financials</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-neutral-300">Admin - User management</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-neutral-300">Manager - Stock management</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-neutral-300">Driver - Mobile checkout</span>
                </div>
              </div>
            </div>

            {/* Default Login Credentials */}
            <div className="bg-neutral-700/30 rounded-xl p-5 border border-neutral-600">
              <h3 className="font-semibold text-white mb-3">Default Logins</h3>
              <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                <div className="text-neutral-400">michael / owner123</div>
                <div className="text-neutral-400">sara / admin123</div>
                <div className="text-neutral-400">destin / manager123</div>
                <div className="text-neutral-400">john / driver123</div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/portal/dashboard"
              className="inline-flex items-center gap-2 text-neutral-400 hover:text-white"
            >
              <ArrowLeft size={18} />
              Back to Portal Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
