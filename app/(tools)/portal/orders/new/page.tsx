'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Plus,
  Minus,
  X,
  Search,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  AlertCircle,
  Truck,
  FileText,
  User,
  Building,
  CheckCircle2,
  Info,
  Loader2
} from 'lucide-react';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';
import JobSearchAutocomplete, { JobSearchHit } from '@/components/JobSearchAutocomplete';
import { useAuth } from '@/lib/auth-context';

// Roles allowed to see purchase cost / margin in the order builder.
// Per the reinforced rule (2026-04-09): cost only appears on inventory
// entry surfaces and reports. The order builder is a delivery-side
// surface, so driver and sales reps both NEVER see cost here.
// Mirrors lib/cost-visibility.ts COST_VISIBLE_ROLES.
const COST_VISIBLE_ROLES = new Set(['owner', 'admin', 'office', 'manager', 'project_manager', 'pm']);

// Live catalog item — matches what /api/portal/inventory?action=list returns,
// remapped to the local cost/price shape used by this page.
interface CatalogProduct {
  productId: string;       // INV-XXXX
  productName: string;
  category: string;
  sku: string;
  unit: string;
  cost: number;            // unitCost from API (purchase price)
  price: number;           // unitPrice from API (selling price)
  currentQty: number;
  availableQty: number;
}

interface OrderItemDraft {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
}

interface JobNimbusJob {
  jnid: string;
  number: string;
  name: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const showCost = !!user && COST_VISIBLE_ROLES.has((user.role || '').toLowerCase());
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchingJobs, setSearchingJobs] = useState(false);
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [jobs, setJobs] = useState<JobNimbusJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobNimbusJob | null>(null);

  // Live catalog from unified-inventory-service via /api/portal/inventory
  const [inventoryProducts, setInventoryProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/portal/inventory?action=list');
        if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const items: CatalogProduct[] = (data.items || [])
          .filter((i: { active?: boolean }) => i.active !== false)
          .map((i: {
            productId: string;
            productName: string;
            category: string;
            sku: string;
            unit: string;
            unitCost: number;
            unitPrice: number;
            currentQty: number;
            availableQty: number;
          }) => ({
            productId: i.productId,
            productName: i.productName,
            category: i.category,
            sku: i.sku,
            unit: i.unit,
            cost: i.unitCost,
            price: i.unitPrice,
            currentQty: i.currentQty,
            availableQty: i.availableQty,
          }));
        setInventoryProducts(items);
      } catch (err) {
        console.error('Failed to load inventory catalog:', err);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Order form state
  const [orderData, setOrderData] = useState({
    // Job info
    jobNumber: '',
    jobName: '',
    jobNimbusId: '',

    // Customer info
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    city: '',
    state: 'AL',
    zipCode: '',

    // Delivery
    requestedDeliveryDate: '',
    requestedDeliveryTime: '',
    priority: 'normal' as 'normal' | 'rush' | 'urgent',

    // Inspector
    inspectorRequired: false,
    inspectorName: '',
    inspectorPhone: '',
    inspectorArrivalTime: '',

    // Notes
    specialInstructions: '',
    internalNotes: '',
  });

  // Materials
  const [orderItems, setOrderItems] = useState<OrderItemDraft[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showProductModal, setShowProductModal] = useState(false);

  // Get unique categories
  const categories = ['all', ...new Set(inventoryProducts.map(p => p.category))];

  // Filter products
  const filteredProducts = inventoryProducts.filter(p => {
    const matchesSearch = productSearch === '' ||
      p.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.productId.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Auto-populate from R-number when the user types a job number and
  // blurs or presses Enter. Uses the work-order lookup endpoint which
  // tries JN by number, then commissions.json fallback.
  const [jobNumberLooking, setJobNumberLooking] = useState(false);
  const [jobNumberMsg, setJobNumberMsg] = useState<string | null>(null);

  const lookupByJobNumber = async (jobNum: string) => {
    const trimmed = jobNum.trim();
    if (!trimmed || trimmed.length < 2) return;
    // Skip if we already populated from the JN search picker
    if (selectedJob && orderData.customerName) return;

    setJobNumberLooking(true);
    setJobNumberMsg(null);
    try {
      const res = await fetch(
        `/api/portal/delivery/work-orders?action=lookup&jobNumber=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) {
        setJobNumberMsg('Lookup failed');
        return;
      }
      const data = await res.json();
      if (data.success && data.customerName) {
        setOrderData(prev => ({
          ...prev,
          jobName: data.jobName || prev.jobName,
          jobNimbusId: data.jnJobId || prev.jobNimbusId,
          customerName: data.customerName || prev.customerName,
          customerPhone: data.phone || prev.customerPhone,
          customerEmail: data.email || prev.customerEmail,
          customerAddress: data.addressParts?.street || data.address || prev.customerAddress,
          city: data.addressParts?.city || prev.city,
          state: data.addressParts?.state || prev.state,
          zipCode: data.addressParts?.zip || prev.zipCode,
        }));
        setJobNumberMsg(`Imported from JobNimbus: ${data.customerName}`);
      } else {
        setJobNumberMsg(data.error || 'No match found — fill in manually');
      }
    } catch {
      setJobNumberMsg('Lookup error — fill in manually');
    } finally {
      setJobNumberLooking(false);
    }
  };

  // Search for jobs from JobNimbus
  const searchJobs = async () => {
    if (!jobSearchTerm.trim()) return;
    setSearchingJobs(true);

    try {
      // Call the JobNimbus API to search for jobs
      const response = await fetch(`/api/admin/jobnimbus?type=jobs&limit=20`);
      const data = await response.json();

      if (!data.success) {
        console.error('JobNimbus API error:', data.error);
        setJobs([]);
        return;
      }

      // Filter results by search term
      const filtered = (data.results || [])
        .filter((j: Record<string, unknown>) => {
          const searchLower = jobSearchTerm.toLowerCase();
          return (
            ((j.name as string) || '').toLowerCase().includes(searchLower) ||
            ((j.jnid as string) || '').toLowerCase().includes(searchLower) ||
            ((j.primary as { display_name?: string })?.display_name || '').toLowerCase().includes(searchLower)
          );
        })
        .map((j: Record<string, unknown>) => ({
          jnid: j.jnid as string,
          number: j.jnid as string,
          name: (j.name as string) || 'Untitled Job',
          customerName: (j.primary as { display_name?: string })?.display_name || 'Customer',
          customerPhone: '',
          address: (j.address_line1 as string) || '',
          city: (j.city as string) || '',
          state: (j.state_text as string) || 'AL',
          zip: (j.zip as string) || '',
        }));

      setJobs(filtered);
    } catch (error) {
      console.error('Error searching jobs:', error);
      setJobs([]);
    } finally {
      setSearchingJobs(false);
    }
  };

  // Select a job from search results
  const selectJob = (job: JobNimbusJob) => {
    setSelectedJob(job);
    setOrderData({
      ...orderData,
      jobNumber: job.number,
      jobName: job.name,
      jobNimbusId: job.jnid,
      customerName: job.customerName,
      customerPhone: job.customerPhone,
      customerEmail: job.customerEmail || '',
      customerAddress: job.address,
      city: job.city,
      state: job.state,
      zipCode: job.zip,
    });
    setJobs([]);
    setJobSearchTerm('');
  };

  // Apply a normalized JN search hit from the autocomplete picker.
  const applyJobHit = (hit: JobSearchHit) => {
    setSelectedJob({
      jnid: hit.jnid,
      number: hit.rNumber,
      name: hit.jobName,
      customerName: hit.customerName,
      customerPhone: hit.phone,
      customerEmail: hit.email,
      address: hit.address,
      city: hit.city,
      state: hit.state,
      zip: hit.zip,
    });
    setOrderData(prev => ({
      ...prev,
      jobNumber: hit.rNumber || prev.jobNumber,
      jobName: hit.jobName || prev.jobName,
      jobNimbusId: hit.jnid || prev.jobNimbusId,
      customerName: hit.customerName || prev.customerName,
      customerPhone: hit.phone || prev.customerPhone,
      customerEmail: hit.email || prev.customerEmail,
      customerAddress: hit.address || prev.customerAddress,
      city: hit.city || prev.city,
      state: hit.state || prev.state,
      zipCode: hit.zip || prev.zipCode,
    }));
    setJobNumberMsg(`Imported from JobNimbus: ${hit.customerName || hit.jobName}`);
  };

  // Add product to order
  const addProduct = (product: CatalogProduct, qty: number = 1) => {
    const existing = orderItems.find(i => i.productId === product.productId);
    if (existing) {
      setOrderItems(orderItems.map(i =>
        i.productId === product.productId
          ? {
              ...i,
              quantity: i.quantity + qty,
              totalCost: (i.quantity + qty) * i.unitCost,
              totalPrice: (i.quantity + qty) * i.unitPrice,
            }
          : i
      ));
    } else {
      setOrderItems([...orderItems, {
        productId: product.productId,
        productName: product.productName,
        category: product.category,
        quantity: qty,
        unit: product.unit,
        unitCost: product.cost,
        unitPrice: product.price,
        totalCost: qty * product.cost,
        totalPrice: qty * product.price,
      }]);
    }
    setShowProductModal(false);
  };

  // Update item quantity
  const updateQuantity = (productId: string, delta: number) => {
    setOrderItems(orderItems.map(i => {
      if (i.productId === productId) {
        const newQty = Math.max(1, i.quantity + delta);
        return {
          ...i,
          quantity: newQty,
          totalCost: newQty * i.unitCost,
          totalPrice: newQty * i.unitPrice,
        };
      }
      return i;
    }));
  };

  // Remove item
  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(i => i.productId !== productId));
  };

  // Calculate totals. For sales reps, the API strips unitCost/totalCost so
  // those values arrive as undefined — coalesce to 0 so the math doesn't NaN.
  // The cost/margin display is gated by `showCost` below; sales reps see
  // only the price total.
  const totals = {
    items: orderItems.length,
    quantity: orderItems.reduce((sum, i) => sum + i.quantity, 0),
    cost: orderItems.reduce((sum, i) => sum + (i.totalCost || 0), 0),
    price: orderItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0),
    margin: orderItems.length > 0
      ? ((orderItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0) -
          orderItems.reduce((sum, i) => sum + (i.totalCost || 0), 0)) /
          (orderItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0) || 1) * 100)
      : 0,
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Validate current step
  const isStepValid = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        return orderData.jobNumber && orderData.jobName && orderData.customerName &&
               orderData.customerAddress && orderData.city && orderData.zipCode;
      case 2:
        return orderItems.length > 0;
      case 3:
        return orderData.requestedDeliveryDate !== '';
      default:
        return true;
    }
  };

  // Submit order via the 18-stage pipeline.
  // Server reads createdBy from auth session — do not pass it from the client.
  const submitOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createOrder',
          priority: orderData.priority,
          jobNumber: orderData.jobNumber,
          jobName: orderData.jobName,
          jobNimbusId: orderData.jobNimbusId || undefined,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          customerEmail: orderData.customerEmail || undefined,
          deliveryAddress: orderData.customerAddress,
          deliveryCity: orderData.city,
          deliveryState: orderData.state,
          deliveryZip: orderData.zipCode,
          requestedDeliveryDate: orderData.requestedDeliveryDate,
          items: orderItems.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          specialInstructions: orderData.specialInstructions || undefined,
          notes: orderData.internalNotes || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create order');
      }

      const newOrderId = data.order?.orderId;
      if (!newOrderId) {
        throw new Error('Order created but no orderId returned');
      }
      router.push(`/portal/orders/${newOrderId}`);
    } catch (error) {
      console.error('Error creating order:', error);
      const msg = error instanceof Error ? error.message : 'Failed to create order. Please try again.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/orders" className="text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">New Material Order</h1>
              <p className="text-sm text-neutral-500">Create a material order for a job</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          {[
            { num: 1, label: 'Job Details' },
            { num: 2, label: 'Materials' },
            { num: 3, label: 'Delivery' },
            { num: 4, label: 'Review' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <button
                onClick={() => isStepValid(step) && setStep(s.num)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  step === s.num
                    ? 'bg-green-600 text-white'
                    : step > s.num
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {step > s.num ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full border-2 border-current text-xs font-bold">
                    {s.num}
                  </span>
                )}
                <span className="font-medium">{s.label}</span>
              </button>
              {idx < 3 && (
                <div className={`w-8 h-0.5 mx-2 ${step > s.num ? 'bg-green-600' : 'bg-neutral-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Deprecation notice (2026-08-18): orders created through this legacy
            form do NOT appear on the warehouse board. Point users at the flows
            that create a real Tickets-tab ticket. */}
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Heads up:</strong> orders started on this legacy screen do not
          show up on the warehouse board. To get materials to Rick, use{' '}
          <a href="/portal/warehouse" className="font-semibold underline">the Warehouse “New Work Order” button</a>{' '}
          or email the order to <span className="font-mono">stock@rcrsal.com</span>.
        </div>
        {/* Step 1: Job Details */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Job Search */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-green-400" />
                Find the Job
              </h2>

              <JobSearchAutocomplete
                onSelect={applyJobHit}
                placeholder="Type R-number, customer name, or address…"
                className="mb-4"
              />

              {selectedJob && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-green-900">{selectedJob.name}</div>
                      <div className="text-sm text-green-400">{selectedJob.number}</div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedJob(null);
                        setOrderData({
                          ...orderData,
                          jobNumber: '',
                          jobName: '',
                          jobNimbusId: '',
                          customerName: '',
                          customerPhone: '',
                          customerEmail: '',
                          customerAddress: '',
                          city: '',
                          state: 'AL',
                          zipCode: '',
                        });
                      }}
                      className="text-green-400 hover:text-green-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="text-sm text-neutral-500 flex items-center gap-1 mt-2">
                <Info className="w-4 h-4" />
                Or enter job details manually below
              </div>
            </div>

            {/* Manual Job Info */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-400" />
                Job Information
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Job Number * <span className="text-xs text-neutral-500 font-normal">(enter R-number, auto-populates)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={orderData.jobNumber}
                      onChange={(e) => setOrderData({ ...orderData, jobNumber: e.target.value })}
                      onBlur={(e) => lookupByJobNumber(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupByJobNumber(orderData.jobNumber); } }}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      placeholder="R-12345"
                    />
                    {jobNumberLooking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-green-400" />
                      </div>
                    )}
                  </div>
                  {jobNumberMsg && (
                    <p className={`mt-1 text-xs ${jobNumberMsg.includes('Imported') ? 'text-green-400' : 'text-neutral-500'}`}>
                      {jobNumberMsg}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Job Name *
                  </label>
                  <input
                    type="text"
                    value={orderData.jobName}
                    onChange={(e) => setOrderData({ ...orderData, jobName: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    placeholder="Customer Name - Project Type"
                  />
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-green-400" />
                Customer & Delivery Address
              </h2>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={orderData.customerName}
                    onChange={(e) => setOrderData({ ...orderData, customerName: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={orderData.customerPhone}
                    onChange={(e) => setOrderData({ ...orderData, customerPhone: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={orderData.customerEmail}
                  onChange={(e) => setOrderData({ ...orderData, customerEmail: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Delivery Address *
                </label>
                <AddressAutocomplete
                  onAddressSelect={(result: AddressResult) => {
                    const streetParts: string[] = [];
                    if (result.streetNumber) streetParts.push(result.streetNumber);
                    if (result.street) streetParts.push(result.street);
                    const streetAddr = streetParts.length > 0 ? streetParts.join(' ') : result.formattedAddress.split(',')[0];
                    setOrderData({
                      ...orderData,
                      customerAddress: streetAddr,
                      city: result.city || orderData.city,
                      state: result.state || orderData.state,
                      zipCode: result.zip || orderData.zipCode,
                    });
                  }}
                  defaultValue={orderData.customerAddress}
                  placeholder="Start typing delivery address..."
                  className="!bg-white !border-neutral-300 !text-neutral-900 !placeholder-neutral-400 focus:!ring-2 focus:!ring-green-500 focus:!border-green-500"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    value={orderData.city}
                    onChange={(e) => setOrderData({ ...orderData, city: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={orderData.state}
                    onChange={(e) => setOrderData({ ...orderData, state: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={orderData.zipCode}
                    onChange={(e) => setOrderData({ ...orderData, zipCode: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Next Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!isStepValid(1)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Continue to Materials
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Materials */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-400" />
                  Order Materials
                </h2>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Material
                </button>
              </div>

              {orderItems.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                  <p>No materials added yet</p>
                  <p className="text-sm">Click "Add Material" to start building your order</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map(item => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-neutral-900">{item.productName}</div>
                        <div className="text-sm text-neutral-500">
                          {item.category} | {formatCurrency(item.unitPrice)}/{item.unit}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-neutral-300 hover:bg-neutral-100"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-12 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-neutral-300 hover:bg-neutral-100"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="w-24 text-right font-medium text-green-400">
                          {formatCurrency(item.totalPrice)}
                        </div>

                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Order Summary */}
              {orderItems.length > 0 && (
                <div className="mt-6 pt-6 border-t border-neutral-200">
                  <div className="flex justify-between items-center">
                    <div className="text-neutral-600">
                      {totals.items} items ({totals.quantity} units)
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-400">
                        {formatCurrency(totals.price)}
                      </div>
                      {showCost && (
                        <div className="text-sm text-neutral-500">
                          Cost: {formatCurrency(totals.cost)} | Margin: {totals.margin.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 font-medium"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!isStepValid(2)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Continue to Delivery
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Delivery */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-green-400" />
                Delivery Details
              </h2>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Requested Delivery Date *
                  </label>
                  <input
                    type="date"
                    value={orderData.requestedDeliveryDate}
                    onChange={(e) => setOrderData({ ...orderData, requestedDeliveryDate: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    value={orderData.requestedDeliveryTime}
                    onChange={(e) => setOrderData({ ...orderData, requestedDeliveryTime: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Priority Level
                </label>
                <div className="flex gap-3">
                  {[
                    { value: 'normal', label: 'Normal', color: 'bg-white/10 text-neutral-300' },
                    { value: 'rush', label: 'Rush (+$50)', color: 'bg-orange-500/20 text-orange-400' },
                    { value: 'urgent', label: 'Urgent (+$100)', color: 'bg-red-500/20 text-red-400' },
                  ].map(p => (
                    <button
                      key={p.value}
                      onClick={() => setOrderData({ ...orderData, priority: p.value as any })}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        orderData.priority === p.value
                          ? p.color + ' ring-2 ring-offset-2 ring-green-500'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inspector Section */}
              <div className="border-t border-neutral-200 pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="inspectorRequired"
                    checked={orderData.inspectorRequired}
                    onChange={(e) => setOrderData({ ...orderData, inspectorRequired: e.target.checked })}
                    className="w-4 h-4 text-green-400 border-neutral-300 rounded focus:ring-green-500"
                  />
                  <label htmlFor="inspectorRequired" className="text-sm font-medium text-neutral-700">
                    Inspector Required (Coordinate delivery with inspection)
                  </label>
                </div>

                {orderData.inspectorRequired && (
                  <div className="grid md:grid-cols-3 gap-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Inspector Name
                      </label>
                      <input
                        type="text"
                        value={orderData.inspectorName}
                        onChange={(e) => setOrderData({ ...orderData, inspectorName: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Inspector Phone
                      </label>
                      <input
                        type="tel"
                        value={orderData.inspectorPhone}
                        onChange={(e) => setOrderData({ ...orderData, inspectorPhone: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Inspector Arrival Time
                      </label>
                      <input
                        type="time"
                        value={orderData.inspectorArrivalTime}
                        onChange={(e) => setOrderData({ ...orderData, inspectorArrivalTime: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Special Instructions */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                Special Instructions
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Delivery Instructions
                </label>
                <textarea
                  value={orderData.specialInstructions}
                  onChange={(e) => setOrderData({ ...orderData, specialInstructions: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Gate codes, placement instructions, access notes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={orderData.internalNotes}
                  onChange={(e) => setOrderData({ ...orderData, internalNotes: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  rows={2}
                  placeholder="Notes for office staff..."
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 font-medium"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!isStepValid(3)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Review Order
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-6">
                Order Summary
              </h2>

              {/* Job Info */}
              <div className="mb-6 pb-6 border-b border-neutral-200">
                <h3 className="font-medium text-neutral-900 mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Job
                </h3>
                <div className="text-neutral-600">
                  <p className="font-medium">{orderData.jobName}</p>
                  <p className="text-sm">{orderData.jobNumber}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mb-6 pb-6 border-b border-neutral-200">
                <h3 className="font-medium text-neutral-900 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Delivery Location
                </h3>
                <div className="text-neutral-600">
                  <p className="font-medium">{orderData.customerName}</p>
                  <p>{orderData.customerAddress}</p>
                  <p>{orderData.city}, {orderData.state} {orderData.zipCode}</p>
                  <p className="text-sm mt-1">
                    <Phone className="w-3 h-3 inline mr-1" />
                    {orderData.customerPhone}
                  </p>
                </div>
              </div>

              {/* Delivery Info */}
              <div className="mb-6 pb-6 border-b border-neutral-200">
                <h3 className="font-medium text-neutral-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Delivery
                </h3>
                <div className="text-neutral-600">
                  <p>
                    <span className="font-medium">Date:</span> {orderData.requestedDeliveryDate}
                    {orderData.requestedDeliveryTime && ` at ${orderData.requestedDeliveryTime}`}
                  </p>
                  <p>
                    <span className="font-medium">Priority:</span>{' '}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      orderData.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                      orderData.priority === 'rush' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/10 text-neutral-300'
                    }`}>
                      {orderData.priority.charAt(0).toUpperCase() + orderData.priority.slice(1)}
                    </span>
                  </p>
                  {orderData.inspectorRequired && (
                    <p className="mt-2 text-amber-600">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Inspector: {orderData.inspectorName} arriving at {orderData.inspectorArrivalTime}
                    </p>
                  )}
                </div>
              </div>

              {/* Materials */}
              <div className="mb-6 pb-6 border-b border-neutral-200">
                <h3 className="font-medium text-neutral-900 mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Materials ({totals.items} items)
                </h3>
                <div className="space-y-2">
                  {orderItems.map(item => (
                    <div key={item.productId} className="flex justify-between text-sm">
                      <span className="text-neutral-600">
                        {item.productName} x{item.quantity}
                      </span>
                      <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center text-lg">
                <span className="font-semibold text-neutral-900">Order Total</span>
                <span className="font-bold text-green-400">{formatCurrency(totals.price)}</span>
              </div>

              {orderData.specialInstructions && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-400">
                  <strong>Special Instructions:</strong> {orderData.specialInstructions}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 font-medium"
              >
                Back
              </button>
              <button
                onClick={submitOrder}
                disabled={loading}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Submit Order
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Selection Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Material</h3>
              <button onClick={() => setShowProductModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-neutral-200">
              <div className="flex gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedCategory === cat
                        ? 'bg-green-600 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-12 text-neutral-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading catalog...
                </div>
              ) : inventoryProducts.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                  <p>No products in catalog</p>
                  <p className="text-sm">Check the inventory service is reachable</p>
                </div>
              ) : (
              <div className="space-y-2">
                {filteredProducts.map(product => (
                  <button
                    key={product.productId}
                    onClick={() => addProduct(product)}
                    disabled={product.availableQty <= 0}
                    className="w-full text-left p-3 bg-neutral-50 rounded-lg hover:bg-green-50 border border-transparent hover:border-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-neutral-900">{product.productName}</div>
                        <div className="text-sm text-neutral-500">
                          {product.category} | {product.availableQty} available
                          {product.availableQty < product.currentQty && ` (${product.currentQty - product.availableQty} on hold)`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-400">{formatCurrency(product.price)}</div>
                        <div className="text-xs text-neutral-400">per {product.unit}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
