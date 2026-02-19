'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, DollarSign, FileText, Send, Plus, Search, Filter,
  CreditCard, AlertTriangle, CheckCircle2, Clock, Eye, Edit,
  Save, Trash2, Copy, Download, BarChart3, TrendingUp, Receipt,
  ChevronDown, X, Printer, Building2, Shield, Tag, PieChart,
  Users, Calendar, Hash, Phone, Mail, MapPin, ChevronRight,
  RefreshCw, ExternalLink, GitCompare, Loader2, DownloadCloud,
} from 'lucide-react';

// ============ TYPES ============

type Tab = 'dashboard' | 'create' | 'list' | 'payments' | 'reports';
type InvoiceType = 'estimate' | 'progress' | 'final' | 'supplement' | 'credit';
type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
type PaymentMethod = 'check' | 'cash' | 'card' | 'insurance' | 'financing';
type LineItemCategory = 'materials' | 'labor' | 'delivery' | 'disposal' | 'permit' | 'other';

interface LineItem {
  id: string; description: string; category: LineItemCategory;
  quantity: number; unit: string; unitPrice: number; total: number; taxable: boolean;
}
interface Payment {
  paymentId: string; date: string; amount: number;
  method: PaymentMethod; reference: string; notes: string; invoiceId?: string; customerName?: string;
}
interface InsuranceClaim {
  claimNumber: string; carrier: string; adjusterName: string;
  adjusterPhone: string; deductible: number; approved: boolean; approvedAmount: number;
}
interface Address { street: string; city: string; state: string; zip: string; }
interface Invoice {
  invoiceId: string; jobId: string; breakdownId?: string;
  customerName: string; customerEmail: string; customerPhone: string;
  billingAddress: Address; jobAddress: Address;
  type: InvoiceType; status: InvoiceStatus; lineItems: LineItem[];
  subtotal: number; taxRate: number; taxAmount: number;
  discount: number; discountType: 'percent' | 'fixed'; total: number;
  amountPaid: number; balanceDue: number; payments: Payment[];
  insuranceClaim?: InsuranceClaim;
  dueDate: string; terms: string; notes: string; internalNotes: string;
  createdAt: string; updatedAt: string; sentAt?: string; paidAt?: string; createdBy: string;
}

// ============ JOBNIMBUS TYPES ============

interface JNInvoiceSummary {
  jnid: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  amountPaid: number;
  balance: number;
  total: number;
  dueDate: string;
  pdfUrl: string;
  createdAt: string;
  customerName: string;
}

interface InvoiceComparison {
  localInvoice: Invoice | null;
  jnInvoice: JNInvoiceSummary | null;
  matched: boolean;
  differences: { field: string; local: string | number; jn: string | number }[];
}

// ============ CONSTANTS ============

const TAX_RATE = 0.055;

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-zinc-400', bg: 'bg-zinc-700' },
  sent: { label: 'Sent', color: 'text-blue-400', bg: 'bg-blue-900/40' },
  viewed: { label: 'Viewed', color: 'text-purple-400', bg: 'bg-purple-900/40' },
  approved: { label: 'Approved', color: 'text-[#39FF14]', bg: 'bg-[#39FF14]/10' },
  paid: { label: 'Paid', color: 'text-emerald-400', bg: 'bg-emerald-900/40' },
  overdue: { label: 'Overdue', color: 'text-red-400', bg: 'bg-red-900/40' },
  cancelled: { label: 'Cancelled', color: 'text-zinc-500', bg: 'bg-zinc-800' },
  disputed: { label: 'Disputed', color: 'text-amber-400', bg: 'bg-amber-900/40' },
};

const TYPE_CONFIG: Record<InvoiceType, { label: string; color: string }> = {
  estimate: { label: 'Estimate', color: 'text-blue-400' },
  progress: { label: 'Progress', color: 'text-purple-400' },
  final: { label: 'Final', color: 'text-[#39FF14]' },
  supplement: { label: 'Supplement', color: 'text-amber-400' },
  credit: { label: 'Credit', color: 'text-red-400' },
};

// ============ BILLING VISIBILITY RULES ============
// JobNimbus invoice: FINAL PRICE ONLY (customer-facing)
// Internal inventory invoice: purchase price + final price (admin & office only)
type ViewerRole = 'driver' | 'warehouse' | 'office' | 'admin' | 'billing';

function canViewPurchasePrice(role: ViewerRole): boolean {
  return ['admin', 'office', 'billing'].includes(role);
}

function canViewMargin(role: ViewerRole): boolean {
  return ['admin', 'office'].includes(role);
}

// For JobNimbus sync: strip purchase prices, show final only
function getJobNimbusLineItems(items: LineItem[]): Pick<LineItem, 'description' | 'quantity' | 'unit' | 'total'>[] {
  return items.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    total: item.total, // Final price only
  }));
}

const TERMS_OPTIONS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on Completion', 'Due on Approval', 'Immediate'];
const CATEGORY_OPTIONS: { value: LineItemCategory; label: string }[] = [
  { value: 'materials', label: 'Materials' }, { value: 'labor', label: 'Labor' },
  { value: 'delivery', label: 'Delivery' }, { value: 'disposal', label: 'Disposal' },
  { value: 'permit', label: 'Permit' }, { value: 'other', label: 'Other' },
];

// ============ MOCK DATA ============

const MOCK_INVOICES: Invoice[] = [
  {
    invoiceId: 'INV-2026-0001', jobId: 'JOB-2026-101', breakdownId: 'BRK-2026-101',
    customerName: 'Johnson Residence', customerEmail: 'mjohnson@email.com', customerPhone: '(256) 555-0101',
    billingAddress: { street: '1420 Governors Dr SW', city: 'Huntsville', state: 'AL', zip: '35801' },
    jobAddress: { street: '1420 Governors Dr SW', city: 'Huntsville', state: 'AL', zip: '35801' },
    type: 'final', status: 'paid',
    lineItems: [
      { id: 'li-1', description: 'Owens Corning Duration Shingles (Onyx Black)', category: 'materials', quantity: 42, unit: 'bundles', unitPrice: 38.50, total: 1617.00, taxable: true },
      { id: 'li-2', description: 'Synthetic Underlayment', category: 'materials', quantity: 6, unit: 'rolls', unitPrice: 79.86, total: 479.16, taxable: true },
      { id: 'li-3', description: 'Galvanized Roofing Nails (1.25")', category: 'materials', quantity: 4, unit: 'boxes', unitPrice: 64.90, total: 259.60, taxable: true },
      { id: 'li-4', description: 'Tear-off and Installation Labor', category: 'labor', quantity: 1, unit: 'job', unitPrice: 4200.00, total: 4200.00, taxable: false },
      { id: 'li-5', description: 'Debris Disposal', category: 'disposal', quantity: 1, unit: 'job', unitPrice: 350.00, total: 350.00, taxable: false },
    ],
    subtotal: 6905.76, taxRate: 0.055, taxAmount: 129.57, discount: 0, discountType: 'fixed',
    total: 7035.33, amountPaid: 7035.33, balanceDue: 0,
    payments: [
      { paymentId: 'PAY-001', date: '2026-01-15', amount: 3517.67, method: 'check', reference: 'Check #4421', notes: 'Deposit - 50%' },
      { paymentId: 'PAY-002', date: '2026-01-28', amount: 3517.66, method: 'check', reference: 'Check #4438', notes: 'Final payment' },
    ],
    dueDate: '2026-02-14', terms: 'Net 30',
    notes: 'Complete roof replacement - 28 square.', internalNotes: 'Job went smoothly, 3-day completion.',
    createdAt: '2026-01-12', updatedAt: '2026-01-28', sentAt: '2026-01-12', paidAt: '2026-01-28', createdBy: 'Michael',
  },
  {
    invoiceId: 'INV-2026-0002', jobId: 'JOB-2026-102',
    customerName: 'Smith Commercial Properties', customerEmail: 'rsmith@smithcommercial.com', customerPhone: '(256) 555-0202',
    billingAddress: { street: '4925 University Dr NW', city: 'Huntsville', state: 'AL', zip: '35816' },
    jobAddress: { street: '4925 University Dr NW', city: 'Huntsville', state: 'AL', zip: '35816' },
    type: 'progress', status: 'overdue',
    lineItems: [
      { id: 'li-6', description: 'TPO Roofing Membrane (60 mil)', category: 'materials', quantity: 120, unit: 'sq ft', unitPrice: 4.25, total: 510.00, taxable: true },
      { id: 'li-7', description: 'Insulation Board (2" Polyiso)', category: 'materials', quantity: 80, unit: 'sheets', unitPrice: 32.00, total: 2560.00, taxable: true },
      { id: 'li-8', description: 'Commercial Installation Labor - Phase 1', category: 'labor', quantity: 1, unit: 'phase', unitPrice: 8500.00, total: 8500.00, taxable: false },
      { id: 'li-9', description: 'Crane Rental', category: 'other', quantity: 2, unit: 'days', unitPrice: 750.00, total: 1500.00, taxable: false },
    ],
    subtotal: 13070.00, taxRate: 0.055, taxAmount: 168.85, discount: 500, discountType: 'fixed',
    total: 12738.85, amountPaid: 5000.00, balanceDue: 7738.85,
    payments: [{ paymentId: 'PAY-003', date: '2026-01-05', amount: 5000.00, method: 'check', reference: 'Check #7810', notes: 'Initial deposit' }],
    dueDate: '2026-01-20', terms: 'Net 15',
    notes: 'Progress billing - Phase 1 of 3.', internalNotes: 'Customer slow to pay. Follow up weekly.',
    createdAt: '2026-01-04', updatedAt: '2026-02-10', sentAt: '2026-01-04', createdBy: 'Michael',
  },
  {
    invoiceId: 'INV-2026-0003', jobId: 'JOB-2026-103', breakdownId: 'BRK-2026-103',
    customerName: 'Williams Family', customerEmail: 'twill@gmail.com', customerPhone: '(256) 555-0303',
    billingAddress: { street: '2812 Whitesburg Dr SE', city: 'Huntsville', state: 'AL', zip: '35802' },
    jobAddress: { street: '2812 Whitesburg Dr SE', city: 'Huntsville', state: 'AL', zip: '35802' },
    type: 'estimate', status: 'sent',
    lineItems: [
      { id: 'li-10', description: 'GAF Timberline HDZ (Weathered Wood)', category: 'materials', quantity: 35, unit: 'bundles', unitPrice: 42.00, total: 1470.00, taxable: true },
      { id: 'li-11', description: 'Synthetic Underlayment', category: 'materials', quantity: 5, unit: 'rolls', unitPrice: 79.86, total: 399.30, taxable: true },
      { id: 'li-12', description: 'Roof Replacement Labor', category: 'labor', quantity: 1, unit: 'job', unitPrice: 3800.00, total: 3800.00, taxable: false },
      { id: 'li-13', description: 'Building Permit', category: 'permit', quantity: 1, unit: 'ea', unitPrice: 150.00, total: 150.00, taxable: false },
    ],
    subtotal: 5819.30, taxRate: 0.055, taxAmount: 102.81, discount: 5, discountType: 'percent',
    total: 5631.15, amountPaid: 0, balanceDue: 5631.15, payments: [],
    dueDate: '2026-03-10', terms: 'Due on Completion',
    notes: 'Estimate valid for 30 days.', internalNotes: 'Referral from Johnson.',
    createdAt: '2026-02-08', updatedAt: '2026-02-08', sentAt: '2026-02-08', createdBy: 'Sarah',
  },
  {
    invoiceId: 'INV-2026-0004', jobId: 'JOB-2026-104',
    customerName: 'Davis Property Management', customerEmail: 'ldavis@davisprop.com', customerPhone: '(256) 555-0404',
    billingAddress: { street: '808 Madison St SE', city: 'Madison', state: 'AL', zip: '35758' },
    jobAddress: { street: '312 Celtic Ct', city: 'Madison', state: 'AL', zip: '35758' },
    type: 'final', status: 'approved',
    lineItems: [
      { id: 'li-14', description: 'Architectural Shingles (Charcoal)', category: 'materials', quantity: 26, unit: 'bundles', unitPrice: 36.00, total: 936.00, taxable: true },
      { id: 'li-15', description: 'Repair & Re-roof Labor', category: 'labor', quantity: 1, unit: 'job', unitPrice: 2800.00, total: 2800.00, taxable: false },
      { id: 'li-16', description: 'Dump Fee', category: 'disposal', quantity: 1, unit: 'load', unitPrice: 275.00, total: 275.00, taxable: false },
    ],
    subtotal: 4011.00, taxRate: 0.055, taxAmount: 51.48, discount: 0, discountType: 'fixed',
    total: 4062.48, amountPaid: 0, balanceDue: 4062.48, payments: [],
    insuranceClaim: { claimNumber: 'CLM-2026-88421', carrier: 'State Farm', adjusterName: 'Patricia Mills', adjusterPhone: '(256) 555-8800', deductible: 1000.00, approved: true, approvedAmount: 4062.48 },
    dueDate: '2026-02-28', terms: 'Due on Approval',
    notes: 'Insurance claim approved.', internalNotes: 'Property management - 3 units.',
    createdAt: '2026-02-01', updatedAt: '2026-02-06', sentAt: '2026-02-01', createdBy: 'Michael',
  },
  {
    invoiceId: 'INV-2026-0005', jobId: 'JOB-2026-105',
    customerName: 'Oakwood Baptist Church', customerEmail: 'office@oakwoodbaptist.org', customerPhone: '(256) 555-0505',
    billingAddress: { street: '1905 Oakwood Ave NW', city: 'Huntsville', state: 'AL', zip: '35810' },
    jobAddress: { street: '1905 Oakwood Ave NW', city: 'Huntsville', state: 'AL', zip: '35810' },
    type: 'final', status: 'sent',
    lineItems: [
      { id: 'li-17', description: 'Standing Seam Metal Roofing', category: 'materials', quantity: 2400, unit: 'sq ft', unitPrice: 4.50, total: 10800.00, taxable: true },
      { id: 'li-18', description: 'Metal Trim & Flashing Package', category: 'materials', quantity: 1, unit: 'lot', unitPrice: 1850.00, total: 1850.00, taxable: true },
      { id: 'li-19', description: 'Metal Roof Install Labor', category: 'labor', quantity: 1, unit: 'job', unitPrice: 12500.00, total: 12500.00, taxable: false },
      { id: 'li-20', description: 'Scaffolding Rental', category: 'other', quantity: 3, unit: 'weeks', unitPrice: 450.00, total: 1350.00, taxable: false },
    ],
    subtotal: 26500.00, taxRate: 0.055, taxAmount: 695.75, discount: 1000, discountType: 'fixed',
    total: 26195.75, amountPaid: 10000.00, balanceDue: 16195.75,
    payments: [{ paymentId: 'PAY-004', date: '2026-02-03', amount: 10000.00, method: 'check', reference: 'Check #2201', notes: '35% deposit' }],
    dueDate: '2026-03-05', terms: 'Net 30',
    notes: 'Metal roof - main sanctuary. Nonprofit discount applied.', internalNotes: 'Large job - 2 crews needed.',
    createdAt: '2026-02-03', updatedAt: '2026-02-03', sentAt: '2026-02-03', createdBy: 'Michael',
  },
  {
    invoiceId: 'INV-2026-0006', jobId: 'JOB-2026-106',
    customerName: 'Martinez Residence', customerEmail: 'cmartinez@hotmail.com', customerPhone: '(256) 555-0606',
    billingAddress: { street: '614 Holmes Ave NE', city: 'Huntsville', state: 'AL', zip: '35801' },
    jobAddress: { street: '614 Holmes Ave NE', city: 'Huntsville', state: 'AL', zip: '35801' },
    type: 'supplement', status: 'viewed',
    lineItems: [
      { id: 'li-21', description: 'Additional Decking (Water Damage)', category: 'materials', quantity: 12, unit: 'sheets', unitPrice: 42.00, total: 504.00, taxable: true },
      { id: 'li-22', description: 'Fascia Board Replacement', category: 'materials', quantity: 24, unit: 'lin ft', unitPrice: 8.50, total: 204.00, taxable: true },
      { id: 'li-23', description: 'Additional Labor', category: 'labor', quantity: 8, unit: 'hours', unitPrice: 65.00, total: 520.00, taxable: false },
    ],
    subtotal: 1228.00, taxRate: 0.055, taxAmount: 38.94, discount: 0, discountType: 'fixed',
    total: 1266.94, amountPaid: 0, balanceDue: 1266.94, payments: [],
    insuranceClaim: { claimNumber: 'CLM-2026-77192', carrier: 'Allstate', adjusterName: 'Kevin Brooks', adjusterPhone: '(256) 555-7700', deductible: 500.00, approved: false, approvedAmount: 0 },
    dueDate: '2026-03-01', terms: 'Due on Approval',
    notes: 'Supplement for damage found during tear-off.', internalNotes: 'Awaiting adjuster re-inspection 2/15.',
    createdAt: '2026-02-07', updatedAt: '2026-02-09', sentAt: '2026-02-07', createdBy: 'Sarah',
  },
  {
    invoiceId: 'INV-2026-0007', jobId: 'JOB-2026-107',
    customerName: 'Crestwood HOA', customerEmail: 'board@crestwoodhoa.org', customerPhone: '(256) 555-0707',
    billingAddress: { street: '100 Crestwood Blvd', city: 'Huntsville', state: 'AL', zip: '35802' },
    jobAddress: { street: '155 Crestwood Ct', city: 'Huntsville', state: 'AL', zip: '35802' },
    type: 'estimate', status: 'draft',
    lineItems: [
      { id: 'li-24', description: 'Architectural Shingles (Hickory)', category: 'materials', quantity: 180, unit: 'bundles', unitPrice: 38.50, total: 6930.00, taxable: true },
      { id: 'li-25', description: 'Nails, Flashing, Vents Package', category: 'materials', quantity: 1, unit: 'lot', unitPrice: 2200.00, total: 2200.00, taxable: true },
      { id: 'li-26', description: 'Multi-Unit Roof (6 units)', category: 'labor', quantity: 1, unit: 'job', unitPrice: 18000.00, total: 18000.00, taxable: false },
      { id: 'li-27', description: 'Permits (6)', category: 'permit', quantity: 6, unit: 'ea', unitPrice: 150.00, total: 900.00, taxable: false },
    ],
    subtotal: 28030.00, taxRate: 0.055, taxAmount: 501.65, discount: 10, discountType: 'percent',
    total: 25728.65, amountPaid: 0, balanceDue: 25728.65, payments: [],
    dueDate: '2026-03-15', terms: 'Net 30',
    notes: '6-unit townhome estimate. Volume discount applied.', internalNotes: 'HOA board vote on Feb 20.',
    createdAt: '2026-02-09', updatedAt: '2026-02-09', createdBy: 'Michael',
  },
  {
    invoiceId: 'INV-2026-0008', jobId: 'JOB-2026-108',
    customerName: 'Thompson Residence', customerEmail: 'bthompson99@gmail.com', customerPhone: '(256) 555-0808',
    billingAddress: { street: '3401 Memorial Pkwy SW', city: 'Huntsville', state: 'AL', zip: '35801' },
    jobAddress: { street: '3401 Memorial Pkwy SW', city: 'Huntsville', state: 'AL', zip: '35801' },
    type: 'final', status: 'overdue',
    lineItems: [
      { id: 'li-28', description: 'Chimney Flashing Kit', category: 'materials', quantity: 1, unit: 'kit', unitPrice: 185.00, total: 185.00, taxable: true },
      { id: 'li-29', description: 'Repair Labor', category: 'labor', quantity: 4, unit: 'hours', unitPrice: 75.00, total: 300.00, taxable: false },
    ],
    subtotal: 485.00, taxRate: 0.055, taxAmount: 10.18, discount: 0, discountType: 'fixed',
    total: 495.18, amountPaid: 0, balanceDue: 495.18, payments: [],
    dueDate: '2026-01-10', terms: 'Net 15',
    notes: 'Chimney flashing repair.', internalNotes: 'Sent 2 reminders. May need to call.',
    createdAt: '2025-12-26', updatedAt: '2026-02-10', sentAt: '2025-12-26', createdBy: 'Sarah',
  },
  {
    invoiceId: 'INV-2026-0009', jobId: 'JOB-2026-109', breakdownId: 'BRK-2026-109',
    customerName: 'Redstone Federal Credit Union', customerEmail: 'facilities@redfcu.org', customerPhone: '(256) 555-0909',
    billingAddress: { street: '220 Wynn Dr NW', city: 'Huntsville', state: 'AL', zip: '35893' },
    jobAddress: { street: '220 Wynn Dr NW', city: 'Huntsville', state: 'AL', zip: '35893' },
    type: 'progress', status: 'paid',
    lineItems: [
      { id: 'li-30', description: 'Commercial TPO Membrane', category: 'materials', quantity: 5000, unit: 'sq ft', unitPrice: 3.80, total: 19000.00, taxable: true },
      { id: 'li-31', description: 'Commercial Install - Phase 1', category: 'labor', quantity: 1, unit: 'phase', unitPrice: 15000.00, total: 15000.00, taxable: false },
      { id: 'li-32', description: 'Delivery Charges', category: 'delivery', quantity: 3, unit: 'loads', unitPrice: 250.00, total: 750.00, taxable: false },
    ],
    subtotal: 34750.00, taxRate: 0.055, taxAmount: 1045.00, discount: 0, discountType: 'fixed',
    total: 35795.00, amountPaid: 35795.00, balanceDue: 0,
    payments: [
      { paymentId: 'PAY-005', date: '2026-01-20', amount: 17897.50, method: 'check', reference: 'EFT-90211', notes: '50% deposit' },
      { paymentId: 'PAY-006', date: '2026-02-05', amount: 17897.50, method: 'check', reference: 'EFT-90345', notes: 'Phase 1 completion' },
    ],
    dueDate: '2026-02-20', terms: 'Net 30',
    notes: 'Phase 1 - South wing re-roof.', internalNotes: 'Corporate account. EFT payments.',
    createdAt: '2026-01-18', updatedAt: '2026-02-05', sentAt: '2026-01-18', paidAt: '2026-02-05', createdBy: 'Michael',
  },
  {
    invoiceId: 'INV-2026-0010', jobId: 'JOB-2026-110',
    customerName: 'Anderson Residence', customerEmail: 'kanderson@icloud.com', customerPhone: '(256) 555-1010',
    billingAddress: { street: '707 Franklin St SE', city: 'Huntsville', state: 'AL', zip: '35801' },
    jobAddress: { street: '707 Franklin St SE', city: 'Huntsville', state: 'AL', zip: '35801' },
    type: 'credit', status: 'approved',
    lineItems: [
      { id: 'li-33', description: 'Credit - Unused shingles (8 bundles)', category: 'materials', quantity: 8, unit: 'bundles', unitPrice: -38.50, total: -308.00, taxable: true },
    ],
    subtotal: -308.00, taxRate: 0.055, taxAmount: -16.94, discount: 0, discountType: 'fixed',
    total: -324.94, amountPaid: -324.94, balanceDue: 0,
    payments: [{ paymentId: 'PAY-007', date: '2026-02-08', amount: -324.94, method: 'check', reference: 'Check #RCRS-1104', notes: 'Refund' }],
    dueDate: '2026-02-15', terms: 'Immediate',
    notes: 'Credit memo for returned materials.', internalNotes: 'Materials inspected and restocked.',
    createdAt: '2026-02-06', updatedAt: '2026-02-08', sentAt: '2026-02-06', paidAt: '2026-02-08', createdBy: 'Sarah',
  },
  {
    invoiceId: 'INV-2026-0011', jobId: 'JOB-2026-111',
    customerName: 'Heritage Hills Apartments', customerEmail: 'maintenance@heritagehillsapts.com', customerPhone: '(256) 555-1111',
    billingAddress: { street: '5000 Heritage Hills Blvd', city: 'Huntsville', state: 'AL', zip: '35816' },
    jobAddress: { street: '5000 Heritage Hills Blvd Bldg C', city: 'Huntsville', state: 'AL', zip: '35816' },
    type: 'final', status: 'disputed',
    lineItems: [
      { id: 'li-34', description: 'Architectural Shingles (Pewter Gray)', category: 'materials', quantity: 52, unit: 'bundles', unitPrice: 38.50, total: 2002.00, taxable: true },
      { id: 'li-35', description: 'Multi-unit Install Labor', category: 'labor', quantity: 1, unit: 'job', unitPrice: 6500.00, total: 6500.00, taxable: false },
      { id: 'li-36', description: 'Gutter Replacement', category: 'materials', quantity: 60, unit: 'lin ft', unitPrice: 8.00, total: 480.00, taxable: true },
    ],
    subtotal: 8982.00, taxRate: 0.055, taxAmount: 136.51, discount: 0, discountType: 'fixed',
    total: 9118.51, amountPaid: 5000.00, balanceDue: 4118.51,
    payments: [{ paymentId: 'PAY-008', date: '2026-02-01', amount: 5000.00, method: 'check', reference: 'Check #HH-4410', notes: '50% deposit' }],
    dueDate: '2026-02-25', terms: 'Net 30',
    notes: 'Building C - 4 unit re-roof.', internalNotes: 'DISPUTE: Customer claims gutter work incomplete on east side.',
    createdAt: '2026-01-25', updatedAt: '2026-02-09', sentAt: '2026-01-25', createdBy: 'Michael',
  },
  {
    invoiceId: 'INV-2026-0012', jobId: 'JOB-2026-112',
    customerName: 'Chen Residence', customerEmail: 'lchen@email.com', customerPhone: '(256) 555-1212',
    billingAddress: { street: '1102 Monte Sano Blvd SE', city: 'Huntsville', state: 'AL', zip: '35801' },
    jobAddress: { street: '1102 Monte Sano Blvd SE', city: 'Huntsville', state: 'AL', zip: '35801' },
    type: 'final', status: 'paid',
    lineItems: [
      { id: 'li-37', description: 'Cedar Shake Shingles (Premium)', category: 'materials', quantity: 30, unit: 'bundles', unitPrice: 95.00, total: 2850.00, taxable: true },
      { id: 'li-38', description: 'Cedar Shake Install (Specialty)', category: 'labor', quantity: 1, unit: 'job', unitPrice: 8500.00, total: 8500.00, taxable: false },
      { id: 'li-39', description: 'Debris Disposal', category: 'disposal', quantity: 1, unit: 'job', unitPrice: 400.00, total: 400.00, taxable: false },
    ],
    subtotal: 11750.00, taxRate: 0.055, taxAmount: 156.75, discount: 0, discountType: 'fixed',
    total: 11906.75, amountPaid: 11906.75, balanceDue: 0,
    payments: [
      { paymentId: 'PAY-009', date: '2026-01-10', amount: 5953.38, method: 'card', reference: 'CC-AUTH-88421', notes: '50% deposit' },
      { paymentId: 'PAY-010', date: '2026-01-30', amount: 5953.37, method: 'card', reference: 'CC-AUTH-89102', notes: 'Final payment' },
    ],
    dueDate: '2026-02-10', terms: 'Net 30',
    notes: 'Premium cedar shake. 5-year labor warranty.', internalNotes: 'Historic home on Monte Sano. Portfolio piece.',
    createdAt: '2026-01-08', updatedAt: '2026-01-30', sentAt: '2026-01-08', paidAt: '2026-01-30', createdBy: 'Michael',
  },
];

// ============ HELPERS ============

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d: string) => { const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : '')); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

function calcTotals(items: LineItem[], taxRate: number, discount: number, discountType: 'percent' | 'fixed') {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxable = items.filter(i => i.taxable).reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(taxable * taxRate * 100) / 100;
  const discAmt = discountType === 'percent' ? Math.round(subtotal * (discount / 100) * 100) / 100 : discount;
  const total = Math.round((subtotal + taxAmount - discAmt) * 100) / 100;
  return { subtotal, taxAmount, total, discountAmount: discAmt };
}

// ============ MAIN COMPONENT ============

export default function InvoicesPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<InvoiceType | ''>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');

  // --- Form state for Create/Edit ---
  const emptyForm = (): Partial<Invoice> => ({
    customerName: '', customerEmail: '', customerPhone: '',
    billingAddress: { street: '', city: 'Huntsville', state: 'AL', zip: '' },
    jobAddress: { street: '', city: 'Huntsville', state: 'AL', zip: '' },
    jobId: '', type: 'final' as InvoiceType, terms: 'Net 30',
    lineItems: [{ id: 'new-1', description: '', category: 'materials' as LineItemCategory, quantity: 1, unit: 'ea', unitPrice: 0, total: 0, taxable: true }],
    discount: 0, discountType: 'fixed' as const, taxRate: TAX_RATE,
    notes: '', internalNotes: '',
  });
  const [formData, setFormData] = useState<Partial<Invoice>>(emptyForm());
  const [showInsurance, setShowInsurance] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState<InsuranceClaim>({ claimNumber: '', carrier: '', adjusterName: '', adjusterPhone: '', deductible: 0, approved: false, approvedAmount: 0 });

  // --- Payment form state ---
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'check' as PaymentMethod, reference: '', notes: '', date: new Date().toISOString().slice(0, 10) });

  // --- JobNimbus integration state ---
  const [showJNModal, setShowJNModal] = useState(false);
  const [jnContactId, setJnContactId] = useState('');
  const [jnInvoices, setJnInvoices] = useState<JNInvoiceSummary[]>([]);
  const [jnLoading, setJnLoading] = useState(false);
  const [jnError, setJnError] = useState('');
  const [jnImportSuccess, setJnImportSuccess] = useState('');

  // --- JN Comparison state ---
  const [showJNCompare, setShowJNCompare] = useState(false);
  const [compareInvoiceId, setCompareInvoiceId] = useState('');
  const [compareContactJnid, setCompareContactJnid] = useState('');
  const [comparison, setComparison] = useState<InvoiceComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');

  // --- Computed values ---
  const allPayments = useMemo(() => {
    const p: (Payment & { invoiceId: string; customerName: string })[] = [];
    invoices.forEach(inv => inv.payments.forEach(pay => p.push({ ...pay, invoiceId: inv.invoiceId, customerName: inv.customerName })));
    return p.sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices]);

  const kpis = useMemo(() => {
    const outstanding = invoices.filter(i => i.balanceDue > 0 && i.status !== 'cancelled' && i.status !== 'draft');
    const overdue = invoices.filter(i => i.status === 'overdue');
    const thisMonth = invoices.filter(i => i.paidAt && i.paidAt.startsWith('2026-02'));
    const paidInvoices = invoices.filter(i => i.status === 'paid' && i.createdAt && i.paidAt);
    let avgDays = 0;
    if (paidInvoices.length > 0) {
      avgDays = paidInvoices.reduce((s, i) => {
        const created = new Date(i.createdAt).getTime();
        const paid = new Date(i.paidAt!).getTime();
        return s + (paid - created) / (1000 * 60 * 60 * 24);
      }, 0) / paidInvoices.length;
    }
    return {
      totalOutstanding: outstanding.reduce((s, i) => s + i.balanceDue, 0),
      overdueAmount: overdue.reduce((s, i) => s + i.balanceDue, 0),
      paidThisMonth: thisMonth.reduce((s, i) => s + i.amountPaid, 0),
      avgDaysToPay: Math.round(avgDays),
    };
  }, [invoices]);

  const agingData = useMemo(() => {
    const today = new Date();
    const buckets = { current: 0, thirty: 0, sixty: 0, ninety: 0 };
    const counts = { current: 0, thirty: 0, sixty: 0, ninety: 0 };
    invoices.filter(i => i.balanceDue > 0 && !['cancelled', 'draft', 'paid'].includes(i.status)).forEach(inv => {
      const days = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      if (days <= 0) { buckets.current += inv.balanceDue; counts.current++; }
      else if (days <= 30) { buckets.thirty += inv.balanceDue; counts.thirty++; }
      else if (days <= 60) { buckets.sixty += inv.balanceDue; counts.sixty++; }
      else { buckets.ninety += inv.balanceDue; counts.ninety++; }
    });
    return { buckets, counts };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    let list = [...invoices];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.invoiceId.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q) || i.jobId.toLowerCase().includes(q));
    }
    if (statusFilter) list = list.filter(i => i.status === statusFilter);
    if (typeFilter) list = list.filter(i => i.type === typeFilter);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices, searchQuery, statusFilter, typeFilter]);

  // --- Revenue by month for reports ---
  const revenueByMonth = useMemo(() => {
    const months: Record<string, { invoiced: number; collected: number }> = {};
    invoices.forEach(inv => {
      const m = inv.createdAt.slice(0, 7);
      if (!months[m]) months[m] = { invoiced: 0, collected: 0 };
      months[m].invoiced += Math.abs(inv.total);
      months[m].collected += Math.abs(inv.amountPaid);
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({ month, ...d }));
  }, [invoices]);

  const topCustomers = useMemo(() => {
    const cust: Record<string, number> = {};
    invoices.forEach(inv => { cust[inv.customerName] = (cust[inv.customerName] || 0) + Math.abs(inv.total); });
    return Object.entries(cust).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, total]) => ({ name, total }));
  }, [invoices]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(inv => { counts[inv.status] = (counts[inv.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status: status as InvoiceStatus, count }));
  }, [invoices]);

  const paymentMethodBreakdown = useMemo(() => {
    const methods: Record<string, number> = {};
    allPayments.forEach(p => { methods[p.method] = (methods[p.method] || 0) + Math.abs(p.amount); });
    return Object.entries(methods).map(([method, total]) => ({ method, total }));
  }, [allPayments]);

  // --- Handlers ---
  const handleSaveDraft = () => {
    const items = (formData.lineItems || []).map(li => ({ ...li, total: li.quantity * li.unitPrice }));
    const t = calcTotals(items, formData.taxRate || TAX_RATE, formData.discount || 0, formData.discountType || 'fixed');
    const newInv: Invoice = {
      invoiceId: `INV-2026-${String(invoices.length + 1).padStart(4, '0')}`,
      jobId: formData.jobId || '', breakdownId: formData.breakdownId,
      customerName: formData.customerName || '', customerEmail: formData.customerEmail || '',
      customerPhone: formData.customerPhone || '',
      billingAddress: formData.billingAddress || { street: '', city: '', state: 'AL', zip: '' },
      jobAddress: formData.jobAddress || { street: '', city: '', state: 'AL', zip: '' },
      type: formData.type || 'final', status: 'draft', lineItems: items,
      subtotal: t.subtotal, taxRate: formData.taxRate || TAX_RATE, taxAmount: t.taxAmount,
      discount: formData.discount || 0, discountType: formData.discountType || 'fixed',
      total: t.total, amountPaid: 0, balanceDue: t.total, payments: [],
      insuranceClaim: showInsurance ? insuranceForm : undefined,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      terms: formData.terms || 'Net 30', notes: formData.notes || '', internalNotes: formData.internalNotes || '',
      createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10),
      createdBy: 'Michael',
    };
    setInvoices(prev => [...prev, newInv]);
    setFormData(emptyForm());
    setShowInsurance(false);
    setTab('list');
  };

  const handleSendInvoice = () => { handleSaveDraft(); };

  const handleRecordPayment = () => {
    if (!paymentInvoiceId || paymentForm.amount <= 0) return;
    setInvoices(prev => prev.map(inv => {
      if (inv.invoiceId !== paymentInvoiceId) return inv;
      const newPaid = inv.amountPaid + paymentForm.amount;
      const newBalance = inv.total - newPaid;
      return {
        ...inv,
        amountPaid: newPaid, balanceDue: Math.max(0, newBalance),
        status: newBalance <= 0 ? 'paid' : inv.status,
        paidAt: newBalance <= 0 ? new Date().toISOString().slice(0, 10) : inv.paidAt,
        payments: [...inv.payments, { paymentId: `PAY-${Date.now()}`, ...paymentForm }],
        updatedAt: new Date().toISOString().slice(0, 10),
      };
    }));
    setPaymentForm({ amount: 0, method: 'check', reference: '', notes: '', date: new Date().toISOString().slice(0, 10) });
    setPaymentInvoiceId('');
    setShowPaymentForm(false);
  };

  // --- JN Handlers ---
  const handleFetchJNInvoices = async () => {
    if (!jnContactId.trim()) {
      setJnError('Please enter a JobNimbus Contact ID');
      return;
    }
    setJnLoading(true);
    setJnError('');
    setJnImportSuccess('');
    setJnInvoices([]);
    try {
      const res = await fetch('/api/portal/delivery/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-jn-invoices', contactJnid: jnContactId.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setJnError(data.error || 'Failed to fetch JN invoices');
      } else if (data.invoices.length === 0) {
        setJnError('No invoices found for this contact in JobNimbus. Check the Contact ID and try again.');
      } else {
        setJnInvoices(data.invoices);
      }
    } catch (err: any) {
      setJnError(err.message || 'Network error fetching JN invoices');
    } finally {
      setJnLoading(false);
    }
  };

  const handleImportJNInvoice = async (jnInv: JNInvoiceSummary) => {
    setJnLoading(true);
    setJnError('');
    setJnImportSuccess('');
    try {
      // First fetch full detail
      const detailRes = await fetch('/api/portal/delivery/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-jn-invoice-detail', contactJnid: jnContactId.trim(), invoiceJnid: jnInv.jnid }),
      });
      const detailData = await detailRes.json();
      if (!detailData.success) {
        setJnError(detailData.error || 'Failed to fetch JN invoice detail');
        return;
      }

      // Now import it
      const importRes = await fetch('/api/portal/delivery/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import-jn-invoice',
          jnInvoice: { invoice: detailData.invoice, contact: detailData.contact, job: detailData.job },
        }),
      });
      const importData = await importRes.json();
      if (!importData.success) {
        setJnError(importData.error || 'Failed to import JN invoice');
      } else {
        setJnImportSuccess(`Imported as ${importData.invoice.invoiceId}`);
        // Add to local state
        setInvoices(prev => [...prev, {
          ...importData.invoice,
          lineItems: importData.invoice.lineItems || [],
          payments: importData.invoice.payments || [],
        }]);
      }
    } catch (err: any) {
      setJnError(err.message || 'Network error importing JN invoice');
    } finally {
      setJnLoading(false);
    }
  };

  const handleCompareWithJN = async () => {
    if (!compareInvoiceId || !compareContactJnid.trim()) {
      setCompareError('Please select a local invoice and enter a JN Contact ID');
      return;
    }
    setCompareLoading(true);
    setCompareError('');
    setComparison(null);
    try {
      const res = await fetch('/api/portal/delivery/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compare-with-jn', invoiceId: compareInvoiceId, contactJnid: compareContactJnid.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setCompareError(data.error || 'Failed to compare invoices');
      } else {
        setComparison(data.comparison);
      }
    } catch (err: any) {
      setCompareError(err.message || 'Network error comparing invoices');
    } finally {
      setCompareLoading(false);
    }
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      lineItems: [...(prev.lineItems || []), { id: `new-${Date.now()}`, description: '', category: 'materials' as LineItemCategory, quantity: 1, unit: 'ea', unitPrice: 0, total: 0, taxable: true }],
    }));
  };

  const removeLineItem = (id: string) => {
    setFormData(prev => ({ ...prev, lineItems: (prev.lineItems || []).filter(li => li.id !== id) }));
  };

  const updateLineItem = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      lineItems: (prev.lineItems || []).map(li => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') updated.total = updated.quantity * updated.unitPrice;
        return updated;
      }),
    }));
  };

  const formTotals = useMemo(() => {
    const items = (formData.lineItems || []).map(li => ({ ...li, total: li.quantity * li.unitPrice }));
    return calcTotals(items, formData.taxRate || TAX_RATE, formData.discount || 0, formData.discountType || 'fixed');
  }, [formData.lineItems, formData.taxRate, formData.discount, formData.discountType]);

  // ============ RENDER FUNCTIONS ============

  const StatusBadge = ({ status }: { status: InvoiceStatus }) => {
    const c = STATUS_CONFIG[status];
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.color}`}>{c.label}</span>;
  };

  const TypeBadge = ({ type }: { type: InvoiceType }) => {
    const c = TYPE_CONFIG[type];
    return <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>;
  };

  // ---------- TAB: DASHBOARD ----------
  const renderDashboard = () => {
    const maxAging = Math.max(agingData.buckets.current, agingData.buckets.thirty, agingData.buckets.sixty, agingData.buckets.ninety, 1);
    const recentInvoices = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Outstanding', value: fmt(kpis.totalOutstanding), icon: DollarSign, color: 'text-blue-400' },
            { label: 'Overdue Amount', value: fmt(kpis.overdueAmount), icon: AlertTriangle, color: 'text-red-400' },
            { label: 'Paid This Month', value: fmt(kpis.paidThisMonth), icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Avg Days to Pay', value: `${kpis.avgDaysToPay} days`, icon: Clock, color: 'text-amber-400' },
          ].map((kpi, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-xs text-zinc-400">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Aging Chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Accounts Receivable Aging</h3>
          <div className="space-y-3">
            {[
              { label: 'Current', amount: agingData.buckets.current, count: agingData.counts.current, color: 'bg-emerald-500' },
              { label: '1-30 Days', amount: agingData.buckets.thirty, count: agingData.counts.thirty, color: 'bg-amber-500' },
              { label: '31-60 Days', amount: agingData.buckets.sixty, count: agingData.counts.sixty, color: 'bg-orange-500' },
              { label: '90+ Days', amount: agingData.buckets.ninety, count: agingData.counts.ninety, color: 'bg-red-500' },
            ].map((b, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">{b.label} ({b.count})</span>
                  <span className="text-white font-medium">{fmt(b.amount)}</span>
                </div>
                <div className="h-5 bg-zinc-800 rounded overflow-hidden">
                  <div className={`h-full ${b.color} rounded transition-all`} style={{ width: `${Math.max((b.amount / maxAging) * 100, 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions + Recent */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button onClick={() => { setFormData(emptyForm()); setTab('create'); }} className="w-full flex items-center gap-2 px-3 py-2 bg-[#39FF14]/10 text-[#39FF14] rounded hover:bg-[#39FF14]/20 text-sm">
                <Plus className="w-4 h-4" /> Create Invoice
              </button>
              <button onClick={() => { setStatusFilter('overdue'); setTab('list'); }} className="w-full flex items-center gap-2 px-3 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 text-sm">
                <AlertTriangle className="w-4 h-4" /> View Overdue ({invoices.filter(i => i.status === 'overdue').length})
              </button>
              <button onClick={() => { setShowPaymentForm(true); setTab('payments'); }} className="w-full flex items-center gap-2 px-3 py-2 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 text-sm">
                <CreditCard className="w-4 h-4" /> Record Payment
              </button>
              <button onClick={() => { setShowJNModal(true); setJnError(''); setJnImportSuccess(''); setJnInvoices([]); }} className="w-full flex items-center gap-2 px-3 py-2 bg-purple-900/30 text-purple-400 rounded hover:bg-purple-900/50 text-sm">
                <DownloadCloud className="w-4 h-4" /> Import from JobNimbus
              </button>
            </div>
          </div>
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Recent Invoices</h3>
            <div className="space-y-2">
              {recentInvoices.map(inv => (
                <div key={inv.invoiceId} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-zinc-500 font-mono">{inv.invoiceId}</span>
                    <span className="text-sm text-white truncate">{inv.customerName}</span>
                    <TypeBadge type={inv.type} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{fmt(inv.total)}</span>
                    <StatusBadge status={inv.status} />
                    <button onClick={() => setPreviewInvoice(inv)} className="text-zinc-500 hover:text-white"><Eye className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- TAB: CREATE/EDIT ----------
  const renderCreate = () => (
    <div className="space-y-6">
      {/* Customer Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-[#39FF14]" /> Customer Information</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className="block text-xs text-zinc-400 mb-1">Customer Name *</label>
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.customerName || ''} onChange={e => setFormData(p => ({ ...p, customerName: e.target.value }))} /></div>
          <div><label className="block text-xs text-zinc-400 mb-1">Email</label>
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.customerEmail || ''} onChange={e => setFormData(p => ({ ...p, customerEmail: e.target.value }))} /></div>
          <div><label className="block text-xs text-zinc-400 mb-1">Phone</label>
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.customerPhone || ''} onChange={e => setFormData(p => ({ ...p, customerPhone: e.target.value }))} /></div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Billing Address</label>
            <input placeholder="Street" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white mb-2" value={formData.billingAddress?.street || ''} onChange={e => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress!, street: e.target.value } }))} />
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="City" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.billingAddress?.city || ''} onChange={e => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress!, city: e.target.value } }))} />
              <input placeholder="State" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.billingAddress?.state || ''} onChange={e => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress!, state: e.target.value } }))} />
              <input placeholder="ZIP" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.billingAddress?.zip || ''} onChange={e => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress!, zip: e.target.value } }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Job Address</label>
            <input placeholder="Street" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white mb-2" value={formData.jobAddress?.street || ''} onChange={e => setFormData(p => ({ ...p, jobAddress: { ...p.jobAddress!, street: e.target.value } }))} />
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="City" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.jobAddress?.city || ''} onChange={e => setFormData(p => ({ ...p, jobAddress: { ...p.jobAddress!, city: e.target.value } }))} />
              <input placeholder="State" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.jobAddress?.state || ''} onChange={e => setFormData(p => ({ ...p, jobAddress: { ...p.jobAddress!, state: e.target.value } }))} />
              <input placeholder="ZIP" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.jobAddress?.zip || ''} onChange={e => setFormData(p => ({ ...p, jobAddress: { ...p.jobAddress!, zip: e.target.value } }))} />
            </div>
          </div>
        </div>
      </div>

      {/* Job Reference & Type */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-[#39FF14]" /> Invoice Details</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className="block text-xs text-zinc-400 mb-1">Job ID</label>
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" placeholder="JOB-2026-XXX" value={formData.jobId || ''} onChange={e => setFormData(p => ({ ...p, jobId: e.target.value }))} /></div>
          <div><label className="block text-xs text-zinc-400 mb-1">Invoice Type</label>
            <select className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.type || 'final'} onChange={e => setFormData(p => ({ ...p, type: e.target.value as InvoiceType }))}>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          <div><label className="block text-xs text-zinc-400 mb-1">Payment Terms</label>
            <select className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.terms || 'Net 30'} onChange={e => setFormData(p => ({ ...p, terms: e.target.value }))}>
              {TERMS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Receipt className="w-4 h-4 text-[#39FF14]" /> Line Items</h3>
          <button onClick={addLineItem} className="flex items-center gap-1 px-3 py-1 bg-[#39FF14]/10 text-[#39FF14] rounded text-xs hover:bg-[#39FF14]/20"><Plus className="w-3 h-3" /> Add Item</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-zinc-500 border-b border-zinc-800">
              <th className="text-left pb-2 pr-2">Description</th><th className="text-left pb-2 pr-2 w-24">Category</th>
              <th className="text-right pb-2 pr-2 w-16">Qty</th><th className="text-left pb-2 pr-2 w-16">Unit</th>
              <th className="text-right pb-2 pr-2 w-24">Price</th><th className="text-right pb-2 pr-2 w-24">Total</th>
              <th className="text-center pb-2 w-12">Tax</th><th className="pb-2 w-8" />
            </tr></thead>
            <tbody>
              {(formData.lineItems || []).map(li => (
                <tr key={li.id} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-2"><input className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white" value={li.description} onChange={e => updateLineItem(li.id, 'description', e.target.value)} /></td>
                  <td className="py-2 pr-2"><select className="w-full bg-zinc-800 border border-zinc-700 rounded px-1 py-1 text-xs text-white" value={li.category} onChange={e => updateLineItem(li.id, 'category', e.target.value)}>
                    {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select></td>
                  <td className="py-2 pr-2"><input type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white text-right" value={li.quantity} onChange={e => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)} /></td>
                  <td className="py-2 pr-2"><input className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white" value={li.unit} onChange={e => updateLineItem(li.id, 'unit', e.target.value)} /></td>
                  <td className="py-2 pr-2"><input type="number" step="0.01" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white text-right" value={li.unitPrice} onChange={e => updateLineItem(li.id, 'unitPrice', parseFloat(e.target.value) || 0)} /></td>
                  <td className="py-2 pr-2 text-right text-white font-medium">{fmt(li.quantity * li.unitPrice)}</td>
                  <td className="py-2 text-center"><input type="checkbox" checked={li.taxable} onChange={e => updateLineItem(li.id, 'taxable', e.target.checked)} className="accent-[#39FF14]" /></td>
                  <td className="py-2"><button onClick={() => removeLineItem(li.id)} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">Subtotal</span><span className="text-white">{fmt(formTotals.subtotal)}</span></div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-zinc-400">Discount</span>
              <div className="flex items-center gap-1">
                <input type="number" className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white text-right" value={formData.discount || 0} onChange={e => setFormData(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))} />
                <select className="bg-zinc-800 border border-zinc-700 rounded px-1 py-1 text-xs text-white" value={formData.discountType || 'fixed'} onChange={e => setFormData(p => ({ ...p, discountType: e.target.value as any }))}>
                  <option value="fixed">$</option><option value="percent">%</option>
                </select>
              </div>
              <span className="text-white">-{fmt(formTotals.discountAmount)}</span>
            </div>
            <div className="flex justify-between"><span className="text-zinc-400">Tax (5.5%)</span><span className="text-white">{fmt(formTotals.taxAmount)}</span></div>
            <div className="flex justify-between border-t border-zinc-700 pt-2"><span className="text-white font-semibold">Total</span><span className="text-[#39FF14] font-bold text-lg">{fmt(formTotals.total)}</span></div>
          </div>
        </div>
      </div>

      {/* Insurance (optional) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Shield className="w-4 h-4 text-[#39FF14]" /> Insurance Claim (Optional)</h3>
          <button onClick={() => setShowInsurance(!showInsurance)} className="text-xs text-[#39FF14] hover:underline">{showInsurance ? 'Remove' : 'Add Insurance Info'}</button>
        </div>
        {showInsurance && (
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-zinc-400 mb-1">Claim Number</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={insuranceForm.claimNumber} onChange={e => setInsuranceForm(p => ({ ...p, claimNumber: e.target.value }))} /></div>
            <div><label className="block text-xs text-zinc-400 mb-1">Carrier</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={insuranceForm.carrier} onChange={e => setInsuranceForm(p => ({ ...p, carrier: e.target.value }))} /></div>
            <div><label className="block text-xs text-zinc-400 mb-1">Adjuster Name</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={insuranceForm.adjusterName} onChange={e => setInsuranceForm(p => ({ ...p, adjusterName: e.target.value }))} /></div>
            <div><label className="block text-xs text-zinc-400 mb-1">Adjuster Phone</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={insuranceForm.adjusterPhone} onChange={e => setInsuranceForm(p => ({ ...p, adjusterPhone: e.target.value }))} /></div>
            <div><label className="block text-xs text-zinc-400 mb-1">Deductible</label>
              <input type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={insuranceForm.deductible} onChange={e => setInsuranceForm(p => ({ ...p, deductible: parseFloat(e.target.value) || 0 }))} /></div>
            <div><label className="block text-xs text-zinc-400 mb-1">Approved Amount</label>
              <input type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={insuranceForm.approvedAmount} onChange={e => setInsuranceForm(p => ({ ...p, approvedAmount: parseFloat(e.target.value) || 0, approved: parseFloat(e.target.value) > 0 }))} /></div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Notes</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-xs text-zinc-400 mb-1">Customer-facing Notes</label>
            <textarea rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} /></div>
          <div><label className="block text-xs text-zinc-400 mb-1">Internal Notes</label>
            <textarea rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={formData.internalNotes || ''} onChange={e => setFormData(p => ({ ...p, internalNotes: e.target.value }))} /></div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button onClick={() => { setFormData(emptyForm()); setShowInsurance(false); }} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 text-sm">Clear</button>
        <button onClick={handleSaveDraft} className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 text-sm flex items-center gap-2"><Save className="w-4 h-4" /> Save Draft</button>
        <button onClick={handleSendInvoice} className="px-4 py-2 bg-[#39FF14] text-black rounded hover:bg-[#39FF14]/90 text-sm font-medium flex items-center gap-2"><Send className="w-4 h-4" /> Save & Send</button>
      </div>
    </div>
  );

  // ---------- TAB: LIST ----------
  const renderList = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input placeholder="Search invoices..." className="w-full bg-zinc-900 border border-zinc-800 rounded pl-10 pr-3 py-2 text-sm text-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-white" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-white" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
          <option value="">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(statusFilter || typeFilter || searchQuery) && (
          <button onClick={() => { setStatusFilter(''); setTypeFilter(''); setSearchQuery(''); }} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"><X className="w-3 h-3" /> Clear</button>
        )}
        <button onClick={() => { setShowJNModal(true); setJnError(''); setJnImportSuccess(''); setJnInvoices([]); }} className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 text-purple-400 rounded hover:bg-purple-900/50 text-sm whitespace-nowrap">
          <DownloadCloud className="w-4 h-4" /> Import from JN
        </button>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-zinc-500 border-b border-zinc-800">
            <th className="text-left p-3">Invoice #</th><th className="text-left p-3">Customer</th>
            <th className="text-left p-3">Type</th><th className="text-right p-3">Amount</th>
            <th className="text-right p-3">Balance</th><th className="text-center p-3">Status</th>
            <th className="text-left p-3">Due Date</th><th className="text-center p-3">Actions</th>
          </tr></thead>
          <tbody>
            {filteredInvoices.map(inv => {
              const isOverdue = inv.status === 'overdue';
              return (
                <tr key={inv.invoiceId} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${isOverdue ? 'bg-red-950/20' : ''}`}>
                  <td className="p-3 font-mono text-xs text-zinc-300">{inv.invoiceId}</td>
                  <td className="p-3">
                    <div className="text-white text-sm">{inv.customerName}</div>
                    <div className="text-xs text-zinc-500">{inv.jobId}</div>
                  </td>
                  <td className="p-3"><TypeBadge type={inv.type} /></td>
                  <td className="p-3 text-right text-white font-medium">{fmt(inv.total)}</td>
                  <td className={`p-3 text-right font-medium ${inv.balanceDue > 0 ? (isOverdue ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'}`}>{fmt(inv.balanceDue)}</td>
                  <td className="p-3 text-center"><StatusBadge status={inv.status} /></td>
                  <td className={`p-3 text-sm ${isOverdue ? 'text-red-400' : 'text-zinc-400'}`}>{fmtDate(inv.dueDate)}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setPreviewInvoice(inv)} className="p-1 text-zinc-500 hover:text-white" title="View"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { const d = { ...inv }; setFormData(d); setSelectedInvoice(inv); setTab('create'); }} className="p-1 text-zinc-500 hover:text-blue-400" title="Edit"><Edit className="w-4 h-4" /></button>
                      {inv.balanceDue > 0 && <button onClick={() => { setPaymentInvoiceId(inv.invoiceId); setShowPaymentForm(true); setTab('payments'); }} className="p-1 text-zinc-500 hover:text-emerald-400" title="Record Payment"><CreditCard className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredInvoices.length === 0 && <div className="p-8 text-center text-zinc-500">No invoices match your filters.</div>}
      </div>
      <div className="text-xs text-zinc-500 text-right">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}</div>
    </div>
  );

  // ---------- TAB: PAYMENTS & PRICING ----------
  const renderPayments = () => {
    const unpaidInvoices = invoices.filter(i => i.balanceDue > 0 && i.status !== 'cancelled' && i.status !== 'draft');
    // Mock pricing discrepancies
    const mockDiscrepancies = [
      { lineItemId: 'li-3', description: 'Galvanized Roofing Nails (1.25")', invoicedPrice: 64.90, currentPrice: 64.90, difference: 0, percentDiff: 0, matchedProductId: 'item-123' },
      { lineItemId: 'li-2', description: 'Synthetic Underlayment', invoicedPrice: 79.86, currentPrice: 79.86, difference: 0, percentDiff: 0, matchedProductId: 'item-125' },
      { lineItemId: 'li-17', description: 'Standing Seam Metal Roofing', invoicedPrice: 4.50, currentPrice: 3.95, difference: 0.55, percentDiff: 13.9, matchedProductId: undefined },
    ];
    return (
      <div className="space-y-6">
        {/* Record Payment */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#39FF14]" /> Record Payment</h3>
          {showPaymentForm || true ? (
            <div className="grid md:grid-cols-3 gap-4">
              <div><label className="block text-xs text-zinc-400 mb-1">Invoice *</label>
                <select className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={paymentInvoiceId} onChange={e => setPaymentInvoiceId(e.target.value)}>
                  <option value="">Select invoice...</option>
                  {unpaidInvoices.map(inv => <option key={inv.invoiceId} value={inv.invoiceId}>{inv.invoiceId} - {inv.customerName} ({fmt(inv.balanceDue)} due)</option>)}
                </select></div>
              <div><label className="block text-xs text-zinc-400 mb-1">Amount *</label>
                <input type="number" step="0.01" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={paymentForm.amount || ''} onChange={e => setPaymentForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} /></div>
              <div><label className="block text-xs text-zinc-400 mb-1">Method</label>
                <select className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={paymentForm.method} onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value as PaymentMethod }))}>
                  <option value="check">Check</option><option value="cash">Cash</option><option value="card">Credit Card</option><option value="insurance">Insurance</option><option value="financing">Financing</option>
                </select></div>
              <div><label className="block text-xs text-zinc-400 mb-1">Date</label>
                <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={paymentForm.date} onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))} /></div>
              <div><label className="block text-xs text-zinc-400 mb-1">Reference</label>
                <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" placeholder="Check #, Auth code, etc." value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} /></div>
              <div><label className="block text-xs text-zinc-400 mb-1">Notes</label>
                <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white" value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
          ) : null}
          <div className="mt-4">
            <button onClick={handleRecordPayment} disabled={!paymentInvoiceId || paymentForm.amount <= 0} className="px-4 py-2 bg-[#39FF14] text-black rounded text-sm font-medium hover:bg-[#39FF14]/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Record Payment</button>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Payments</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-zinc-500 border-b border-zinc-800">
                <th className="text-left p-2">Date</th><th className="text-left p-2">Invoice</th><th className="text-left p-2">Customer</th>
                <th className="text-right p-2">Amount</th><th className="text-left p-2">Method</th><th className="text-left p-2">Reference</th>
              </tr></thead>
              <tbody>
                {allPayments.slice(0, 15).map((p, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="p-2 text-zinc-400">{fmtDate(p.date)}</td>
                    <td className="p-2 font-mono text-xs text-zinc-300">{p.invoiceId}</td>
                    <td className="p-2 text-white">{p.customerName}</td>
                    <td className={`p-2 text-right font-medium ${p.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(p.amount)}</td>
                    <td className="p-2 text-zinc-400 capitalize">{p.method}</td>
                    <td className="p-2 text-zinc-500 text-xs">{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Payment Methods</h3>
            {(() => {
              const maxMethod = Math.max(...paymentMethodBreakdown.map(m => m.total), 1);
              const colors: Record<string, string> = { check: 'bg-brand-green', cash: 'bg-emerald-500', card: 'bg-purple-500', insurance: 'bg-amber-500', financing: 'bg-pink-500' };
              return (
                <div className="space-y-3">
                  {paymentMethodBreakdown.map((m, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400 capitalize">{m.method}</span>
                        <span className="text-white">{fmt(m.total)}</span>
                      </div>
                      <div className="h-4 bg-zinc-800 rounded overflow-hidden">
                        <div className={`h-full ${colors[m.method] || 'bg-zinc-500'} rounded`} style={{ width: `${(m.total / maxMethod) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Pricing Verification */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-[#39FF14]" /> Pricing Verification</h3>
            <p className="text-xs text-zinc-500 mb-3">Compares invoice line items against current inventory pricing. Items with &gt;5% difference are flagged.</p>
            <div className="space-y-2">
              {mockDiscrepancies.map((d, i) => (
                <div key={i} className={`p-3 rounded border ${d.percentDiff > 5 ? 'border-amber-700 bg-amber-950/20' : 'border-zinc-800 bg-zinc-800/50'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-sm text-white">{d.description}</span>
                      <div className="text-xs text-zinc-500 mt-1">Invoiced: {fmt(d.invoicedPrice)} | Current: {fmt(d.currentPrice)}</div>
                    </div>
                    {d.percentDiff > 5 ? (
                      <span className="px-2 py-0.5 bg-amber-900/40 text-amber-400 text-xs rounded">+{d.percentDiff}%</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-900/40 text-emerald-400 text-xs rounded">Match</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compare with JobNimbus */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-purple-400" /> Compare with JobNimbus
          </h3>
          <p className="text-xs text-zinc-500 mb-4">Select a local invoice and enter the JN Contact ID to compare amounts, status, and payments side-by-side.</p>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Local Invoice *</label>
              <select
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                value={compareInvoiceId}
                onChange={e => setCompareInvoiceId(e.target.value)}
              >
                <option value="">Select invoice...</option>
                {invoices.map(inv => (
                  <option key={inv.invoiceId} value={inv.invoiceId}>
                    {inv.invoiceId} - {inv.customerName} ({fmt(inv.total)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">JN Contact ID *</label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                placeholder="e.g. abc123..."
                value={compareContactJnid}
                onChange={e => setCompareContactJnid(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCompareWithJN}
                disabled={compareLoading || !compareInvoiceId || !compareContactJnid.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {compareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Compare
              </button>
            </div>
          </div>

          {compareError && (
            <div className="p-3 bg-red-950/30 border border-red-800 rounded text-red-400 text-sm mb-4">{compareError}</div>
          )}

          {comparison && (
            <div className="space-y-4">
              {!comparison.matched ? (
                <div className="p-4 bg-amber-950/20 border border-amber-800 rounded">
                  <div className="text-amber-400 text-sm font-medium mb-1">No Match Found</div>
                  <div className="text-xs text-zinc-400">
                    {comparison.differences.map((d, i) => (
                      <span key={i}>{typeof d.local === 'string' ? d.local : d.field}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-emerald-950/20 border border-emerald-800 rounded text-emerald-400 text-sm">
                    Matched JN Invoice: {comparison.jnInvoice?.invoiceNumber || comparison.jnInvoice?.jnid} - {comparison.jnInvoice?.customerName}
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                          <th className="text-left p-2">Field</th>
                          <th className="text-right p-2">Local</th>
                          <th className="text-right p-2">JobNimbus</th>
                          <th className="text-center p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { field: 'Total', local: comparison.localInvoice?.total || 0, jn: comparison.jnInvoice?.total || 0 },
                          { field: 'Amount Paid', local: comparison.localInvoice?.amountPaid || 0, jn: comparison.jnInvoice?.amountPaid || 0 },
                          { field: 'Balance', local: comparison.localInvoice?.balanceDue || 0, jn: comparison.jnInvoice?.balance || 0 },
                          { field: 'Status', local: comparison.localInvoice?.status || '-', jn: comparison.jnInvoice?.status || '-' },
                        ].map((row, i) => {
                          const hasDiff = comparison.differences.some(d => d.field === row.field);
                          const isNumber = typeof row.local === 'number';
                          return (
                            <tr key={i} className={`border-b border-zinc-800/50 ${hasDiff ? 'bg-amber-950/10' : ''}`}>
                              <td className="p-2 text-zinc-400">{row.field}</td>
                              <td className="p-2 text-right text-white">{isNumber ? fmt(row.local as number) : row.local}</td>
                              <td className="p-2 text-right text-white">{isNumber ? fmt(row.jn as number) : row.jn}</td>
                              <td className="p-2 text-center">
                                {hasDiff ? (
                                  <span className="px-2 py-0.5 bg-amber-900/40 text-amber-400 text-xs rounded">Differs</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-900/40 text-emerald-400 text-xs rounded">Match</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {comparison.differences.length === 0 && (
                    <div className="text-xs text-emerald-400 text-center py-2">All fields match between local and JobNimbus records.</div>
                  )}
                  {comparison.differences.length > 0 && (
                    <div className="text-xs text-amber-400 text-center py-2">
                      {comparison.differences.length} difference{comparison.differences.length !== 1 ? 's' : ''} found. Review and update as needed.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---------- TAB: REPORTS ----------
  const renderReports = () => {
    const totalInvoiced = invoices.reduce((s, i) => s + Math.abs(i.total), 0);
    const totalCollected = invoices.reduce((s, i) => s + Math.abs(i.amountPaid), 0);
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
    const maxRevenue = Math.max(...revenueByMonth.map(m => m.invoiced), 1);
    const maxCustomer = topCustomers.length > 0 ? topCustomers[0].total : 1;
    const totalStatusCount = statusBreakdown.reduce((s, b) => s + b.count, 0);

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Invoiced', value: fmt(totalInvoiced), color: 'text-blue-400' },
            { label: 'Total Collected', value: fmt(totalCollected), color: 'text-emerald-400' },
            { label: 'Collection Rate', value: `${collectionRate.toFixed(1)}%`, color: 'text-[#39FF14]' },
            { label: 'Invoice Count', value: String(invoices.length), color: 'text-amber-400' },
          ].map((c, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs text-zinc-400 mb-1">{c.label}</div>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Revenue by Month */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#39FF14]" /> Revenue by Month</h3>
          <div className="space-y-3">
            {revenueByMonth.map((m, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">{m.month}</span>
                  <span className="text-white">Invoiced: {fmt(m.invoiced)} | Collected: {fmt(m.collected)}</span>
                </div>
                <div className="h-6 bg-zinc-800 rounded overflow-hidden relative">
                  <div className="h-full bg-brand-green/50 rounded absolute top-0 left-0" style={{ width: `${(m.invoiced / maxRevenue) * 100}%` }} />
                  <div className="h-full bg-emerald-500 rounded absolute top-0 left-0" style={{ width: `${(m.collected / maxRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="flex gap-4 text-xs text-zinc-500 mt-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-green/50 rounded" /> Invoiced</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded" /> Collected</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Status Breakdown (pie-like) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-[#39FF14]" /> Invoice Status Breakdown</h3>
            <div className="space-y-2">
              {statusBreakdown.map((b, i) => {
                const cfg = STATUS_CONFIG[b.status];
                const pct = totalStatusCount > 0 ? (b.count / totalStatusCount) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-20 text-xs ${cfg.color}`}>{cfg.label}</span>
                    <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                      <div className={`h-full rounded ${cfg.bg}`} style={{ width: `${pct}%`, minWidth: pct > 0 ? '8px' : '0' }} />
                    </div>
                    <span className="text-xs text-zinc-400 w-12 text-right">{b.count} ({pct.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Customers */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#39FF14]" /> Top Customers by Revenue</h3>
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white">{c.name}</span>
                    <span className="text-zinc-400">{fmt(c.total)}</span>
                  </div>
                  <div className="h-4 bg-zinc-800 rounded overflow-hidden">
                    <div className="h-full bg-[#39FF14]/30 rounded" style={{ width: `${(c.total / maxCustomer) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Aging Report Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Aging Report</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-zinc-500 border-b border-zinc-800">
              <th className="text-left p-2">Bucket</th><th className="text-right p-2"># Invoices</th><th className="text-right p-2">Amount</th><th className="text-right p-2">% of Total</th>
            </tr></thead>
            <tbody>
              {[
                { label: 'Current', ...agingData.buckets, amount: agingData.buckets.current, count: agingData.counts.current, color: 'text-emerald-400' },
                { label: '1-30 Days', amount: agingData.buckets.thirty, count: agingData.counts.thirty, color: 'text-amber-400' },
                { label: '31-60 Days', amount: agingData.buckets.sixty, count: agingData.counts.sixty, color: 'text-orange-400' },
                { label: '90+ Days', amount: agingData.buckets.ninety, count: agingData.counts.ninety, color: 'text-red-400' },
              ].map((row, i) => {
                const totalOut = agingData.buckets.current + agingData.buckets.thirty + agingData.buckets.sixty + agingData.buckets.ninety;
                const pct = totalOut > 0 ? (row.amount / totalOut) * 100 : 0;
                return (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className={`p-2 ${row.color} font-medium`}>{row.label}</td>
                    <td className="p-2 text-right text-zinc-300">{row.count}</td>
                    <td className="p-2 text-right text-white">{fmt(row.amount)}</td>
                    <td className="p-2 text-right text-zinc-400">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="p-2 text-white">Total Outstanding</td>
                <td className="p-2 text-right text-white">{agingData.counts.current + agingData.counts.thirty + agingData.counts.sixty + agingData.counts.ninety}</td>
                <td className="p-2 text-right text-[#39FF14]">{fmt(agingData.buckets.current + agingData.buckets.thirty + agingData.buckets.sixty + agingData.buckets.ninety)}</td>
                <td className="p-2 text-right text-zinc-400">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Avg Time to Payment */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Performance Metrics</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#39FF14]">{kpis.avgDaysToPay}</div>
              <div className="text-xs text-zinc-500">Avg Days to Payment</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{collectionRate.toFixed(1)}%</div>
              <div className="text-xs text-zinc-500">Collection Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{fmt(totalInvoiced / (invoices.length || 1))}</div>
              <div className="text-xs text-zinc-500">Average Invoice</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{invoices.filter(i => i.status === 'overdue').length}</div>
              <div className="text-xs text-zinc-500">Overdue Invoices</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- INVOICE PREVIEW MODAL ----------
  const renderPreview = () => {
    if (!previewInvoice) return null;
    const inv = previewInvoice;
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10">
        <div className="bg-white text-black rounded-lg shadow-xl max-w-2xl w-full p-8 relative">
          <button onClick={() => setPreviewInvoice(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-black"><X className="w-5 h-5" /></button>

          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-black">River City Roofing Solutions</h2>
              <p className="text-xs text-zinc-500">(256) 274-8530 | rcrs@rivercityroofingsolutions.com</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-black">{inv.type === 'credit' ? 'CREDIT MEMO' : 'INVOICE'}</div>
              <div className="text-sm font-mono text-zinc-600">{inv.invoiceId}</div>
              <div className="text-xs text-zinc-500">Date: {fmtDate(inv.createdAt)}</div>
              <div className="text-xs text-zinc-500">Due: {fmtDate(inv.dueDate)}</div>
            </div>
          </div>

          {/* Bill To / Job */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <div className="text-xs font-semibold text-zinc-500 mb-1 uppercase">Bill To</div>
              <div className="font-medium">{inv.customerName}</div>
              <div className="text-zinc-600">{inv.billingAddress.street}</div>
              <div className="text-zinc-600">{inv.billingAddress.city}, {inv.billingAddress.state} {inv.billingAddress.zip}</div>
              {inv.customerEmail && <div className="text-zinc-500 text-xs mt-1">{inv.customerEmail}</div>}
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500 mb-1 uppercase">Job Address</div>
              <div className="text-zinc-600">{inv.jobAddress.street}</div>
              <div className="text-zinc-600">{inv.jobAddress.city}, {inv.jobAddress.state} {inv.jobAddress.zip}</div>
              <div className="text-zinc-500 text-xs mt-1">Job: {inv.jobId}</div>
              <div className="text-zinc-500 text-xs">Terms: {inv.terms}</div>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-sm mb-4">
            <thead><tr className="border-b-2 border-black text-xs">
              <th className="text-left py-2">Description</th><th className="text-right py-2 w-16">Qty</th>
              <th className="text-right py-2 w-20">Rate</th><th className="text-right py-2 w-24">Amount</th>
            </tr></thead>
            <tbody>
              {inv.lineItems.map(li => (
                <tr key={li.id} className="border-b border-zinc-200">
                  <td className="py-2">{li.description}{li.taxable && <span className="text-xs text-zinc-400 ml-1">*</span>}</td>
                  <td className="py-2 text-right">{li.quantity} {li.unit}</td>
                  <td className="py-2 text-right">{fmt(li.unitPrice)}</td>
                  <td className="py-2 text-right">{fmt(li.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span>{fmt(inv.subtotal)}</span></div>
              {inv.discount > 0 && <div className="flex justify-between"><span className="text-zinc-500">Discount {inv.discountType === 'percent' ? `(${inv.discount}%)` : ''}</span><span className="text-red-400">-{fmt(inv.discountType === 'percent' ? inv.subtotal * inv.discount / 100 : inv.discount)}</span></div>}
              <div className="flex justify-between"><span className="text-zinc-500">Tax (5.5%) *</span><span>{fmt(inv.taxAmount)}</span></div>
              <div className="flex justify-between font-bold border-t border-black pt-1 text-base"><span>Total</span><span>{fmt(inv.total)}</span></div>
              {inv.amountPaid > 0 && <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{fmt(inv.amountPaid)}</span></div>}
              {inv.balanceDue !== 0 && <div className="flex justify-between font-bold text-red-400"><span>Balance Due</span><span>{fmt(inv.balanceDue)}</span></div>}
            </div>
          </div>

          <p className="text-xs text-zinc-400 mt-2">* Taxable items (AL State 4% + Madison County 0.5% + Huntsville 1%)</p>

          {/* Insurance */}
          {inv.insuranceClaim && (
            <div className="mt-4 p-3 bg-brand-green/10 border border-blue-500/20 rounded text-xs">
              <div className="font-semibold text-blue-400 mb-1">Insurance Claim</div>
              <div>Carrier: {inv.insuranceClaim.carrier} | Claim: {inv.insuranceClaim.claimNumber}</div>
              <div>Adjuster: {inv.insuranceClaim.adjusterName} | Deductible: {fmt(inv.insuranceClaim.deductible)}</div>
              <div>Status: {inv.insuranceClaim.approved ? `Approved (${fmt(inv.insuranceClaim.approvedAmount)})` : 'Pending Approval'}</div>
            </div>
          )}

          {/* Notes */}
          {inv.notes && <div className="mt-4 text-xs text-zinc-600 border-t border-zinc-200 pt-3"><span className="font-semibold">Notes:</span> {inv.notes}</div>}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-zinc-200 text-center text-xs text-zinc-400">
            <p>River City Roofing Solutions | (256) 274-8530 | rcrs@rivercityroofingsolutions.com</p>
            <p>Thank you for your business!</p>
          </div>
        </div>
      </div>
    );
  };

  // ============ MAIN LAYOUT ============

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'create', label: 'Create Invoice', icon: Plus },
    { id: 'list', label: 'All Invoices', icon: FileText },
    { id: 'payments', label: 'Payments & Pricing', icon: CreditCard },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/delivery" className="text-zinc-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-[#39FF14]" /> Invoice & Billing</h1>
              <p className="text-xs text-zinc-500">Manage invoices, payments, and financial reports</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{invoices.length} invoices</span>
            <span className="text-zinc-700">|</span>
            <span className="text-[#39FF14]">{fmt(kpis.totalOutstanding)} outstanding</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-[#39FF14] text-[#39FF14]' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {tab === 'dashboard' && renderDashboard()}
        {tab === 'create' && renderCreate()}
        {tab === 'list' && renderList()}
        {tab === 'payments' && renderPayments()}
        {tab === 'reports' && renderReports()}
      </div>

      {/* JN Import Modal */}
      {showJNModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-3xl w-full p-6 relative">
            <button onClick={() => setShowJNModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>

            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-purple-400" /> Import from JobNimbus
            </h2>
            <p className="text-xs text-zinc-500 mb-4">Enter a JN Contact ID to fetch their invoices. You can then import individual invoices into the local system.</p>

            {/* Search */}
            <div className="flex gap-3 mb-4">
              <input
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                placeholder="JobNimbus Contact ID (jnid)"
                value={jnContactId}
                onChange={e => setJnContactId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchJNInvoices()}
              />
              <button
                onClick={handleFetchJNInvoices}
                disabled={jnLoading || !jnContactId.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {jnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Fetch Invoices
              </button>
            </div>

            {/* Messages */}
            {jnError && (
              <div className="p-3 bg-red-950/30 border border-red-800 rounded text-red-400 text-sm mb-4">{jnError}</div>
            )}
            {jnImportSuccess && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800 rounded text-emerald-400 text-sm mb-4">
                <CheckCircle2 className="w-4 h-4 inline mr-1" /> {jnImportSuccess}
              </div>
            )}

            {/* Results */}
            {jnInvoices.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 mb-2">{jnInvoices.length} invoice{jnInvoices.length !== 1 ? 's' : ''} found in JobNimbus</div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {jnInvoices.map(inv => (
                    <div key={inv.jnid} className="flex items-center justify-between p-3 bg-zinc-800 border border-zinc-700 rounded hover:border-purple-600 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{inv.invoiceNumber || inv.jnid}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            inv.status.toLowerCase() === 'paid' ? 'bg-emerald-900/40 text-emerald-400' :
                            inv.status.toLowerCase() === 'overdue' || inv.status.toLowerCase() === 'past due' ? 'bg-red-900/40 text-red-400' :
                            'bg-zinc-700 text-zinc-300'
                          }`}>{inv.status}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {inv.customerName} | Total: {fmt(inv.total)} | Paid: {fmt(inv.amountPaid)} | Balance: {fmt(inv.balance)}
                          {inv.dueDate && ` | Due: ${fmtDate(inv.dueDate)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {inv.pdfUrl && (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-zinc-500 hover:text-blue-400" title="View PDF">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleImportJNInvoice(inv)}
                          disabled={jnLoading}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-500 disabled:opacity-40 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Import
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!jnLoading && jnInvoices.length === 0 && !jnError && jnContactId && (
              <div className="text-center py-8 text-zinc-500 text-sm">
                Click &quot;Fetch Invoices&quot; to search JobNimbus for this contact&apos;s invoices.
              </div>
            )}
            {!jnContactId && !jnLoading && (
              <div className="text-center py-8 text-zinc-600 text-sm">
                Enter a JobNimbus Contact ID above to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {renderPreview()}
    </div>
  );
}
