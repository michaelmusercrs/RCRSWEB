'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Circle,
  CheckSquare,
  Square,
  Camera,
  Upload,
  Send,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image,
  X,
  FileText,
  ClipboardCheck,
  ArrowUpDown,
  Shield,
  RotateCcw,
  Undo2,
  AlertOctagon,
  MessageSquare,
  Info,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface MaterialItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  location: string;
  category: string;
  weight: number;
  loadOrder: number;
  notes?: string;
}

interface DeliveryForToday {
  ticketId: string;
  jobName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  scheduledDate: string;
  scheduledTime: string;
  priority: 'normal' | 'rush' | 'urgent';
  specialInstructions?: string;
  status: string;
  materials: MaterialItem[];
  vehicle: string;
  driverName: string;
}

interface PhotoUpload {
  id: string;
  file: File;
  preview: string;
  label: string;
  timestamp: Date;
}

// ============================================
// MOCK DATA - Today's deliveries
// ============================================

const MOCK_DELIVERIES: DeliveryForToday[] = [
  {
    ticketId: 'DEL-20260211-A1B2',
    jobName: 'Henderson Roof Replacement',
    customerName: 'Mark Henderson',
    customerPhone: '(256) 555-1234',
    address: '1482 Oak Valley Dr',
    city: 'Huntsville',
    state: 'AL',
    zip: '35801',
    scheduledDate: '2026-02-11',
    scheduledTime: '08:30 AM',
    priority: 'normal',
    specialInstructions: 'Gate code #4429. Stack shingles on south side of driveway. Customer has dogs - keep gate closed.',
    status: 'assigned',
    vehicle: 'Ford F-350 #12',
    driverName: 'Carlos Rivera',
    materials: [
      { id: 'm1', productId: 'INV-0001', productName: 'GAF Timberline HDZ - Charcoal', sku: 'GAF-THDZ-CHAR', quantity: 45, unit: 'bundles', location: 'A1-1-A', category: 'shingles', weight: 3150, loadOrder: 1, notes: 'Best seller - heavy, load first' },
      { id: 'm2', productId: 'INV-0005', productName: 'GAF FeltBuster Synthetic Underlayment', sku: 'GAF-FB-SYN', quantity: 6, unit: 'rolls', location: 'A2-1-A', category: 'underlayment', weight: 264, loadOrder: 2, notes: 'Store upright, keep dry' },
      { id: 'm3', productId: 'INV-0006', productName: 'Grace Ice & Water Shield', sku: 'GR-IWS-225', quantity: 4, unit: 'rolls', location: 'A2-1-B', category: 'underlayment', weight: 260, loadOrder: 3, notes: 'Premium product - handle carefully' },
      { id: 'm4', productId: 'INV-0028', productName: 'GAF TimberTex Hip & Ridge - Charcoal', sku: 'GAF-TTX-CHAR', quantity: 6, unit: 'bundles', location: 'A3-1-B', category: 'accessories', weight: 132, loadOrder: 4 },
      { id: 'm5', productId: 'INV-0009', productName: 'Galvanized Drip Edge 10ft - White', sku: 'GV-DE-10W', quantity: 30, unit: 'pieces', location: 'B1-1-B', category: 'flashing', weight: 90, loadOrder: 5, notes: 'Sharp edges - wear gloves' },
      { id: 'm6', productId: 'INV-0015', productName: '1-1/4" Coil Roofing Nails (7200ct)', sku: 'CN-114-7200', quantity: 3, unit: 'boxes', location: 'B2-1-A', category: 'nails_fasteners', weight: 90, loadOrder: 6 },
      { id: 'm7', productId: 'INV-0011', productName: 'Lead Pipe Flashing Boot 1.5-3 in', sku: 'LPF-BOOT-3', quantity: 3, unit: 'pieces', location: 'B1-2-A', category: 'flashing', weight: 7.5, loadOrder: 7, notes: 'Fragile rubber base - do not crush' },
    ],
  },
  {
    ticketId: 'DEL-20260211-C3D4',
    jobName: 'Whitfield Insurance Repair',
    customerName: 'Sarah Whitfield',
    customerPhone: '(256) 555-8877',
    address: '305 Monroe St SW',
    city: 'Decatur',
    state: 'AL',
    zip: '35601',
    scheduledDate: '2026-02-11',
    scheduledTime: '11:00 AM',
    priority: 'rush',
    specialInstructions: 'Insurance job - take before photos. Inspector at 11:30 AM. Use rear entrance for staging.',
    status: 'assigned',
    vehicle: 'Ford F-350 #12',
    driverName: 'Carlos Rivera',
    materials: [
      { id: 'n1', productId: 'INV-0004', productName: 'CertainTeed Landmark - Moire Black', sku: 'CT-LM-MB', quantity: 22, unit: 'bundles', location: 'A1-2-B', category: 'shingles', weight: 1540, loadOrder: 1 },
      { id: 'n2', productId: 'INV-0005', productName: 'GAF FeltBuster Synthetic Underlayment', sku: 'GAF-FB-SYN', quantity: 3, unit: 'rolls', location: 'A2-1-A', category: 'underlayment', weight: 132, loadOrder: 2 },
      { id: 'n3', productId: 'INV-0021', productName: '1x6x8 CDX Plywood (4x8 sheet)', sku: 'PLY-CDX-48', quantity: 8, unit: 'sheets', location: 'D1-1-A', category: 'lumber', weight: 384, loadOrder: 3, notes: 'Heavy stack - use ratchet straps. Keep dry.' },
      { id: 'n4', productId: 'INV-0027', productName: 'GAF Starter Strip Plus', sku: 'GAF-SSP', quantity: 4, unit: 'bundles', location: 'A3-1-A', category: 'accessories', weight: 80, loadOrder: 4 },
      { id: 'n5', productId: 'INV-0008', productName: 'Aluminum Step Flashing 4x4x8', sku: 'AL-SF-448', quantity: 50, unit: 'pieces', location: 'B1-1-A', category: 'flashing', weight: 10, loadOrder: 5, notes: 'Sharp - bundle with straps' },
      { id: 'n6', productId: 'INV-0018', productName: 'Henry 208 Wet Patch Roof Cement (gal)', sku: 'HEN-208-GAL', quantity: 2, unit: 'cans', location: 'B3-1-A', category: 'sealants', weight: 20, loadOrder: 6, notes: 'Keep upright - can stain truck bed' },
    ],
  },
  {
    ticketId: 'DEL-20260211-E5F6',
    jobName: 'Thompson Gutter Install',
    customerName: 'David Thompson',
    customerPhone: '(256) 555-3301',
    address: '920 Bailey Cove Rd',
    city: 'Huntsville',
    state: 'AL',
    zip: '35802',
    scheduledDate: '2026-02-11',
    scheduledTime: '2:00 PM',
    priority: 'normal',
    specialInstructions: 'Gutter-only job. Stage materials in garage. Ring doorbell on arrival.',
    status: 'assigned',
    vehicle: 'Chevy 3500 #07',
    driverName: 'Marcus Johnson',
    materials: [
      { id: 'g1', productId: 'INV-0012', productName: '5" K-Style Gutter - White (10ft)', sku: 'KG-5W-10', quantity: 16, unit: 'pieces', location: 'C1-1-A', category: 'gutters', weight: 96, loadOrder: 1, notes: 'Long pieces - flag overhang. Do not bend.' },
      { id: 'g2', productId: 'INV-0014', productName: 'Gutter Downspout 2x3 - White (10ft)', sku: 'DS-23W-10', quantity: 8, unit: 'pieces', location: 'C1-2-A', category: 'gutters', weight: 24, loadOrder: 2, notes: 'Nest together for transport' },
      { id: 'g3', productId: 'INV-0035', productName: 'Gutter Guard Screen 3ft - White', sku: 'GGS-3W', quantity: 24, unit: 'pieces', location: 'C1-3-A', category: 'gutters', weight: 12, loadOrder: 3 },
      { id: 'g4', productId: 'INV-0019', productName: 'DAP Dynaflex 230 Sealant - White', sku: 'DAP-230-W', quantity: 6, unit: 'tubes', location: 'B3-1-B', category: 'sealants', weight: 4.8, loadOrder: 4, notes: 'Store in cab - temp sensitive' },
    ],
  },
];

// ============================================
// COMPONENT
// ============================================

export default function LoadingChecklistPage() {
  // API data state
  const [allDeliveries, setAllDeliveries] = useState<DeliveryForToday[]>(MOCK_DELIVERIES);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  async function fetchDeliveries() {
    setIsLoading(true);
    setFetchError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/portal/deliveries?date=${today}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      const apiDeliveries = (data.data?.deliveries || data.deliveries || []).map((d: any) => ({
        ticketId: d.ticketId || d.id || d.deliveryId,
        jobName: d.jobName || d.job_name || 'Delivery',
        customerName: d.customerName || d.customer_name || 'Customer',
        customerPhone: d.customerPhone || d.customer_phone || '',
        address: d.address || d.jobAddress || '',
        city: d.city || '',
        state: d.state || 'AL',
        zip: d.zip || '',
        scheduledDate: d.scheduledDate || d.scheduled_date || today,
        scheduledTime: d.scheduledTime || d.scheduled_time || '',
        priority: d.priority || 'normal',
        specialInstructions: d.specialInstructions || d.special_instructions || '',
        status: d.status || 'assigned',
        vehicle: d.vehicle || d.assignedVehicle || 'TBD',
        driverName: d.driverName || d.assignedDriverName || 'Unassigned',
        materials: (d.materials || []).map((m: any, idx: number) => ({
          id: m.id || `mat-${idx}`,
          productId: m.productId || m.product_id || '',
          productName: m.productName || m.product_name || m.name || 'Material',
          sku: m.sku || '',
          quantity: m.quantity || 0,
          unit: m.unit || 'ea',
          location: m.location || '',
          category: m.category || 'accessories',
          weight: m.weight || m.weightLbs || 0,
          loadOrder: m.loadOrder || m.load_order || idx + 1,
          notes: m.notes || m.handlingTip || undefined,
        })),
      }));

      if (apiDeliveries.length > 0) {
        setAllDeliveries(apiDeliveries);
        setSelectedTicketId(apiDeliveries[0].ticketId);
        setIsUsingMockData(false);
      } else {
        setAllDeliveries(MOCK_DELIVERIES);
        setSelectedTicketId(MOCK_DELIVERIES[0].ticketId);
        setIsUsingMockData(true);
      }
    } catch (err) {
      console.error('Failed to fetch deliveries for checklist:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load deliveries');
      setAllDeliveries(MOCK_DELIVERIES);
      setSelectedTicketId(MOCK_DELIVERIES[0].ticketId);
      setIsUsingMockData(true);
    } finally {
      setIsLoading(false);
    }
  }

  // Delivery selection
  const [selectedTicketId, setSelectedTicketId] = useState<string>(MOCK_DELIVERIES[0].ticketId);
  const selectedDelivery = allDeliveries.find(d => d.ticketId === selectedTicketId) || allDeliveries[0];

  // Checklist state
  const [loadedItems, setLoadedItems] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Photo uploads
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [driverNotes, setDriverNotes] = useState('');

  // Damage / issue reporting
  const [showDamageReport, setShowDamageReport] = useState(false);
  const [damageItem, setDamageItem] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [damageReports, setDamageReports] = useState<{ item: string; description: string; timestamp: Date }[]>([]);

  // Return tracking
  const [returnItems, setReturnItems] = useState<Set<string>>(new Set());
  const [returnReason, setReturnReason] = useState('');

  // ============================================
  // HANDLERS
  // ============================================

  const toggleLoaded = (materialId: string) => {
    setLoadedItems(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const toggleReturn = (materialId: string) => {
    setReturnItems(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const preview = URL.createObjectURL(file);
      const newPhoto: PhotoUpload = {
        id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview,
        label: `Loaded truck photo ${photos.length + 1}`,
        timestamp: new Date(),
      };
      setPhotos(prev => [...prev, newPhoto]);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter(p => p.id !== photoId);
    });
  };

  const submitDamageReport = () => {
    if (!damageItem || !damageDescription.trim()) return;
    setDamageReports(prev => [...prev, {
      item: damageItem,
      description: damageDescription.trim(),
      timestamp: new Date(),
    }]);
    setDamageItem('');
    setDamageDescription('');
    setShowDamageReport(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In production, this would:
    // 1. Upload photos to Vercel Blob
    // 2. Update delivery ticket status to 'load_verified'
    // 3. Log the checklist completion
    // 4. Trigger IoT (green bay light)

    setSubmitting(false);
    setSubmitted(true);
  };

  const handleTicketChange = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setLoadedItems(new Set());
    setPhotos([]);
    setSubmitted(false);
    setDriverNotes('');
    setDamageReports([]);
    setReturnItems(new Set());
    setExpandedItem(null);
  };

  // ============================================
  // COMPUTED
  // ============================================

  const sortedMaterials = [...selectedDelivery.materials].sort((a, b) => a.loadOrder - b.loadOrder);
  const totalMaterials = selectedDelivery.materials.length;
  const loadedCount = selectedDelivery.materials.filter(m => loadedItems.has(m.id)).length;
  const progressPercent = totalMaterials > 0 ? (loadedCount / totalMaterials) * 100 : 0;
  const allLoaded = loadedCount === totalMaterials;
  const hasPhotos = photos.length > 0;
  const canSubmit = allLoaded && hasPhotos && !submitted;
  const totalWeight = selectedDelivery.materials.reduce((sum, m) => sum + m.weight, 0);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'rush': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-zinc-700 text-zinc-400 border-zinc-600';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'shingles': return 'bg-red-500/10 text-red-400';
      case 'underlayment': return 'bg-blue-500/10 text-blue-400';
      case 'flashing': return 'bg-amber-500/10 text-amber-400';
      case 'gutters': return 'bg-purple-500/10 text-purple-400';
      case 'nails_fasteners': return 'bg-zinc-700 text-zinc-300';
      case 'sealants': return 'bg-orange-500/10 text-orange-400';
      case 'lumber': return 'bg-yellow-500/10 text-yellow-400';
      case 'accessories': return 'bg-teal-500/10 text-teal-400';
      default: return 'bg-zinc-700 text-zinc-400';
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/delivery" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#39FF14]" />
                Loading Checklist
              </h1>
              <p className="text-sm text-zinc-400">
                Verify and confirm materials for delivery
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/portal/delivery/loading-assist"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Loading Assistant
            </Link>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-zinc-400">
            {loadedCount}/{totalMaterials} items loaded
          </span>
          <span className={`font-bold ${allLoaded ? 'text-[#39FF14]' : 'text-white'}`}>
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: allLoaded ? '#39FF14' : progressPercent > 50 ? '#84cc16' : '#eab308',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-xs mt-1.5 text-zinc-500">
          <span>Total weight: {totalWeight.toLocaleString()} lbs</span>
          <span>{photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded</span>
        </div>
      </div>

      {/* Delivery Selector */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-zinc-400">Delivery:</label>
          <select
            value={selectedTicketId}
            onChange={e => handleTicketChange(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50 outline-none flex-1 max-w-lg"
          >
            {allDeliveries.map(d => (
              <option key={d.ticketId} value={d.ticketId}>
                {d.ticketId} - {d.jobName} ({d.scheduledTime})
              </option>
            ))}
          </select>
          <span className={`px-2 py-1 text-xs font-bold rounded border ${getPriorityColor(selectedDelivery.priority)}`}>
            {selectedDelivery.priority.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Loading delivery data...</p>
        </div>
      )}

      {/* Demo Data Banner */}
      {isUsingMockData && !isLoading && (
        <div className="mx-4 sm:mx-6 mt-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">Demo Data - Waiting for real deliveries</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                {fetchError ? `API Error: ${fetchError}` : 'No deliveries found. Showing sample data.'}
              </p>
            </div>
            <button
              onClick={fetchDeliveries}
              className="px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Special Instructions */}
      {!isLoading && selectedDelivery.specialInstructions && (
        <div className="mx-4 sm:mx-6 mt-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-400 mb-1">Special Instructions</h3>
                <p className="text-sm text-amber-300/90 leading-relaxed">
                  {selectedDelivery.specialInstructions}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isLoading && (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Delivery Info Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Customer:</span>
              <span className="text-white font-medium">{selectedDelivery.customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Phone:</span>
              <a href={`tel:${selectedDelivery.customerPhone}`} className="text-[#39FF14] hover:underline">
                {selectedDelivery.customerPhone}
              </a>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-zinc-400">Address:</span>
              <span className="text-white">
                {selectedDelivery.address}, {selectedDelivery.city}, {selectedDelivery.state} {selectedDelivery.zip}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Time:</span>
              <span className="text-white">{selectedDelivery.scheduledTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Vehicle:</span>
              <span className="text-white">{selectedDelivery.vehicle}</span>
            </div>
          </div>
        </div>

        {/* Material Checklist */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-[#39FF14]" />
              <h2 className="text-base font-semibold text-white">Materials Checklist</h2>
            </div>
            <span className="text-sm text-zinc-400">
              Load order: heaviest first
            </span>
          </div>

          <div className="divide-y divide-zinc-800/50">
            {sortedMaterials.map(material => {
              const isLoaded = loadedItems.has(material.id);
              const isExpanded = expandedItem === material.id;
              const isReturn = returnItems.has(material.id);

              return (
                <div
                  key={material.id}
                  className={`transition-colors ${
                    isLoaded ? 'bg-[#39FF14]/5' : isReturn ? 'bg-red-500/5' : ''
                  }`}
                >
                  {/* Main Row */}
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleLoaded(material.id)}
                      className="shrink-0 mt-0.5"
                    >
                      {isLoaded ? (
                        <CheckSquare className="w-5 h-5 text-[#39FF14]" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-600 hover:text-zinc-400 transition-colors" />
                      )}
                    </button>

                    {/* Content */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedItem(isExpanded ? null : material.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${isLoaded ? 'text-[#39FF14] line-through' : 'text-white'}`}>
                              {material.productName}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getCategoryColor(material.category)}`}>
                              {material.category.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                            <span>SKU: {material.sku}</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {material.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3" />
                              Load #{material.loadOrder}
                            </span>
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-bold tabular-nums ${isLoaded ? 'text-[#39FF14]' : 'text-white'}`}>
                            {material.quantity}
                          </div>
                          <div className="text-[11px] text-zinc-500">{material.unit}</div>
                        </div>
                      </div>
                    </div>

                    {/* Expand Arrow */}
                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : material.id)}
                      className="shrink-0 mt-1"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pl-14">
                      <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-4 text-zinc-400">
                          <span>Weight: <strong className="text-white">{material.weight.toLocaleString()} lbs</strong></span>
                          <span>Product ID: <strong className="text-white">{material.productId}</strong></span>
                        </div>
                        {material.notes && (
                          <div className="flex items-start gap-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span className="text-amber-400/90 text-xs">{material.notes}</span>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => toggleReturn(material.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                              isReturn
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : 'bg-zinc-700 text-zinc-400 border-zinc-600 hover:text-white'
                            }`}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            {isReturn ? 'Marked for Return' : 'Report Return'}
                          </button>
                          <button
                            onClick={() => {
                              setDamageItem(material.productName);
                              setShowDamageReport(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-700 text-zinc-400 border border-zinc-600 rounded-lg hover:text-white transition-colors"
                          >
                            <AlertOctagon className="w-3.5 h-3.5" />
                            Report Damage
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* All Loaded Message */}
          {allLoaded && (
            <div className="px-5 py-4 border-t border-zinc-800 bg-[#39FF14]/10">
              <div className="flex items-center gap-2 text-[#39FF14]">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold">All {totalMaterials} Items Verified and Loaded</span>
              </div>
            </div>
          )}
        </div>

        {/* Damage Reports */}
        {damageReports.length > 0 && (
          <div className="bg-zinc-900 border border-red-500/30 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-red-500/20 bg-red-500/5">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-red-400">Damage Reports ({damageReports.length})</h3>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {damageReports.map((report, i) => (
                <div key={i} className="px-5 py-3">
                  <p className="text-sm text-white font-medium">{report.item}</p>
                  <p className="text-xs text-zinc-400 mt-1">{report.description}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {report.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo Upload Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-[#39FF14]" />
              <div>
                <h2 className="text-base font-semibold text-white">Loaded Truck Photos</h2>
                <p className="text-xs text-zinc-500">
                  Take at least 1 photo showing all materials loaded and secured
                </p>
              </div>
            </div>
            <span className={`text-sm font-medium ${hasPhotos ? 'text-[#39FF14]' : 'text-amber-400'}`}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="p-5">
            {/* Photo Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-zinc-700">
                    <img
                      src={photo.preview}
                      alt={photo.label}
                      className="w-full h-32 object-cover"
                    />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <p className="text-[10px] text-white truncate">{photo.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:border-[#39FF14]/50 hover:text-[#39FF14] transition-colors"
              >
                <Camera className="w-5 h-5" />
                <span className="text-sm font-medium">Take Photo</span>
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = true;
                  input.onchange = (e) => handlePhotoUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
                  input.click();
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:border-[#39FF14]/50 hover:text-[#39FF14] transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">Upload</span>
              </button>
            </div>

            {!hasPhotos && (
              <p className="text-xs text-amber-400/70 mt-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                At least 1 photo is required to confirm the load
              </p>
            )}
          </div>
        </div>

        {/* Driver Notes */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Driver Notes (optional)
          </label>
          <textarea
            value={driverNotes}
            onChange={e => setDriverNotes(e.target.value)}
            rows={3}
            placeholder="Any notes about the load, shortages, substitutions, damage..."
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/30 text-sm resize-none"
          />
        </div>

        {/* Submit Button */}
        {!submitted ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base transition-colors ${
                canSubmit
                  ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Confirming Load...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Confirm Load Complete
                </>
              )}
            </button>
            {!allLoaded && (
              <p className="text-xs text-zinc-500 self-center">
                {totalMaterials - loadedCount} item{totalMaterials - loadedCount !== 1 ? 's' : ''} remaining
              </p>
            )}
            {allLoaded && !hasPhotos && (
              <p className="text-xs text-amber-400 self-center">
                Upload at least 1 photo to submit
              </p>
            )}
          </div>
        ) : (
          <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-[#39FF14] mx-auto mb-3" />
            <h3 className="text-xl font-bold text-[#39FF14] mb-2">Load Confirmed</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Ticket {selectedDelivery.ticketId} is ready for delivery.
              {damageReports.length > 0 && ` ${damageReports.length} damage report(s) filed.`}
              {returnItems.size > 0 && ` ${returnItems.size} item(s) marked for return.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/portal/delivery"
                className="px-6 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors text-sm"
              >
                Start Delivery
              </Link>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setLoadedItems(new Set());
                  setPhotos([]);
                }}
                className="px-6 py-2.5 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white transition-colors text-sm"
              >
                Reset Checklist
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Damage Report Modal */}
      {showDamageReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-400" />
                Report Damage / Issue
              </h3>
              <button
                onClick={() => setShowDamageReport(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Item</label>
                <input
                  type="text"
                  value={damageItem}
                  onChange={e => setDamageItem(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Description of damage or issue</label>
                <textarea
                  value={damageDescription}
                  onChange={e => setDamageDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the damage, quantity affected, etc."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
              <button
                onClick={() => setShowDamageReport(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitDamageReport}
                disabled={!damageItem || !damageDescription.trim()}
                className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-400 disabled:opacity-50 text-sm"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
