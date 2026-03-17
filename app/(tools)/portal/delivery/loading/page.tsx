'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  CheckSquare,
  Square,
  Shield,
  Camera,
  ChevronDown,
  ChevronUp,
  Weight,
  Timer,
  RotateCcw,
  Play,
  Search,
  Filter,
  BarChart3,
  History,
  ClipboardCheck,
  User,
  Calendar,
  MapPin,
  Phone,
  AlertCircle,
  Flag,
  RefreshCw,
  Star,
  TrendingUp,
  Eye,
  Pause,
  XCircle,
  Minus,
  Plus,
  ArrowRight,
  Layers,
  Info,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type TicketPriority = 'normal' | 'rush' | 'urgent';
type TicketStatus = 'assigned' | 'materials_pulled' | 'loading' | 'loaded' | 'qc_passed' | 'dispatched';
type VehicleType = 'pickup' | 'flatbed' | 'box_truck' | 'trailer' | 'van';
type MaterialCategory = 'heavy' | 'medium' | 'light' | 'fragile';
type TabKey = 'queue' | 'active' | 'capacity' | 'history' | 'qc';

interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  weightLbs: number;
  category: MaterialCategory;
  pulled: boolean;
  loaded: boolean;
  flagged: boolean;
  flagReason?: string;
}

interface LoadingTicket {
  id: string;
  customer: string;
  jobName: string;
  address: string;
  phone: string;
  priority: TicketPriority;
  status: TicketStatus;
  scheduledTime: string;
  scheduledDate: string;
  driverName: string;
  driverId: string;
  vehicle: string;
  vehicleType: VehicleType;
  vehicleCapacityLbs: number;
  loadingBay: number | null;
  loadingStartTime: string | null;
  loadingEndTime: string | null;
  materials: MaterialItem[];
  qcPassed: boolean | null;
  qcNotes: string;
  photosTaken: number;
  photosRequired: number;
}

interface LoadHistoryEntry {
  id: string;
  ticketId: string;
  customer: string;
  driver: string;
  date: string;
  loadTimeMinutes: number;
  totalWeight: number;
  itemCount: number;
  itemsCorrect: number;
  itemsFlagged: number;
  vehicleType: VehicleType;
  qcPassed: boolean;
}

interface QCCheckItem {
  id: string;
  label: string;
  category: 'security' | 'safety' | 'completeness' | 'documentation';
  checked: boolean;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_TICKETS: LoadingTicket[] = [
  {
    id: 'DT-2026-0051',
    customer: 'Mark Henderson',
    jobName: 'Henderson Full Reroof',
    address: '1482 Oak Valley Dr, Huntsville, AL 35801',
    phone: '(256) 555-1234',
    priority: 'urgent',
    status: 'loading',
    scheduledTime: '07:30 AM',
    scheduledDate: '2026-02-10',
    driverName: 'Carlos Rivera',
    driverId: 'driver-1',
    vehicle: 'Ford F-350 #12',
    vehicleType: 'flatbed',
    vehicleCapacityLbs: 6000,
    loadingBay: 1,
    loadingStartTime: '06:45 AM',
    loadingEndTime: null,
    materials: [
      { id: 'm1', name: 'GAF Timberline HDZ Shingles (Charcoal)', quantity: 48, unit: 'bundles', weightLbs: 3360, category: 'heavy', pulled: true, loaded: true, flagged: false },
      { id: 'm2', name: 'GAF FeltBuster Synthetic Underlayment', quantity: 6, unit: 'rolls', weightLbs: 264, category: 'medium', pulled: true, loaded: true, flagged: false },
      { id: 'm3', name: 'Ice & Water Shield', quantity: 4, unit: 'rolls', weightLbs: 260, category: 'heavy', pulled: true, loaded: false, flagged: false },
      { id: 'm4', name: 'Drip Edge Flashing (10ft, White)', quantity: 32, unit: 'pieces', weightLbs: 96, category: 'light', pulled: true, loaded: false, flagged: false },
      { id: 'm5', name: 'Ridge Cap Shingles', quantity: 8, unit: 'bundles', weightLbs: 280, category: 'medium', pulled: true, loaded: false, flagged: false },
      { id: 'm6', name: '1.25" Galvanized Roofing Nails', quantity: 6, unit: 'boxes', weightLbs: 30, category: 'light', pulled: true, loaded: false, flagged: false },
      { id: 'm7', name: 'Pipe Boot Flashing (2")', quantity: 4, unit: 'pieces', weightLbs: 8, category: 'fragile', pulled: true, loaded: false, flagged: false },
      { id: 'm8', name: 'Starter Strip Shingles', quantity: 6, unit: 'bundles', weightLbs: 180, category: 'medium', pulled: false, loaded: false, flagged: false },
    ],
    qcPassed: null,
    qcNotes: '',
    photosTaken: 1,
    photosRequired: 3,
  },
  {
    id: 'DT-2026-0052',
    customer: 'Sarah Whitfield',
    jobName: 'Whitfield Insurance Repair',
    address: '305 Monroe St SW, Decatur, AL 35601',
    phone: '(256) 555-8877',
    priority: 'rush',
    status: 'materials_pulled',
    scheduledTime: '09:00 AM',
    scheduledDate: '2026-02-10',
    driverName: 'Carlos Rivera',
    driverId: 'driver-1',
    vehicle: 'Ford F-350 #12',
    vehicleType: 'flatbed',
    vehicleCapacityLbs: 6000,
    loadingBay: null,
    loadingStartTime: null,
    loadingEndTime: null,
    materials: [
      { id: 'n1', name: 'CertainTeed Landmark Shingles (Moire Black)', quantity: 24, unit: 'bundles', weightLbs: 1680, category: 'heavy', pulled: true, loaded: false, flagged: false },
      { id: 'n2', name: 'Synthetic Underlayment (4ft x 250ft)', quantity: 3, unit: 'rolls', weightLbs: 132, category: 'medium', pulled: true, loaded: false, flagged: false },
      { id: 'n3', name: 'Step Flashing (Aluminum, 5x7)', quantity: 50, unit: 'pieces', weightLbs: 25, category: 'light', pulled: true, loaded: false, flagged: false },
      { id: 'n4', name: 'Plywood Decking Sheets (4x8 CDX)', quantity: 10, unit: 'sheets', weightLbs: 500, category: 'heavy', pulled: true, loaded: false, flagged: false },
      { id: 'n5', name: 'Roof Cement (1 gal)', quantity: 3, unit: 'cans', weightLbs: 33, category: 'medium', pulled: true, loaded: false, flagged: false },
    ],
    qcPassed: null,
    qcNotes: '',
    photosTaken: 0,
    photosRequired: 3,
  },
  {
    id: 'DT-2026-0053',
    customer: 'David Thompson',
    jobName: 'Thompson Gutter Install',
    address: '920 Bailey Cove Rd, Huntsville, AL 35802',
    phone: '(256) 555-3301',
    priority: 'normal',
    status: 'assigned',
    scheduledTime: '11:00 AM',
    scheduledDate: '2026-02-10',
    driverName: 'Marcus Johnson',
    driverId: 'driver-2',
    vehicle: 'Chevy 3500 #07',
    vehicleType: 'pickup',
    vehicleCapacityLbs: 4000,
    loadingBay: null,
    loadingStartTime: null,
    loadingEndTime: null,
    materials: [
      { id: 'g1', name: '5" K-Style Aluminum Gutter (10ft, White)', quantity: 16, unit: 'pieces', weightLbs: 96, category: 'medium', pulled: false, loaded: false, flagged: false },
      { id: 'g2', name: '3x4 Aluminum Downspout (10ft, White)', quantity: 8, unit: 'pieces', weightLbs: 32, category: 'light', pulled: false, loaded: false, flagged: false },
      { id: 'g3', name: 'Gutter Hangers (Hidden, with screws)', quantity: 80, unit: 'pieces', weightLbs: 24, category: 'light', pulled: false, loaded: false, flagged: false },
      { id: 'g4', name: 'Gutter Sealant Caulk', quantity: 6, unit: 'tubes', weightLbs: 6, category: 'fragile', pulled: false, loaded: false, flagged: false },
      { id: 'g5', name: 'Splash Blocks', quantity: 4, unit: 'pieces', weightLbs: 28, category: 'medium', pulled: false, loaded: false, flagged: false },
    ],
    qcPassed: null,
    qcNotes: '',
    photosTaken: 0,
    photosRequired: 2,
  },
  {
    id: 'DT-2026-0054',
    customer: 'James Oakley',
    jobName: 'Oakley Storm Damage Repair',
    address: '4215 University Dr NW, Huntsville, AL 35816',
    phone: '(256) 555-7712',
    priority: 'urgent',
    status: 'assigned',
    scheduledTime: '08:00 AM',
    scheduledDate: '2026-02-10',
    driverName: 'Marcus Johnson',
    driverId: 'driver-2',
    vehicle: 'Chevy 3500 #07',
    vehicleType: 'pickup',
    vehicleCapacityLbs: 4000,
    loadingBay: null,
    loadingStartTime: null,
    loadingEndTime: null,
    materials: [
      { id: 'o1', name: 'Owens Corning Duration Shingles (Onyx Black)', quantity: 15, unit: 'bundles', weightLbs: 1050, category: 'heavy', pulled: false, loaded: false, flagged: false },
      { id: 'o2', name: 'Synthetic Underlayment Roll', quantity: 2, unit: 'rolls', weightLbs: 88, category: 'medium', pulled: false, loaded: false, flagged: false },
      { id: 'o3', name: 'Plywood Decking (4x8 CDX)', quantity: 6, unit: 'sheets', weightLbs: 300, category: 'heavy', pulled: false, loaded: false, flagged: false },
      { id: 'o4', name: 'Roofing Nails (1.25")', quantity: 3, unit: 'boxes', weightLbs: 15, category: 'light', pulled: false, loaded: false, flagged: false },
      { id: 'o5', name: 'Roof Sealant', quantity: 2, unit: 'tubes', weightLbs: 4, category: 'fragile', pulled: false, loaded: false, flagged: false },
    ],
    qcPassed: null,
    qcNotes: '',
    photosTaken: 0,
    photosRequired: 2,
  },
  {
    id: 'DT-2026-0055',
    customer: 'Linda Prescott',
    jobName: 'Prescott Skylight + Reroof',
    address: '702 Chateau Dr SE, Huntsville, AL 35803',
    phone: '(256) 555-4490',
    priority: 'rush',
    status: 'loading',
    scheduledTime: '10:00 AM',
    scheduledDate: '2026-02-10',
    driverName: 'Tony Ramirez',
    driverId: 'driver-3',
    vehicle: 'Box Truck #03',
    vehicleType: 'box_truck',
    vehicleCapacityLbs: 10000,
    loadingBay: 2,
    loadingStartTime: '07:15 AM',
    loadingEndTime: null,
    materials: [
      { id: 'p1', name: 'GAF Timberline HDZ Shingles (Pewter Gray)', quantity: 55, unit: 'bundles', weightLbs: 3850, category: 'heavy', pulled: true, loaded: true, flagged: false },
      { id: 'p2', name: 'Velux FCM Skylight (22x46)', quantity: 2, unit: 'units', weightLbs: 90, category: 'fragile', pulled: true, loaded: false, flagged: false },
      { id: 'p3', name: 'Skylight Flashing Kit', quantity: 2, unit: 'kits', weightLbs: 24, category: 'medium', pulled: true, loaded: false, flagged: false },
      { id: 'p4', name: 'Ice & Water Shield', quantity: 6, unit: 'rolls', weightLbs: 390, category: 'heavy', pulled: true, loaded: true, flagged: false },
      { id: 'p5', name: 'GAF FeltBuster Underlayment', quantity: 8, unit: 'rolls', weightLbs: 352, category: 'medium', pulled: true, loaded: true, flagged: false },
      { id: 'p6', name: 'Ridge Vent (4ft sections)', quantity: 12, unit: 'pieces', weightLbs: 60, category: 'medium', pulled: true, loaded: false, flagged: false },
      { id: 'p7', name: 'Drip Edge Flashing (10ft, Brown)', quantity: 40, unit: 'pieces', weightLbs: 120, category: 'light', pulled: true, loaded: false, flagged: false },
      { id: 'p8', name: 'Pipe Boot Flashing (3")', quantity: 5, unit: 'pieces', weightLbs: 10, category: 'fragile', pulled: true, loaded: false, flagged: true, flagReason: 'Only 3 in stock, 2 on backorder' },
      { id: 'p9', name: 'Ridge Cap Shingles', quantity: 10, unit: 'bundles', weightLbs: 350, category: 'medium', pulled: true, loaded: false, flagged: false },
    ],
    qcPassed: null,
    qcNotes: '',
    photosTaken: 2,
    photosRequired: 4,
  },
  {
    id: 'DT-2026-0056',
    customer: 'Robert Chang',
    jobName: 'Chang Commercial Flat Roof',
    address: '1100 Memorial Pkwy S, Huntsville, AL 35801',
    phone: '(256) 555-2200',
    priority: 'normal',
    status: 'materials_pulled',
    scheduledTime: '01:00 PM',
    scheduledDate: '2026-02-10',
    driverName: 'Tony Ramirez',
    driverId: 'driver-3',
    vehicle: 'Box Truck #03',
    vehicleType: 'box_truck',
    vehicleCapacityLbs: 10000,
    loadingBay: null,
    loadingStartTime: null,
    loadingEndTime: null,
    materials: [
      { id: 'c1', name: 'TPO Roofing Membrane (10ft wide)', quantity: 4, unit: 'rolls', weightLbs: 1200, category: 'heavy', pulled: true, loaded: false, flagged: false },
      { id: 'c2', name: 'ISO Insulation Board (4x8, 2")', quantity: 40, unit: 'sheets', weightLbs: 400, category: 'medium', pulled: true, loaded: false, flagged: false },
      { id: 'c3', name: 'TPO Adhesive (5 gal buckets)', quantity: 6, unit: 'buckets', weightLbs: 270, category: 'heavy', pulled: true, loaded: false, flagged: false },
      { id: 'c4', name: 'Edge Metal (10ft, Aluminum)', quantity: 24, unit: 'pieces', weightLbs: 72, category: 'light', pulled: true, loaded: false, flagged: false },
      { id: 'c5', name: 'TPO Seam Tape (3" x 100ft)', quantity: 8, unit: 'rolls', weightLbs: 32, category: 'light', pulled: true, loaded: false, flagged: false },
    ],
    qcPassed: null,
    qcNotes: '',
    photosTaken: 0,
    photosRequired: 3,
  },
  {
    id: 'DT-2026-0057',
    customer: 'Angela Morris',
    jobName: 'Morris Shingle Replacement',
    address: '3388 Governors Dr SW, Huntsville, AL 35805',
    phone: '(256) 555-6644',
    priority: 'normal',
    status: 'loaded',
    scheduledTime: '02:30 PM',
    scheduledDate: '2026-02-10',
    driverName: 'Carlos Rivera',
    driverId: 'driver-1',
    vehicle: 'Ford F-350 #12',
    vehicleType: 'flatbed',
    vehicleCapacityLbs: 6000,
    loadingBay: 3,
    loadingStartTime: '05:30 AM',
    loadingEndTime: '06:05 AM',
    materials: [
      { id: 'a1', name: 'GAF Timberline HDZ Shingles (Barkwood)', quantity: 30, unit: 'bundles', weightLbs: 2100, category: 'heavy', pulled: true, loaded: true, flagged: false },
      { id: 'a2', name: 'Synthetic Underlayment', quantity: 4, unit: 'rolls', weightLbs: 176, category: 'medium', pulled: true, loaded: true, flagged: false },
      { id: 'a3', name: 'Starter Strip Shingles', quantity: 4, unit: 'bundles', weightLbs: 120, category: 'medium', pulled: true, loaded: true, flagged: false },
      { id: 'a4', name: 'Roofing Nails (1.25")', quantity: 4, unit: 'boxes', weightLbs: 20, category: 'light', pulled: true, loaded: true, flagged: false },
      { id: 'a5', name: 'Ridge Cap Shingles', quantity: 4, unit: 'bundles', weightLbs: 140, category: 'medium', pulled: true, loaded: true, flagged: false },
    ],
    qcPassed: null,
    qcNotes: '',
    photosTaken: 3,
    photosRequired: 3,
  },
  {
    id: 'DT-2026-0058',
    customer: 'Kevin Walsh',
    jobName: 'Walsh Emergency Tarp & Repair',
    address: '560 Jordan Ln NW, Huntsville, AL 35805',
    phone: '(256) 555-9933',
    priority: 'urgent',
    status: 'materials_pulled',
    scheduledTime: '07:00 AM',
    scheduledDate: '2026-02-10',
    driverName: 'Marcus Johnson',
    driverId: 'driver-2',
    vehicle: 'Chevy 3500 #07',
    vehicleType: 'pickup',
    vehicleCapacityLbs: 4000,
    loadingBay: null,
    loadingStartTime: null,
    loadingEndTime: null,
    materials: [
      { id: 'w1', name: 'Heavy Duty Blue Tarp (20x30)', quantity: 2, unit: 'tarps', weightLbs: 30, category: 'medium', pulled: true, loaded: false, flagged: false },
      { id: 'w2', name: 'CertainTeed Landmark Shingles (Weathered Wood)', quantity: 10, unit: 'bundles', weightLbs: 700, category: 'heavy', pulled: true, loaded: false, flagged: false },
      { id: 'w3', name: 'Plywood Decking (4x8 CDX)', quantity: 4, unit: 'sheets', weightLbs: 200, category: 'heavy', pulled: true, loaded: false, flagged: false },
      { id: 'w4', name: 'Roofing Nails (1.25")', quantity: 2, unit: 'boxes', weightLbs: 10, category: 'light', pulled: true, loaded: false, flagged: false },
      { id: 'w5', name: 'Roof Sealant Tubes', quantity: 4, unit: 'tubes', weightLbs: 8, category: 'fragile', pulled: true, loaded: false, flagged: false },
      { id: 'w6', name: 'Bungee Cords & Rope Kit', quantity: 1, unit: 'kit', weightLbs: 5, category: 'light', pulled: true, loaded: false, flagged: false },
    ],
    qcPassed: null,
    qcNotes: '',
    photosTaken: 0,
    photosRequired: 2,
  },
];

const MOCK_HISTORY: LoadHistoryEntry[] = [
  { id: 'h1', ticketId: 'DT-2026-0044', customer: 'Anderson Reroof', driver: 'Carlos Rivera', date: '2026-02-09', loadTimeMinutes: 32, totalWeight: 4200, itemCount: 7, itemsCorrect: 7, itemsFlagged: 0, vehicleType: 'flatbed', qcPassed: true },
  { id: 'h2', ticketId: 'DT-2026-0045', customer: 'Baker Gutter Job', driver: 'Marcus Johnson', date: '2026-02-09', loadTimeMinutes: 18, totalWeight: 280, itemCount: 6, itemsCorrect: 6, itemsFlagged: 0, vehicleType: 'pickup', qcPassed: true },
  { id: 'h3', ticketId: 'DT-2026-0046', customer: 'Collins Emergency', driver: 'Tony Ramirez', date: '2026-02-09', loadTimeMinutes: 15, totalWeight: 980, itemCount: 4, itemsCorrect: 3, itemsFlagged: 1, vehicleType: 'box_truck', qcPassed: false },
  { id: 'h4', ticketId: 'DT-2026-0047', customer: 'Davis Full Reroof', driver: 'Carlos Rivera', date: '2026-02-08', loadTimeMinutes: 45, totalWeight: 5800, itemCount: 9, itemsCorrect: 9, itemsFlagged: 0, vehicleType: 'flatbed', qcPassed: true },
  { id: 'h5', ticketId: 'DT-2026-0048', customer: 'Evans Repair', driver: 'Marcus Johnson', date: '2026-02-08', loadTimeMinutes: 22, totalWeight: 1500, itemCount: 5, itemsCorrect: 5, itemsFlagged: 0, vehicleType: 'pickup', qcPassed: true },
  { id: 'h6', ticketId: 'DT-2026-0049', customer: 'Foster Commercial', driver: 'Tony Ramirez', date: '2026-02-08', loadTimeMinutes: 55, totalWeight: 8200, itemCount: 12, itemsCorrect: 11, itemsFlagged: 1, vehicleType: 'box_truck', qcPassed: true },
  { id: 'h7', ticketId: 'DT-2026-0050', customer: 'Grant Skylight', driver: 'Carlos Rivera', date: '2026-02-07', loadTimeMinutes: 38, totalWeight: 3400, itemCount: 8, itemsCorrect: 8, itemsFlagged: 0, vehicleType: 'flatbed', qcPassed: true },
];

const LOADING_BAYS = [
  { id: 1, name: 'Bay 1', status: 'occupied' as const, ticketId: 'DT-2026-0051' },
  { id: 2, name: 'Bay 2', status: 'occupied' as const, ticketId: 'DT-2026-0055' },
  { id: 3, name: 'Bay 3', status: 'available' as const, ticketId: null },
];

const VEHICLE_CAPACITIES: Record<VehicleType, { label: string; maxLbs: number }> = {
  pickup: { label: 'Pickup Truck', maxLbs: 4000 },
  flatbed: { label: 'Flatbed Truck', maxLbs: 6000 },
  box_truck: { label: 'Box Truck', maxLbs: 10000 },
  trailer: { label: 'Trailer', maxLbs: 14000 },
  van: { label: 'Cargo Van', maxLbs: 3000 },
};

const DRIVERS = [
  { id: 'driver-1', name: 'Carlos Rivera' },
  { id: 'driver-2', name: 'Marcus Johnson' },
  { id: 'driver-3', name: 'Tony Ramirez' },
];

const DEFAULT_QC_ITEMS: QCCheckItem[] = [
  { id: 'qc1', label: 'All materials present and match ticket', category: 'completeness', checked: false },
  { id: 'qc2', label: 'Material quantities verified', category: 'completeness', checked: false },
  { id: 'qc3', label: 'No damaged items loaded', category: 'completeness', checked: false },
  { id: 'qc4', label: 'Load secured with ratchet straps (every 4ft)', category: 'security', checked: false },
  { id: 'qc5', label: 'Nothing overhanging past tailgate without flag', category: 'security', checked: false },
  { id: 'qc6', label: 'Load height under 13\'6"', category: 'security', checked: false },
  { id: 'qc7', label: 'Weight distributed evenly (side to side)', category: 'security', checked: false },
  { id: 'qc8', label: 'Tarps/covers applied if rain expected', category: 'safety', checked: false },
  { id: 'qc9', label: 'Fragile items protected and on top', category: 'safety', checked: false },
  { id: 'qc10', label: 'Loaded photo taken (full truck view)', category: 'documentation', checked: false },
  { id: 'qc11', label: 'Ticket photo taken (ticket next to load)', category: 'documentation', checked: false },
  { id: 'qc12', label: 'Driver confirmed delivery address in GPS', category: 'documentation', checked: false },
];

// ============================================================================
// Helpers
// ============================================================================

function getPriorityColor(p: TicketPriority) {
  switch (p) {
    case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'rush': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default: return 'bg-zinc-700/50 text-zinc-400 border-zinc-600';
  }
}

function getPriorityOrder(p: TicketPriority) {
  switch (p) { case 'urgent': return 0; case 'rush': return 1; default: return 2; }
}

function getStatusColor(s: TicketStatus) {
  switch (s) {
    case 'assigned': return 'bg-brand-green/20 text-blue-400 border-blue-500/30';
    case 'materials_pulled': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'loading': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'loaded': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'qc_passed': return 'bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14]/30';
    case 'dispatched': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  }
}

function getStatusLabel(s: TicketStatus) {
  switch (s) {
    case 'assigned': return 'Assigned';
    case 'materials_pulled': return 'Materials Pulled';
    case 'loading': return 'Loading';
    case 'loaded': return 'Loaded';
    case 'qc_passed': return 'QC Passed';
    case 'dispatched': return 'Dispatched';
  }
}

function getCategoryBadge(c: MaterialCategory) {
  switch (c) {
    case 'heavy': return 'bg-red-500/20 text-red-400';
    case 'medium': return 'bg-amber-500/20 text-amber-400';
    case 'light': return 'bg-brand-green/20 text-blue-400';
    case 'fragile': return 'bg-purple-500/20 text-purple-400';
  }
}

function getTicketWeight(t: LoadingTicket) {
  return t.materials.reduce((sum, m) => sum + m.weightLbs, 0);
}

function getLoadedWeight(t: LoadingTicket) {
  return t.materials.filter(m => m.loaded).reduce((sum, m) => sum + m.weightLbs, 0);
}

function getWeightPercent(weight: number, capacity: number) {
  return Math.min(100, Math.round((weight / capacity) * 100));
}

function getWeightBarColor(pct: number) {
  if (pct >= 95) return 'bg-red-500';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-[#39FF14]';
}

// ============================================================================
// Component
// ============================================================================

export default function LoadingManagementPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('queue');
  const [tickets, setTickets] = useState<LoadingTicket[]>(MOCK_TICKETS);
  const [history, setHistory] = useState<LoadHistoryEntry[]>(MOCK_HISTORY);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchLoadingData();
  }, []);

  async function fetchLoadingData() {
    setIsPageLoading(true);
    setFetchError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/portal/deliveries?date=${today}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      const apiDeliveries = data.data?.deliveries || data.deliveries || [];

      if (apiDeliveries.length > 0) {
        const mappedTickets: LoadingTicket[] = apiDeliveries.map((d: any, idx: number) => ({
          id: d.ticketId || d.id || d.deliveryId || `DT-${Date.now()}-${idx}`,
          customer: d.customerName || d.customer_name || 'Customer',
          jobName: d.jobName || d.job_name || 'Delivery',
          address: d.address ? `${d.address}, ${d.city || ''}, ${d.state || 'AL'} ${d.zip || ''}` : d.jobAddress || '',
          phone: d.customerPhone || d.customer_phone || '',
          priority: d.priority || 'normal',
          status: d.status || 'assigned',
          scheduledTime: d.scheduledTime || d.scheduled_time || '',
          scheduledDate: d.scheduledDate || d.scheduled_date || today,
          driverName: d.driverName || d.assignedDriverName || 'Unassigned',
          driverId: d.driverId || d.assignedDriver || 'driver-1',
          vehicle: d.vehicle || d.assignedVehicle || 'TBD',
          vehicleType: (d.vehicleType || 'flatbed') as VehicleType,
          vehicleCapacityLbs: d.vehicleCapacityLbs || 6000,
          loadingBay: d.loadingBay || null,
          loadingStartTime: d.loadingStartTime || null,
          loadingEndTime: d.loadingEndTime || null,
          materials: (d.materials || []).map((m: any, mIdx: number) => ({
            id: m.id || `mat-${mIdx}`,
            name: m.name || m.productName || m.product_name || 'Material',
            quantity: m.quantity || 0,
            unit: m.unit || 'ea',
            weightLbs: m.weightLbs || m.weight || 0,
            category: (['heavy', 'medium', 'light', 'fragile'].includes(m.category) ? m.category : 'medium') as MaterialCategory,
            pulled: m.pulled ?? false,
            loaded: m.loaded ?? false,
            flagged: m.flagged ?? false,
            flagReason: m.flagReason || undefined,
          })),
          qcPassed: d.qcPassed ?? null,
          qcNotes: d.qcNotes || '',
          photosTaken: d.photosTaken || 0,
          photosRequired: d.photosRequired || 3,
        }));

        setTickets(mappedTickets);
        setIsUsingMockData(false);
      } else {
        setTickets(MOCK_TICKETS);
        setHistory(MOCK_HISTORY);
        setIsUsingMockData(true);
      }
    } catch (err) {
      console.error('Failed to fetch loading data:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load');
      setTickets(MOCK_TICKETS);
      setHistory(MOCK_HISTORY);
      setIsUsingMockData(true);
    } finally {
      setIsPageLoading(false);
    }
  }

  // Filters
  const [filterDriver, setFilterDriver] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('2026-02-10');
  const [searchQuery, setSearchQuery] = useState('');

  // Active loading timers
  const [timers, setTimers] = useState<Record<string, number>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // QC state
  const [qcTicketId, setQcTicketId] = useState<string | null>(null);
  const [qcItems, setQcItems] = useState<QCCheckItem[]>(DEFAULT_QC_ITEMS.map(i => ({ ...i })));
  const [qcNotes, setQcNotes] = useState('');
  const [qcIssueLog, setQcIssueLog] = useState('');

  // Vehicle capacity planner
  const [plannerVehicle, setPlannerVehicle] = useState<VehicleType>('flatbed');
  const [plannerTickets, setPlannerTickets] = useState<Set<string>>(new Set());

  // History filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyDriver, setHistoryDriver] = useState<string>('all');

  // Expanded ticket in active tab
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  // Timer effect for active loading tickets
  useEffect(() => {
    const activeTickets = tickets.filter(t => t.status === 'loading');
    if (activeTickets.length > 0) {
      timerRef.current = setInterval(() => {
        setTimers(prev => {
          const next = { ...prev };
          activeTickets.forEach(t => {
            next[t.id] = (next[t.id] || 0) + 1;
          });
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tickets]);

  // Init timers from mock start times
  useEffect(() => {
    const initial: Record<string, number> = {};
    tickets.forEach(t => {
      if (t.status === 'loading' && t.loadingStartTime) {
        // Simulate elapsed time
        if (t.id === 'DT-2026-0051') initial[t.id] = 42 * 60 + 15;
        if (t.id === 'DT-2026-0055') initial[t.id] = 28 * 60 + 33;
      }
    });
    setTimers(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ── Actions ──

  const handleStartLoading = (ticketId: string, bay: number) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, status: 'loading' as TicketStatus, loadingBay: bay, loadingStartTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) } : t
    ));
    setTimers(prev => ({ ...prev, [ticketId]: 0 }));
  };

  const handleToggleItemLoaded = (ticketId: string, materialId: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? {
        ...t,
        materials: t.materials.map(m =>
          m.id === materialId ? { ...m, loaded: !m.loaded } : m
        ),
      } : t
    ));
  };

  const handleFlagItem = (ticketId: string, materialId: string, reason: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? {
        ...t,
        materials: t.materials.map(m =>
          m.id === materialId ? { ...m, flagged: true, flagReason: reason } : m
        ),
      } : t
    ));
  };

  const handleMarkLoaded = (ticketId: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, status: 'loaded' as TicketStatus, loadingEndTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) } : t
    ));
  };

  const handleQcToggle = (id: string) => {
    setQcItems(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const handleQcSubmit = (ticketId: string, passed: boolean) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, qcPassed: passed, qcNotes: qcNotes, status: passed ? 'qc_passed' as TicketStatus : 'loaded' as TicketStatus } : t
    ));
    setQcTicketId(null);
    setQcItems(DEFAULT_QC_ITEMS.map(i => ({ ...i })));
    setQcNotes('');
    setQcIssueLog('');
  };

  // ── Derived data ──

  const queueTickets = tickets
    .filter(t => ['assigned', 'materials_pulled'].includes(t.status))
    .filter(t => filterDriver === 'all' || t.driverId === filterDriver)
    .filter(t => filterPriority === 'all' || t.priority === filterPriority)
    .filter(t => !filterDate || t.scheduledDate === filterDate)
    .filter(t => !searchQuery || t.customer.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase()) || t.jobName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority) || a.scheduledTime.localeCompare(b.scheduledTime));

  const activeLoadingTickets = tickets.filter(t => t.status === 'loading');
  const loadedTickets = tickets.filter(t => t.status === 'loaded');

  const totalQueueWeight = queueTickets.reduce((s, t) => s + getTicketWeight(t), 0);
  const totalQueueMaterials = queueTickets.reduce((s, t) => s + t.materials.length, 0);

  const filteredHistory = history
    .filter(h => historyDriver === 'all' || h.driver === DRIVERS.find(d => d.id === historyDriver)?.name)
    .filter(h => !historySearch || h.customer.toLowerCase().includes(historySearch.toLowerCase()) || h.ticketId.toLowerCase().includes(historySearch.toLowerCase()));

  // Capacity planner data
  const plannerCapacity = VEHICLE_CAPACITIES[plannerVehicle].maxLbs;
  const plannerSelectedTickets = tickets.filter(t => plannerTickets.has(t.id));
  const plannerTotalWeight = plannerSelectedTickets.reduce((s, t) => s + getTicketWeight(t), 0);
  const plannerPct = getWeightPercent(plannerTotalWeight, plannerCapacity);

  // History stats
  const avgLoadTimeByDriver = DRIVERS.map(d => {
    const driverHistory = history.filter(h => h.driver === d.name);
    const avg = driverHistory.length > 0 ? Math.round(driverHistory.reduce((s, h) => s + h.loadTimeMinutes, 0) / driverHistory.length) : 0;
    return { ...d, avgTime: avg, loads: driverHistory.length };
  });

  const overallAccuracy = history.length > 0
    ? Math.round((history.reduce((s, h) => s + h.itemsCorrect, 0) / history.reduce((s, h) => s + h.itemCount, 0)) * 100)
    : 0;

  const qcPassRate = history.length > 0
    ? Math.round((history.filter(h => h.qcPassed).length / history.length) * 100)
    : 0;

  // QC Stats
  const qcCheckedCount = qcItems.filter(i => i.checked).length;
  const qcTotalCount = qcItems.length;
  const qcProgress = Math.round((qcCheckedCount / qcTotalCount) * 100);

  // Available bays for starting a load
  const availableBays = LOADING_BAYS.filter(b => {
    const occupiedByActive = activeLoadingTickets.find(t => t.loadingBay === b.id);
    return !occupiedByActive;
  });

  // ── Tab config ──

  const TABS: { key: TabKey; label: string; icon: typeof Package; count?: number }[] = [
    { key: 'queue', label: 'Loading Queue', icon: Layers, count: queueTickets.length },
    { key: 'active', label: 'Active Loading', icon: Truck, count: activeLoadingTickets.length },
    { key: 'capacity', label: 'Vehicle Planner', icon: BarChart3 },
    { key: 'history', label: 'History', icon: History },
    { key: 'qc', label: 'Quality Control', icon: Shield, count: loadedTickets.length },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/portal/delivery" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-[#39FF14]" />
                Loading Management
              </h1>
              <p className="text-sm text-zinc-400">Manage loading queue, active loads, vehicle capacity, and quality control</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/portal/delivery/loading-assist" className="px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:text-white hover:border-[#39FF14]/40 transition-colors flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#39FF14]" />
              Loading Assistant
            </Link>
          </div>
        </div>
      </header>

      {/* Loading State */}
      {isPageLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Loading warehouse data...</p>
        </div>
      )}

      {/* Demo Data Banner */}
      {isUsingMockData && !isPageLoading && (
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 mt-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">Demo Data - Waiting for real deliveries</p>
              <p className="text-xs text-amber-400/70">{fetchError ? `API Error: ${fetchError}` : 'No loading tickets found. Showing sample data.'}</p>
            </div>
            <button onClick={fetchLoadingData} className="px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors">Retry</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-zinc-900/50 border-b border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                      activeTab === tab.key ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
        {/* ============================================================ */}
        {/* TAB 1: Loading Queue */}
        {/* ============================================================ */}
        {activeTab === 'queue' && (
          <div>
            {/* Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Tickets in Queue</p>
                <p className="text-2xl font-bold text-white mt-1">{queueTickets.length}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Weight</p>
                <p className="text-2xl font-bold text-white mt-1">{totalQueueWeight.toLocaleString()} <span className="text-sm text-zinc-500">lbs</span></p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Materials Count</p>
                <p className="text-2xl font-bold text-white mt-1">{totalQueueMaterials}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Active Bays</p>
                <p className="text-2xl font-bold text-white mt-1">{activeLoadingTickets.length} <span className="text-sm text-zinc-500">/ 3</span></p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/30 outline-none"
                />
              </div>
              <select
                value={filterDriver}
                onChange={e => setFilterDriver(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#39FF14]/30 outline-none"
              >
                <option value="all">All Drivers</option>
                {DRIVERS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#39FF14]/30 outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="rush">Rush</option>
                <option value="normal">Normal</option>
              </select>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-zinc-500" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#39FF14]/30 outline-none"
                />
              </div>
            </div>

            {/* Queue Cards */}
            {queueTickets.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No tickets in queue</p>
                <p className="text-sm mt-1">All tickets have been loaded or are currently loading.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {queueTickets.map(ticket => {
                  const weight = getTicketWeight(ticket);
                  const capPct = getWeightPercent(weight, ticket.vehicleCapacityLbs);
                  return (
                    <div key={ticket.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
                      {/* Card Header */}
                      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-white">{ticket.id}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getStatusColor(ticket.status)}`}>
                          {getStatusLabel(ticket.status)}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="px-4 py-3 space-y-2">
                        <h3 className="text-sm font-semibold text-white">{ticket.customer}</h3>
                        <p className="text-xs text-zinc-500">{ticket.jobName}</p>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <Package className="w-3.5 h-3.5" />
                            {ticket.materials.length} items
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <Weight className="w-3.5 h-3.5" />
                            {weight.toLocaleString()} lbs
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <Clock className="w-3.5 h-3.5" />
                            {ticket.scheduledTime}
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <User className="w-3.5 h-3.5" />
                            {ticket.driverName}
                          </div>
                        </div>

                        {/* Weight capacity bar */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                            <span>Vehicle: {ticket.vehicle}</span>
                            <span>{capPct}% capacity</span>
                          </div>
                          <div className="w-full bg-zinc-800 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all ${getWeightBarColor(capPct)}`} style={{ width: `${capPct}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="px-4 py-3 border-t border-zinc-800/50">
                        {availableBays.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartLoading(ticket.id, availableBays[0].id)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors text-sm"
                            >
                              <Play className="w-4 h-4" />
                              Start Loading (Bay {availableBays[0].id})
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            All bays occupied - waiting for availability
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: Active Loading */}
        {/* ============================================================ */}
        {activeTab === 'active' && (
          <div>
            {/* Loading Bay Status */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {LOADING_BAYS.map(bay => {
                const occupant = activeLoadingTickets.find(t => t.loadingBay === bay.id);
                const isOccupied = !!occupant;
                return (
                  <div key={bay.id} className={`rounded-xl border p-4 ${
                    isOccupied ? 'bg-amber-500/5 border-amber-500/30' : 'bg-zinc-900 border-zinc-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-white">{bay.name}</h3>
                      <span className={`w-3 h-3 rounded-full ${isOccupied ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                    </div>
                    {isOccupied && occupant ? (
                      <div className="text-xs space-y-1">
                        <p className="text-white font-medium">{occupant.id}</p>
                        <p className="text-zinc-400">{occupant.customer}</p>
                        <div className="flex items-center gap-1 text-amber-400">
                          <Timer className="w-3 h-3" />
                          {formatTimer(timers[occupant.id] || 0)}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-green-400">Available</p>
                    )}
                  </div>
                );
              })}
            </div>

            {activeLoadingTickets.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <Truck className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No active loading operations</p>
                <p className="text-sm mt-1">Start loading from the queue tab.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeLoadingTickets.map(ticket => {
                  const totalWeight = getTicketWeight(ticket);
                  const loadedWeight = getLoadedWeight(ticket);
                  const loadedPct = getWeightPercent(loadedWeight, ticket.vehicleCapacityLbs);
                  const totalPct = getWeightPercent(totalWeight, ticket.vehicleCapacityLbs);
                  const materialsLoaded = ticket.materials.filter(m => m.loaded).length;
                  const materialsPulled = ticket.materials.filter(m => m.pulled).length;
                  const isExpanded = expandedTicket === ticket.id;
                  const allLoaded = materialsLoaded === ticket.materials.length;

                  return (
                    <div key={ticket.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      {/* Ticket header */}
                      <button
                        onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-bold text-white">{ticket.id}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                          </div>
                          <span className="text-sm text-zinc-300">{ticket.customer} - {ticket.jobName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Timer className="w-4 h-4 text-amber-400" />
                            <span className="font-mono text-amber-400 font-bold">{formatTimer(timers[ticket.id] || 0)}</span>
                          </div>
                          <div className="text-right text-xs text-zinc-500">
                            Bay {ticket.loadingBay} / {ticket.driverName}
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                        </div>
                      </button>

                      {/* Progress bar */}
                      <div className="px-5 pb-3">
                        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                          <span>{materialsLoaded}/{ticket.materials.length} items loaded ({materialsPulled} pulled)</span>
                          <span>{loadedWeight.toLocaleString()} / {ticket.vehicleCapacityLbs.toLocaleString()} lbs ({loadedPct}%)</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2.5 relative">
                          {/* Total weight outline */}
                          <div className="absolute h-2.5 rounded-full border border-zinc-600 opacity-30" style={{ width: `${totalPct}%` }} />
                          {/* Loaded weight fill */}
                          <div className={`h-2.5 rounded-full transition-all duration-300 ${getWeightBarColor(loadedPct)}`} style={{ width: `${loadedPct}%` }} />
                        </div>
                        {loadedPct >= 80 && (
                          <p className="text-[10px] mt-1 flex items-center gap-1 text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {loadedPct >= 95 ? 'Vehicle near maximum capacity!' : 'Approaching vehicle capacity limit'}
                          </p>
                        )}
                      </div>

                      {/* Expanded material checklist */}
                      {isExpanded && (
                        <div className="border-t border-zinc-800">
                          <div className="px-5 py-3">
                            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Material Checklist</h4>
                            <div className="space-y-2">
                              {ticket.materials.map(mat => (
                                <div key={mat.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                                  mat.loaded ? 'bg-[#39FF14]/5' : mat.flagged ? 'bg-red-500/5' : 'bg-zinc-800/30'
                                }`}>
                                  <button
                                    onClick={() => handleToggleItemLoaded(ticket.id, mat.id)}
                                    className="flex-shrink-0"
                                  >
                                    {mat.loaded ? (
                                      <CheckSquare className="w-5 h-5 text-[#39FF14]" />
                                    ) : (
                                      <Square className="w-5 h-5 text-zinc-600 hover:text-zinc-400" />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm ${mat.loaded ? 'text-[#39FF14] line-through' : 'text-white'}`}>
                                        {mat.name}
                                      </span>
                                      <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${getCategoryBadge(mat.category)}`}>
                                        {mat.category}
                                      </span>
                                      {mat.flagged && (
                                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-red-500/20 text-red-400 flex items-center gap-1">
                                          <Flag className="w-2.5 h-2.5" /> Flagged
                                        </span>
                                      )}
                                    </div>
                                    {mat.flagged && mat.flagReason && (
                                      <p className="text-[10px] text-red-400 mt-0.5">{mat.flagReason}</p>
                                    )}
                                  </div>
                                  <div className="text-right text-xs text-zinc-500 flex-shrink-0">
                                    <span className="text-white font-semibold">{mat.quantity}</span> {mat.unit}
                                    <br />{mat.weightLbs.toLocaleString()} lbs
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {!mat.pulled && (
                                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-zinc-700 text-zinc-400">Not pulled</span>
                                    )}
                                    {!mat.flagged && !mat.loaded && (
                                      <button
                                        onClick={() => handleFlagItem(ticket.id, mat.id, 'Missing / needs substitution')}
                                        className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        title="Flag missing item"
                                      >
                                        <Flag className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Photo reminder */}
                            <div className="mt-4 flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3">
                              <div className="flex items-center gap-2 text-xs">
                                <Camera className="w-4 h-4 text-[#39FF14]" />
                                <span className="text-zinc-400">Photos: {ticket.photosTaken}/{ticket.photosRequired} taken</span>
                              </div>
                              <button className="px-3 py-1.5 text-xs bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors flex items-center gap-1.5">
                                <Camera className="w-3 h-3" />
                                Take Photo
                              </button>
                            </div>

                            {/* Action buttons */}
                            <div className="mt-4 flex items-center gap-3">
                              {allLoaded && (
                                <button
                                  onClick={() => handleMarkLoaded(ticket.id)}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors text-sm"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Mark Load Complete
                                </button>
                              )}
                              <button className="px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-sm flex items-center gap-2 border border-zinc-700">
                                <RefreshCw className="w-4 h-4" />
                                Request Substitution
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: Vehicle Capacity Planner */}
        {/* ============================================================ */}
        {activeTab === 'capacity' && (
          <div>
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Vehicle Selector + Capacity Display */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">Select Vehicle Type</h3>
                  <div className="space-y-2">
                    {(Object.entries(VEHICLE_CAPACITIES) as [VehicleType, { label: string; maxLbs: number }][]).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => { setPlannerVehicle(key); setPlannerTickets(new Set()); }}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                          plannerVehicle === key
                            ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]'
                            : 'bg-zinc-800/30 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            {val.label}
                          </div>
                          <span className="text-xs opacity-70">{val.maxLbs.toLocaleString()} lbs</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">Weight Utilization</h3>
                  <div className="space-y-3">
                    <div className="text-center">
                      <span className="text-3xl font-bold text-white">{plannerTotalWeight.toLocaleString()}</span>
                      <span className="text-lg text-zinc-500"> / {plannerCapacity.toLocaleString()} lbs</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-6 rounded-full transition-all duration-500 flex items-center justify-center ${getWeightBarColor(plannerPct)}`}
                        style={{ width: `${Math.max(plannerPct, plannerPct > 0 ? 8 : 0)}%` }}
                      >
                        {plannerPct > 15 && (
                          <span className="text-xs font-bold text-black">{plannerPct}%</span>
                        )}
                      </div>
                      {/* Threshold markers */}
                      <div className="absolute top-0 bottom-0 left-[80%] w-px bg-amber-500/50" />
                      <div className="absolute top-0 bottom-0 left-[95%] w-px bg-red-500/50" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-600">
                      <span>0%</span>
                      <span className="text-amber-500">80%</span>
                      <span className="text-red-500">95%</span>
                      <span>100%</span>
                    </div>
                    {plannerPct >= 95 && (
                      <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        Over capacity limit! Remove tickets to reduce weight.
                      </div>
                    )}
                    {plannerPct >= 80 && plannerPct < 95 && (
                      <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        Approaching capacity. Check road conditions.
                      </div>
                    )}
                  </div>

                  {/* Optimal loading suggestion */}
                  {plannerSelectedTickets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Optimal Loading Order</h4>
                      <ol className="space-y-1.5">
                        {plannerSelectedTickets
                          .sort((a, b) => getTicketWeight(b) - getTicketWeight(a))
                          .map((t, i) => (
                            <li key={t.id} className="text-xs text-zinc-300 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">{i + 1}</span>
                              {t.id} ({getTicketWeight(t).toLocaleString()} lbs)
                            </li>
                          ))}
                      </ol>
                      <p className="text-[10px] text-zinc-600 mt-2">Heaviest first, closest to cab</p>
                    </div>
                  )}

                  {/* Vehicle recommendation */}
                  {plannerTotalWeight > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Recommended Vehicle</h4>
                      {(() => {
                        const sorted = (Object.entries(VEHICLE_CAPACITIES) as [VehicleType, { label: string; maxLbs: number }][])
                          .filter(([, v]) => v.maxLbs >= plannerTotalWeight)
                          .sort((a, b) => a[1].maxLbs - b[1].maxLbs);
                        const best = sorted[0];
                        if (!best) return <p className="text-xs text-red-400">No single vehicle can carry this load. Split into multiple trips.</p>;
                        return (
                          <div className="flex items-center gap-2 text-xs">
                            <Truck className="w-4 h-4 text-[#39FF14]" />
                            <span className="text-white font-medium">{best[1].label}</span>
                            <span className="text-zinc-500">({best[1].maxLbs.toLocaleString()} lbs, {getWeightPercent(plannerTotalWeight, best[1].maxLbs)}% utilized)</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Ticket Assignment */}
              <div className="lg:col-span-2">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Assign Tickets to Vehicle</h3>
                  <p className="text-xs text-zinc-500 mb-4">Click tickets to add or remove from the vehicle plan. Combine tickets for same-route efficiency.</p>

                  <div className="space-y-2">
                    {tickets.filter(t => ['assigned', 'materials_pulled'].includes(t.status)).map(ticket => {
                      const weight = getTicketWeight(ticket);
                      const isSelected = plannerTickets.has(ticket.id);
                      const wouldExceed = !isSelected && (plannerTotalWeight + weight) > plannerCapacity;

                      return (
                        <button
                          key={ticket.id}
                          onClick={() => {
                            setPlannerTickets(prev => {
                              const next = new Set(prev);
                              if (next.has(ticket.id)) {
                                next.delete(ticket.id);
                              } else if (!wouldExceed) {
                                next.add(ticket.id);
                              }
                              return next;
                            });
                          }}
                          disabled={wouldExceed}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-[#39FF14]/10 border-[#39FF14]/30'
                              : wouldExceed
                                ? 'bg-zinc-800/20 border-zinc-800 opacity-40 cursor-not-allowed'
                                : 'bg-zinc-800/30 border-zinc-700 hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-[#39FF14]" />
                              ) : (
                                <Square className="w-5 h-5 text-zinc-600" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-mono font-bold text-white">{ticket.id}</span>
                                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-0.5">{ticket.customer} - {ticket.address}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-white">{weight.toLocaleString()}</span>
                              <span className="text-xs text-zinc-500"> lbs</span>
                              <p className="text-[10px] text-zinc-500">{ticket.materials.length} items</p>
                            </div>
                          </div>
                          {/* Weight bars per material category */}
                          <div className="mt-2 flex gap-1">
                            {['heavy', 'medium', 'light', 'fragile'].map(cat => {
                              const catWeight = ticket.materials.filter(m => m.category === cat).reduce((s, m) => s + m.weightLbs, 0);
                              if (catWeight === 0) return null;
                              const barW = Math.max(4, (catWeight / weight) * 100);
                              return (
                                <div key={cat} className="flex items-center gap-1" style={{ width: `${barW}%` }}>
                                  <div className={`h-1.5 rounded-full flex-1 ${
                                    cat === 'heavy' ? 'bg-red-500/60' : cat === 'medium' ? 'bg-amber-500/60' : cat === 'light' ? 'bg-brand-green/60' : 'bg-purple-500/60'
                                  }`} />
                                </div>
                              );
                            })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: Loading History */}
        {/* ============================================================ */}
        {activeTab === 'history' && (
          <div>
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Loads</p>
                <p className="text-2xl font-bold text-white mt-1">{history.length}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Accuracy Rate</p>
                <p className="text-2xl font-bold text-[#39FF14] mt-1">{overallAccuracy}%</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">QC Pass Rate</p>
                <p className="text-2xl font-bold text-white mt-1">{qcPassRate}%</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Avg Load Time</p>
                <p className="text-2xl font-bold text-white mt-1">{Math.round(history.reduce((s, h) => s + h.loadTimeMinutes, 0) / Math.max(history.length, 1))} <span className="text-sm text-zinc-500">min</span></p>
              </div>
            </div>

            {/* Driver Performance */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Average Load Time by Driver</h3>
                <div className="space-y-3">
                  {avgLoadTimeByDriver.map(d => {
                    const maxTime = Math.max(...avgLoadTimeByDriver.map(x => x.avgTime), 1);
                    const barW = (d.avgTime / maxTime) * 100;
                    return (
                      <div key={d.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-zinc-300">{d.name}</span>
                          <span className="text-zinc-500">{d.avgTime} min ({d.loads} loads)</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-3">
                          <div className="bg-[#39FF14] h-3 rounded-full transition-all" style={{ width: `${barW}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Vehicle Utilization</h3>
                <div className="space-y-3">
                  {(Object.entries(VEHICLE_CAPACITIES) as [VehicleType, { label: string; maxLbs: number }][]).map(([key, val]) => {
                    const vehicleLoads = history.filter(h => h.vehicleType === key);
                    const avgUtil = vehicleLoads.length > 0
                      ? Math.round((vehicleLoads.reduce((s, h) => s + h.totalWeight, 0) / vehicleLoads.length / val.maxLbs) * 100)
                      : 0;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-zinc-300">{val.label}</span>
                          <span className="text-zinc-500">{avgUtil}% avg ({vehicleLoads.length} loads)</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-3">
                          <div className={`h-3 rounded-full transition-all ${getWeightBarColor(avgUtil)}`} style={{ width: `${avgUtil}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-sm font-semibold text-white">Completed Loads</h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-[#39FF14]/30 outline-none w-40"
                    />
                  </div>
                  <select
                    value={historyDriver}
                    onChange={e => setHistoryDriver(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#39FF14]/30 outline-none"
                  >
                    <option value="all">All Drivers</option>
                    {DRIVERS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                      <th className="px-5 py-3">Ticket</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Driver</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Weight</th>
                      <th className="px-5 py-3">Items</th>
                      <th className="px-5 py-3">QC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredHistory.map(h => (
                      <tr key={h.id} className="hover:bg-zinc-800/20">
                        <td className="px-5 py-3 font-mono text-xs text-white">{h.ticketId}</td>
                        <td className="px-5 py-3 text-zinc-300">{h.customer}</td>
                        <td className="px-5 py-3 text-zinc-400">{h.driver}</td>
                        <td className="px-5 py-3 text-zinc-400">{h.date}</td>
                        <td className="px-5 py-3 text-zinc-300">{h.loadTimeMinutes} min</td>
                        <td className="px-5 py-3 text-zinc-300">{h.totalWeight.toLocaleString()} lbs</td>
                        <td className="px-5 py-3">
                          <span className="text-zinc-300">{h.itemsCorrect}/{h.itemCount}</span>
                          {h.itemsFlagged > 0 && (
                            <span className="ml-1 text-red-400 text-xs">({h.itemsFlagged} flagged)</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {h.qcPassed ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#39FF14]/20 text-[#39FF14]">PASS</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400">FAIL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: Quality Control */}
        {/* ============================================================ */}
        {activeTab === 'qc' && (
          <div>
            {/* QC Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Awaiting QC</p>
                <p className="text-2xl font-bold text-white mt-1">{loadedTickets.length}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">QC Pass Rate (7d)</p>
                <p className="text-2xl font-bold text-[#39FF14] mt-1">{qcPassRate}%</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">QC Passed Today</p>
                <p className="text-2xl font-bold text-white mt-1">{tickets.filter(t => t.qcPassed === true).length}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">QC Failed Today</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{tickets.filter(t => t.qcPassed === false).length}</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Tickets awaiting QC */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Loads Awaiting Quality Check</h3>
                {loadedTickets.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No loads awaiting QC</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loadedTickets.map(ticket => (
                      <button
                        key={ticket.id}
                        onClick={() => {
                          setQcTicketId(ticket.id);
                          setQcItems(DEFAULT_QC_ITEMS.map(i => ({ ...i })));
                          setQcNotes('');
                          setQcIssueLog('');
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          qcTicketId === ticket.id
                            ? 'bg-[#39FF14]/10 border-[#39FF14]/30'
                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-bold text-white">{ticket.id}</span>
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">{ticket.customer} - {ticket.driverName}</p>
                          </div>
                          <div className="text-right text-xs">
                            <p className="text-zinc-300">{getTicketWeight(ticket).toLocaleString()} lbs</p>
                            <p className="text-zinc-500">{ticket.materials.length} items</p>
                          </div>
                        </div>
                        {ticket.materials.some(m => m.flagged) && (
                          <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                            <Flag className="w-3 h-3" />
                            {ticket.materials.filter(m => m.flagged).length} flagged items
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* QC Checklist */}
              <div>
                {qcTicketId ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-800">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">QC Checklist - {qcTicketId}</h3>
                        <button
                          onClick={() => setQcTicketId(null)}
                          className="text-zinc-500 hover:text-white transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-zinc-800 rounded-full h-2">
                          <div className="bg-[#39FF14] h-2 rounded-full transition-all" style={{ width: `${qcProgress}%` }} />
                        </div>
                        <span className="text-xs text-zinc-500">{qcCheckedCount}/{qcTotalCount}</span>
                      </div>
                    </div>

                    <div className="px-5 py-4 space-y-4">
                      {/* Group by category */}
                      {(['completeness', 'security', 'safety', 'documentation'] as const).map(cat => (
                        <div key={cat}>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                            {cat === 'completeness' ? 'Materials & Completeness' :
                             cat === 'security' ? 'Load Security' :
                             cat === 'safety' ? 'Safety & Protection' : 'Documentation'}
                          </h4>
                          <div className="space-y-1.5">
                            {qcItems.filter(i => i.category === cat).map(item => (
                              <button
                                key={item.id}
                                onClick={() => handleQcToggle(item.id)}
                                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                  item.checked ? 'bg-[#39FF14]/5' : 'hover:bg-zinc-800/50'
                                }`}
                              >
                                {item.checked ? (
                                  <CheckSquare className="w-4 h-4 text-[#39FF14] flex-shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                )}
                                <span className={`text-xs ${item.checked ? 'text-[#39FF14] line-through' : 'text-zinc-300'}`}>
                                  {item.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Photo requirements */}
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Photo Verification</h4>
                        <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2">
                          <Camera className="w-4 h-4 text-zinc-400" />
                          <span className="text-xs text-zinc-300">
                            {(() => {
                              const t = tickets.find(t => t.id === qcTicketId);
                              return t ? `${t.photosTaken}/${t.photosRequired} photos submitted` : '';
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Issue log */}
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Issue Log</h4>
                        <textarea
                          value={qcIssueLog}
                          onChange={e => setQcIssueLog(e.target.value)}
                          placeholder="Log any issues: damaged items, wrong quantities, missing materials..."
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-[#39FF14]/30 outline-none resize-none h-20"
                        />
                      </div>

                      {/* Sign-off notes */}
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">QC Notes / Sign-off</h4>
                        <textarea
                          value={qcNotes}
                          onChange={e => setQcNotes(e.target.value)}
                          placeholder="Add QC reviewer notes..."
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-[#39FF14]/30 outline-none resize-none h-16"
                        />
                      </div>

                      {/* Submit buttons */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() => handleQcSubmit(qcTicketId, true)}
                          disabled={qcCheckedCount < qcTotalCount}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          QC Pass
                        </button>
                        <button
                          onClick={() => handleQcSubmit(qcTicketId, false)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 font-semibold rounded-lg hover:bg-red-500/30 border border-red-500/30 transition-colors text-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          QC Fail
                        </button>
                      </div>

                      {qcCheckedCount < qcTotalCount && (
                        <p className="text-[10px] text-zinc-500 text-center">
                          Complete all {qcTotalCount} checklist items to enable QC Pass
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                    <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Select a load to inspect</p>
                    <p className="text-xs mt-1">Click a loaded ticket on the left to begin QC inspection.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
