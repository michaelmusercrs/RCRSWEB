// Reports Service for River City Roofing Portal
// Provides comprehensive reporting with filtering, date ranges, and export options

export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  status?: string | string[];
  ticketType?: 'delivery' | 'pickup' | 'return' | 'all';
  driverId?: string;
  projectManagerId?: string;
  jobId?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface DeliveryReport {
  totalDeliveries: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryTime: number; // in minutes
  totalMaterialValue: number;
  byDriver: Array<{
    driverId: string;
    driverName: string;
    deliveryCount: number;
    completedCount: number;
    averageTime: number;
    totalValue: number;
  }>;
  byDay: Array<{
    date: string;
    count: number;
    completed: number;
    value: number;
  }>;
  byStatus: Record<string, number>;
}

export interface BillingReport {
  totalInvoiced: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  invoiceCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  averageInvoiceAmount: number;
  averageDaysToPayment: number;
  byMonth: Array<{
    month: string;
    invoiced: number;
    paid: number;
    pending: number;
  }>;
  byCustomer: Array<{
    customerId: string;
    customerName: string;
    totalInvoiced: number;
    totalPaid: number;
    invoiceCount: number;
  }>;
}

export interface InventoryReport {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  restocksPending: number;
  turnoverRate: number;
  byCategory: Array<{
    category: string;
    productCount: number;
    totalQty: number;
    totalValue: number;
    lowStockCount: number;
  }>;
  topMoving: Array<{
    productId: string;
    productName: string;
    usedQty: number;
    timesOrdered: number;
    revenue: number;
  }>;
  slowMoving: Array<{
    productId: string;
    productName: string;
    currentQty: number;
    daysInStock: number;
  }>;
}

export interface TeamPerformanceReport {
  totalTeamMembers: number;
  activeMembers: number;
  byRole: Record<string, number>;
  drivers: Array<{
    id: string;
    name: string;
    totalDeliveries: number;
    completedOnTime: number;
    averageRating: number;
    totalMaterialValue: number;
    avgDeliveryTime: number;
  }>;
  projectManagers: Array<{
    id: string;
    name: string;
    totalOrders: number;
    totalValue: number;
    avgOrderSize: number;
    completionRate: number;
  }>;
}

export interface MaterialJobFlowReport {
  stages: Array<{
    stage: string;
    avgTimeInStage: number; // minutes
    ticketsInStage: number;
    bottleneck: boolean;
  }>;
  averageTotalTime: number;
  byTicketType: Record<string, {
    count: number;
    avgTime: number;
    completionRate: number;
  }>;
  alerts: Array<{
    type: 'delay' | 'stuck' | 'overdue';
    ticketId: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

class ReportsService {
  // Generate Delivery Report
  async generateDeliveryReport(filter: ReportFilter): Promise<DeliveryReport> {
    // In production, this would query the database
    // For now, return mock data structure

    return {
      totalDeliveries: 156,
      completedDeliveries: 142,
      pendingDeliveries: 12,
      cancelledDeliveries: 2,
      averageDeliveryTime: 45,
      totalMaterialValue: 287450.00,
      byDriver: [
        {
          driverId: 'rick',
          driverName: 'Rick',
          deliveryCount: 82,
          completedCount: 78,
          averageTime: 42,
          totalValue: 156000,
        },
        {
          driverId: 'tae',
          driverName: 'Tae',
          deliveryCount: 74,
          completedCount: 64,
          averageTime: 48,
          totalValue: 131450,
        },
      ],
      byDay: this.generateLast30Days(),
      byStatus: {
        'created': 3,
        'assigned': 2,
        'materials_pulled': 4,
        'load_verified': 2,
        'en_route': 1,
        'completed': 142,
        'cancelled': 2,
      },
    };
  }

  // Generate Billing Report
  async generateBillingReport(filter: ReportFilter): Promise<BillingReport> {
    return {
      totalInvoiced: 425680.00,
      totalPaid: 389450.00,
      totalPending: 28730.00,
      totalOverdue: 7500.00,
      invoiceCount: 156,
      paidCount: 142,
      pendingCount: 12,
      overdueCount: 2,
      averageInvoiceAmount: 2729.74,
      averageDaysToPayment: 14,
      byMonth: this.generateLast6Months(),
      byCustomer: [],
    };
  }

  // Generate Inventory Report
  async generateInventoryReport(filter: ReportFilter): Promise<InventoryReport> {
    return {
      totalProducts: 124,
      totalValue: 89450.00,
      lowStockCount: 8,
      outOfStockCount: 2,
      restocksPending: 5,
      turnoverRate: 4.2,
      byCategory: [
        { category: 'Shingles', productCount: 24, totalQty: 850, totalValue: 42500, lowStockCount: 2 },
        { category: 'Underlayment', productCount: 12, totalQty: 320, totalValue: 12800, lowStockCount: 1 },
        { category: 'Flashing', productCount: 18, totalQty: 450, totalValue: 9000, lowStockCount: 0 },
        { category: 'Fasteners', productCount: 28, totalQty: 2400, totalValue: 4800, lowStockCount: 3 },
        { category: 'Ventilation', productCount: 16, totalQty: 180, totalValue: 8100, lowStockCount: 1 },
        { category: 'Gutters', productCount: 14, totalQty: 280, totalValue: 8400, lowStockCount: 1 },
        { category: 'Accessories', productCount: 12, totalQty: 560, totalValue: 3850, lowStockCount: 0 },
      ],
      topMoving: [
        { productId: 'OC-DURATION-30', productName: 'OC Duration 30yr Shingles', usedQty: 245, timesOrdered: 68, revenue: 24500 },
        { productId: 'FELT-30', productName: '30lb Felt Paper', usedQty: 180, timesOrdered: 54, revenue: 5400 },
        { productId: 'ICE-WATER', productName: 'Ice & Water Shield', usedQty: 156, timesOrdered: 48, revenue: 6240 },
      ],
      slowMoving: [
        { productId: 'CEDAR-SHAKE', productName: 'Cedar Shake Shingles', currentQty: 45, daysInStock: 90 },
        { productId: 'COPPER-FLASH', productName: 'Copper Flashing', currentQty: 28, daysInStock: 75 },
      ],
    };
  }

  // Generate Team Performance Report
  async generateTeamPerformanceReport(filter: ReportFilter): Promise<TeamPerformanceReport> {
    return {
      totalTeamMembers: 9,
      activeMembers: 9,
      byRole: {
        'owner': 1,
        'admin': 1,
        'office': 2,
        'project_manager': 2,
        'driver': 2,
        'viewer': 1,
      },
      drivers: [
        {
          id: 'rick',
          name: 'Rick',
          totalDeliveries: 82,
          completedOnTime: 78,
          averageRating: 4.8,
          totalMaterialValue: 156000,
          avgDeliveryTime: 42,
        },
        {
          id: 'tae',
          name: 'Tae',
          totalDeliveries: 74,
          completedOnTime: 68,
          averageRating: 4.6,
          totalMaterialValue: 131450,
          avgDeliveryTime: 48,
        },
      ],
      projectManagers: [
        {
          id: 'john',
          name: 'John',
          totalOrders: 85,
          totalValue: 168500,
          avgOrderSize: 1982.35,
          completionRate: 94.1,
        },
        {
          id: 'bart',
          name: 'Bart',
          totalOrders: 71,
          totalValue: 118950,
          avgOrderSize: 1675.35,
          completionRate: 92.3,
        },
      ],
    };
  }

  // Generate Material Job Flow Report
  async generateJobFlowReport(filter: ReportFilter): Promise<MaterialJobFlowReport> {
    return {
      stages: [
        { stage: 'Order Created', avgTimeInStage: 5, ticketsInStage: 3, bottleneck: false },
        { stage: 'Driver Assigned', avgTimeInStage: 15, ticketsInStage: 2, bottleneck: false },
        { stage: 'Materials Pulled', avgTimeInStage: 45, ticketsInStage: 4, bottleneck: true },
        { stage: 'Load Verified', avgTimeInStage: 10, ticketsInStage: 2, bottleneck: false },
        { stage: 'En Route', avgTimeInStage: 35, ticketsInStage: 1, bottleneck: false },
        { stage: 'Delivered', avgTimeInStage: 20, ticketsInStage: 0, bottleneck: false },
        { stage: 'Proof Captured', avgTimeInStage: 5, ticketsInStage: 0, bottleneck: false },
        { stage: 'Billed', avgTimeInStage: 480, ticketsInStage: 8, bottleneck: true },
      ],
      averageTotalTime: 615,
      byTicketType: {
        'delivery': { count: 142, avgTime: 580, completionRate: 95.4 },
        'pickup': { count: 28, avgTime: 320, completionRate: 89.3 },
        'return': { count: 14, avgTime: 240, completionRate: 100 },
      },
      alerts: [
        { type: 'stuck', ticketId: 'TKT-2024-0156', message: 'Ticket stuck in materials_pulled for 2+ hours', severity: 'high' },
        { type: 'delay', ticketId: 'TKT-2024-0148', message: 'Billing pending for 3+ days', severity: 'medium' },
        { type: 'overdue', ticketId: 'TKT-2024-0142', message: 'Invoice overdue by 7 days', severity: 'high' },
      ],
    };
  }

  // Export report to CSV
  exportToCSV(data: any[], filename: string): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  // Helper: Generate last 30 days data
  private generateLast30Days(): Array<{ date: string; count: number; completed: number; value: number }> {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().slice(0, 10),
        count: Math.floor(Math.random() * 8) + 3,
        completed: Math.floor(Math.random() * 7) + 2,
        value: Math.floor(Math.random() * 15000) + 5000,
      });
    }
    return days;
  }

  // Helper: Generate last 6 months data
  private generateLast6Months(): Array<{ month: string; invoiced: number; paid: number; pending: number }> {
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        invoiced: Math.floor(Math.random() * 50000) + 30000,
        paid: Math.floor(Math.random() * 45000) + 25000,
        pending: Math.floor(Math.random() * 10000) + 2000,
      });
    }
    return months;
  }

  // Filter builder for UI
  getAvailableFilters(reportType: string): Array<{
    field: string;
    label: string;
    type: 'date' | 'select' | 'multiselect' | 'number' | 'text';
    options?: Array<{ value: string; label: string }>;
  }> {
    const commonFilters = [
      { field: 'dateFrom', label: 'Start Date', type: 'date' as const },
      { field: 'dateTo', label: 'End Date', type: 'date' as const },
    ];

    switch (reportType) {
      case 'delivery':
        return [
          ...commonFilters,
          {
            field: 'status',
            label: 'Status',
            type: 'multiselect' as const,
            options: [
              { value: 'created', label: 'Created' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'materials_pulled', label: 'Materials Pulled' },
              { value: 'load_verified', label: 'Load Verified' },
              { value: 'en_route', label: 'En Route' },
              { value: 'arrived', label: 'Arrived' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            field: 'ticketType',
            label: 'Ticket Type',
            type: 'select' as const,
            options: [
              { value: 'all', label: 'All Types' },
              { value: 'delivery', label: 'Delivery' },
              { value: 'pickup', label: 'Pickup' },
              { value: 'return', label: 'Return' },
            ],
          },
          {
            field: 'driverId',
            label: 'Driver',
            type: 'select' as const,
            options: [
              { value: '', label: 'All Drivers' },
              { value: 'rick', label: 'Rick' },
              { value: 'tae', label: 'Tae' },
            ],
          },
          {
            field: 'projectManagerId',
            label: 'Project Manager',
            type: 'select' as const,
            options: [
              { value: '', label: 'All PMs' },
              { value: 'john', label: 'John' },
              { value: 'bart', label: 'Bart' },
            ],
          },
        ];

      case 'billing':
        return [
          ...commonFilters,
          {
            field: 'status',
            label: 'Invoice Status',
            type: 'multiselect' as const,
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'sent', label: 'Sent' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          { field: 'minAmount', label: 'Min Amount', type: 'number' as const },
          { field: 'maxAmount', label: 'Max Amount', type: 'number' as const },
        ];

      case 'inventory':
        return [
          {
            field: 'category',
            label: 'Category',
            type: 'multiselect' as const,
            options: [
              { value: 'shingles', label: 'Shingles' },
              { value: 'underlayment', label: 'Underlayment' },
              { value: 'flashing', label: 'Flashing' },
              { value: 'fasteners', label: 'Fasteners' },
              { value: 'ventilation', label: 'Ventilation' },
              { value: 'gutters', label: 'Gutters' },
              { value: 'accessories', label: 'Accessories' },
            ],
          },
          {
            field: 'stockLevel',
            label: 'Stock Level',
            type: 'select' as const,
            options: [
              { value: '', label: 'All Levels' },
              { value: 'low', label: 'Low Stock' },
              { value: 'out', label: 'Out of Stock' },
              { value: 'normal', label: 'Normal' },
            ],
          },
        ];

      case 'team':
        return [
          ...commonFilters,
          {
            field: 'role',
            label: 'Role',
            type: 'multiselect' as const,
            options: [
              { value: 'owner', label: 'Owner' },
              { value: 'admin', label: 'Admin' },
              { value: 'office', label: 'Office' },
              { value: 'project_manager', label: 'Project Manager' },
              { value: 'driver', label: 'Driver' },
              { value: 'viewer', label: 'Viewer' },
            ],
          },
        ];

      case 'jobflow':
        return [
          ...commonFilters,
          {
            field: 'ticketType',
            label: 'Ticket Type',
            type: 'select' as const,
            options: [
              { value: 'all', label: 'All Types' },
              { value: 'delivery', label: 'Delivery' },
              { value: 'pickup', label: 'Pickup' },
              { value: 'return', label: 'Return' },
            ],
          },
          {
            field: 'showAlerts',
            label: 'Show Alerts Only',
            type: 'select' as const,
            options: [
              { value: 'false', label: 'All Items' },
              { value: 'true', label: 'Alerts Only' },
            ],
          },
        ];

      default:
        return commonFilters;
    }
  }
}

export const reportsService = new ReportsService();
