// Material Job Flow - Detailed workflow management for material orders
// This defines the complete lifecycle of a material order from creation to billing

export type JobFlowStage =
  | 'order_created'
  | 'order_reviewed'
  | 'driver_assigned'
  | 'warehouse_notified'
  | 'materials_pulled'
  | 'load_verified'
  | 'departure_confirmed'
  | 'en_route'
  | 'arrived_at_site'
  | 'unloading'
  | 'delivery_confirmed'
  | 'signature_captured'
  | 'qc_photos'
  | 'office_notified'
  | 'billing_created'
  | 'invoice_sent'
  | 'payment_received'
  | 'job_closed';

export interface JobFlowStep {
  stage: JobFlowStage;
  label: string;
  description: string;
  assignedTo: 'pm' | 'office' | 'warehouse' | 'driver' | 'billing' | 'system';
  requiredActions: string[];
  optionalActions: string[];
  nextStage: JobFlowStage | null;
  previousStage: JobFlowStage | null;
  estimatedDuration: number; // minutes
  maxDuration: number; // minutes before alert
  requiresPhoto: boolean;
  requiresGPS: boolean;
  requiresSignature: boolean;
  notifyRoles: string[];
  automatedChecks: string[];
}

export interface JobFlowTransition {
  fromStage: JobFlowStage;
  toStage: JobFlowStage;
  triggeredBy: string;
  timestamp: string;
  userId: string;
  userName: string;
  gpsLocation?: string;
  notes?: string;
  photoIds?: string[];
}

export interface MaterialOrderWorkflow {
  orderId: string;
  ticketId: string;
  jobId: string;
  jobName: string;
  currentStage: JobFlowStage;
  history: JobFlowTransition[];
  materials: Array<{
    productId: string;
    productName: string;
    orderedQty: number;
    pulledQty?: number;
    deliveredQty?: number;
    verifiedQty?: number;
  }>;
  timeline: {
    stageEntered: string;
    expectedDuration: number;
    maxDuration: number;
    isOverdue: boolean;
  };
  flags: {
    urgent: boolean;
    rush: boolean;
    hasIssues: boolean;
    requiresApproval: boolean;
  };
  createdAt: string;
  completedAt?: string;
}

// Define the complete job flow stages
export const JOB_FLOW_STAGES: JobFlowStep[] = [
  {
    stage: 'order_created',
    label: 'Order Created',
    description: 'PM creates material order with job details and material list',
    assignedTo: 'pm',
    requiredActions: ['Enter job details', 'Select materials', 'Set delivery date'],
    optionalActions: ['Add special instructions', 'Set priority'],
    nextStage: 'order_reviewed',
    previousStage: null,
    estimatedDuration: 5,
    maxDuration: 60,
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['office'],
    automatedChecks: ['Check inventory availability'],
  },
  {
    stage: 'order_reviewed',
    label: 'Order Reviewed',
    description: 'Office reviews order for completeness and pricing',
    assignedTo: 'office',
    requiredActions: ['Verify pricing', 'Check customer info', 'Confirm availability'],
    optionalActions: ['Adjust pricing', 'Add notes'],
    nextStage: 'driver_assigned',
    previousStage: 'order_created',
    estimatedDuration: 15,
    maxDuration: 120,
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['pm'],
    automatedChecks: ['Validate pricing rules', 'Check credit limit'],
  },
  {
    stage: 'driver_assigned',
    label: 'Driver Assigned',
    description: 'Office assigns driver and schedules delivery time',
    assignedTo: 'office',
    requiredActions: ['Select driver', 'Set delivery time'],
    optionalActions: ['Set route order', 'Add driver notes'],
    nextStage: 'warehouse_notified',
    previousStage: 'order_reviewed',
    estimatedDuration: 10,
    maxDuration: 60,
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['driver'],
    automatedChecks: ['Check driver availability', 'Optimize route'],
  },
  {
    stage: 'warehouse_notified',
    label: 'Warehouse Notified',
    description: 'System sends notification to warehouse for material preparation',
    assignedTo: 'system',
    requiredActions: ['Send notification', 'Generate pull sheet'],
    optionalActions: [],
    nextStage: 'materials_pulled',
    previousStage: 'driver_assigned',
    estimatedDuration: 2,
    maxDuration: 5,
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['warehouse'],
    automatedChecks: ['Print pull sheet', 'Update inventory hold'],
  },
  {
    stage: 'materials_pulled',
    label: 'Materials Pulled',
    description: 'Warehouse pulls materials and stages for loading',
    assignedTo: 'warehouse',
    requiredActions: ['Pull all materials', 'Stage at loading dock', 'Mark complete'],
    optionalActions: ['Note any substitutions', 'Report shortages'],
    nextStage: 'load_verified',
    previousStage: 'warehouse_notified',
    estimatedDuration: 30,
    maxDuration: 120,
    requiresPhoto: true,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['driver', 'office'],
    automatedChecks: ['Update inventory', 'Flag discrepancies'],
  },
  {
    stage: 'load_verified',
    label: 'Load Verified',
    description: 'Driver verifies all materials are loaded correctly',
    assignedTo: 'driver',
    requiredActions: ['Count all items', 'Check against manifest', 'Confirm load'],
    optionalActions: ['Take load photo', 'Note issues'],
    nextStage: 'departure_confirmed',
    previousStage: 'materials_pulled',
    estimatedDuration: 15,
    maxDuration: 45,
    requiresPhoto: true,
    requiresGPS: true,
    requiresSignature: false,
    notifyRoles: ['office'],
    automatedChecks: ['Validate quantities', 'Check weight limits'],
  },
  {
    stage: 'departure_confirmed',
    label: 'Departure Confirmed',
    description: 'Driver confirms departure from warehouse',
    assignedTo: 'driver',
    requiredActions: ['Confirm departure'],
    optionalActions: ['Set ETA'],
    nextStage: 'en_route',
    previousStage: 'load_verified',
    estimatedDuration: 2,
    maxDuration: 10,
    requiresPhoto: false,
    requiresGPS: true,
    requiresSignature: false,
    notifyRoles: ['pm', 'office'],
    automatedChecks: ['Log departure time', 'Start tracking'],
  },
  {
    stage: 'en_route',
    label: 'En Route',
    description: 'Driver is traveling to job site',
    assignedTo: 'driver',
    requiredActions: ['Navigate to site'],
    optionalActions: ['Update ETA', 'Report delays'],
    nextStage: 'arrived_at_site',
    previousStage: 'departure_confirmed',
    estimatedDuration: 45,
    maxDuration: 180,
    requiresPhoto: false,
    requiresGPS: true,
    requiresSignature: false,
    notifyRoles: [],
    automatedChecks: ['Track location', 'Monitor for delays'],
  },
  {
    stage: 'arrived_at_site',
    label: 'Arrived at Site',
    description: 'Driver arrives at job site',
    assignedTo: 'driver',
    requiredActions: ['Confirm arrival'],
    optionalActions: ['Note site conditions', 'Contact customer'],
    nextStage: 'unloading',
    previousStage: 'en_route',
    estimatedDuration: 2,
    maxDuration: 10,
    requiresPhoto: true,
    requiresGPS: true,
    requiresSignature: false,
    notifyRoles: ['pm'],
    automatedChecks: ['Verify location matches job address'],
  },
  {
    stage: 'unloading',
    label: 'Unloading',
    description: 'Driver unloads materials at job site',
    assignedTo: 'driver',
    requiredActions: ['Unload all materials', 'Place as instructed'],
    optionalActions: ['Take placement photos'],
    nextStage: 'delivery_confirmed',
    previousStage: 'arrived_at_site',
    estimatedDuration: 20,
    maxDuration: 60,
    requiresPhoto: true,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: [],
    automatedChecks: [],
  },
  {
    stage: 'delivery_confirmed',
    label: 'Delivery Confirmed',
    description: 'All materials delivered and counted',
    assignedTo: 'driver',
    requiredActions: ['Confirm all items delivered', 'Note any issues'],
    optionalActions: ['Add delivery notes'],
    nextStage: 'signature_captured',
    previousStage: 'unloading',
    estimatedDuration: 5,
    maxDuration: 15,
    requiresPhoto: true,
    requiresGPS: true,
    requiresSignature: false,
    notifyRoles: ['pm', 'office'],
    automatedChecks: ['Update delivered quantities'],
  },
  {
    stage: 'signature_captured',
    label: 'Signature Captured',
    description: 'Customer or site representative signs for delivery',
    assignedTo: 'driver',
    requiredActions: ['Get signature', 'Enter signer name'],
    optionalActions: ['Take photo with signer'],
    nextStage: 'qc_photos',
    previousStage: 'delivery_confirmed',
    estimatedDuration: 5,
    maxDuration: 15,
    requiresPhoto: false,
    requiresGPS: true,
    requiresSignature: true,
    notifyRoles: ['office'],
    automatedChecks: ['Validate signature data'],
  },
  {
    stage: 'qc_photos',
    label: 'QC Photos',
    description: 'Driver takes quality control photos of delivered materials',
    assignedTo: 'driver',
    requiredActions: ['Take photos of materials', 'Take site overview photo'],
    optionalActions: ['Take before/after photos'],
    nextStage: 'office_notified',
    previousStage: 'signature_captured',
    estimatedDuration: 5,
    maxDuration: 20,
    requiresPhoto: true,
    requiresGPS: true,
    requiresSignature: false,
    notifyRoles: ['office'],
    automatedChecks: ['Verify photos uploaded', 'Tag with GPS'],
  },
  {
    stage: 'office_notified',
    label: 'Office Notified',
    description: 'System notifies office of completed delivery',
    assignedTo: 'system',
    requiredActions: ['Send notification', 'Update job status'],
    optionalActions: [],
    nextStage: 'billing_created',
    previousStage: 'qc_photos',
    estimatedDuration: 1,
    maxDuration: 5,
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['office', 'billing'],
    automatedChecks: ['Compile delivery report', 'Queue for billing'],
  },
  {
    stage: 'billing_created',
    label: 'Billing Created',
    description: 'Office creates billing record for materials',
    assignedTo: 'billing',
    requiredActions: ['Review delivered materials', 'Create billing record', 'Apply pricing'],
    optionalActions: ['Adjust quantities', 'Add fees'],
    nextStage: 'invoice_sent',
    previousStage: 'office_notified',
    estimatedDuration: 15,
    maxDuration: 4320, // 3 days
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['admin'],
    automatedChecks: ['Validate pricing', 'Check for duplicates', 'Flag high values'],
  },
  {
    stage: 'invoice_sent',
    label: 'Invoice Sent',
    description: 'Invoice generated and sent to customer',
    assignedTo: 'billing',
    requiredActions: ['Generate invoice', 'Send to customer'],
    optionalActions: ['Email PDF', 'Add to job folder'],
    nextStage: 'payment_received',
    previousStage: 'billing_created',
    estimatedDuration: 5,
    maxDuration: 60,
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['pm'],
    automatedChecks: ['Generate PDF', 'Log in JobNimbus'],
  },
  {
    stage: 'payment_received',
    label: 'Payment Received',
    description: 'Payment received and recorded',
    assignedTo: 'billing',
    requiredActions: ['Record payment', 'Update status'],
    optionalActions: ['Send receipt'],
    nextStage: 'job_closed',
    previousStage: 'invoice_sent',
    estimatedDuration: 0, // Variable
    maxDuration: 43200, // 30 days
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['admin'],
    automatedChecks: ['Update financials', 'Send to accounting'],
  },
  {
    stage: 'job_closed',
    label: 'Job Closed',
    description: 'Material order fully completed and closed',
    assignedTo: 'system',
    requiredActions: ['Close job'],
    optionalActions: ['Generate final report'],
    nextStage: null,
    previousStage: 'payment_received',
    estimatedDuration: 1,
    maxDuration: 5,
    requiresPhoto: false,
    requiresGPS: false,
    requiresSignature: false,
    notifyRoles: ['pm', 'office'],
    automatedChecks: ['Archive documents', 'Update metrics'],
  },
];

// Get stage details
export function getStageDetails(stage: JobFlowStage): JobFlowStep | undefined {
  return JOB_FLOW_STAGES.find(s => s.stage === stage);
}

// Get next stage
export function getNextStage(currentStage: JobFlowStage): JobFlowStage | null {
  const current = getStageDetails(currentStage);
  return current?.nextStage || null;
}

// Check if transition is valid
export function isValidTransition(fromStage: JobFlowStage, toStage: JobFlowStage): boolean {
  const from = getStageDetails(fromStage);
  return from?.nextStage === toStage || from?.previousStage === toStage;
}

// Get stages by assigned role
export function getStagesByRole(role: string): JobFlowStep[] {
  return JOB_FLOW_STAGES.filter(s => s.assignedTo === role);
}

// Calculate total estimated time for remaining stages
export function getEstimatedTimeToComplete(currentStage: JobFlowStage): number {
  let totalTime = 0;
  let foundCurrent = false;

  for (const stage of JOB_FLOW_STAGES) {
    if (stage.stage === currentStage) {
      foundCurrent = true;
    }
    if (foundCurrent) {
      totalTime += stage.estimatedDuration;
    }
  }

  return totalTime;
}

// Get workflow health metrics
export function getWorkflowHealth(workflow: MaterialOrderWorkflow): {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  const currentStage = getStageDetails(workflow.currentStage);
  if (!currentStage) {
    return { status: 'critical', score: 0, issues: ['Invalid workflow stage'] };
  }

  // Check if overdue
  if (workflow.timeline.isOverdue) {
    score -= 30;
    issues.push(`Stage "${currentStage.label}" is overdue`);
  }

  // Check for issues
  if (workflow.flags.hasIssues) {
    score -= 20;
    issues.push('Workflow has reported issues');
  }

  // Check material discrepancies
  const hasDiscrepancies = workflow.materials.some(m =>
    m.pulledQty !== undefined && m.pulledQty !== m.orderedQty
  );
  if (hasDiscrepancies) {
    score -= 15;
    issues.push('Material quantities have discrepancies');
  }

  // Determine status
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (score < 50) status = 'critical';
  else if (score < 80) status = 'warning';

  return { status, score, issues };
}

// Job Flow Visualization data
export function getJobFlowVisualization(): {
  stages: Array<{
    id: JobFlowStage;
    label: string;
    category: 'creation' | 'preparation' | 'transit' | 'delivery' | 'completion';
    x: number;
    y: number;
  }>;
  connections: Array<{ from: JobFlowStage; to: JobFlowStage }>;
} {
  return {
    stages: [
      // Creation phase
      { id: 'order_created', label: 'Order Created', category: 'creation', x: 0, y: 0 },
      { id: 'order_reviewed', label: 'Order Reviewed', category: 'creation', x: 1, y: 0 },

      // Preparation phase
      { id: 'driver_assigned', label: 'Driver Assigned', category: 'preparation', x: 2, y: 0 },
      { id: 'warehouse_notified', label: 'Warehouse Notified', category: 'preparation', x: 3, y: 0 },
      { id: 'materials_pulled', label: 'Materials Pulled', category: 'preparation', x: 4, y: 0 },
      { id: 'load_verified', label: 'Load Verified', category: 'preparation', x: 5, y: 0 },

      // Transit phase
      { id: 'departure_confirmed', label: 'Departed', category: 'transit', x: 6, y: 0 },
      { id: 'en_route', label: 'En Route', category: 'transit', x: 7, y: 0 },
      { id: 'arrived_at_site', label: 'Arrived', category: 'transit', x: 8, y: 0 },

      // Delivery phase
      { id: 'unloading', label: 'Unloading', category: 'delivery', x: 9, y: 0 },
      { id: 'delivery_confirmed', label: 'Delivered', category: 'delivery', x: 10, y: 0 },
      { id: 'signature_captured', label: 'Signed', category: 'delivery', x: 11, y: 0 },
      { id: 'qc_photos', label: 'QC Photos', category: 'delivery', x: 12, y: 0 },

      // Completion phase
      { id: 'office_notified', label: 'Office Notified', category: 'completion', x: 13, y: 0 },
      { id: 'billing_created', label: 'Billing Created', category: 'completion', x: 14, y: 0 },
      { id: 'invoice_sent', label: 'Invoice Sent', category: 'completion', x: 15, y: 0 },
      { id: 'payment_received', label: 'Payment Received', category: 'completion', x: 16, y: 0 },
      { id: 'job_closed', label: 'Closed', category: 'completion', x: 17, y: 0 },
    ],
    connections: JOB_FLOW_STAGES
      .filter(s => s.nextStage)
      .map(s => ({ from: s.stage, to: s.nextStage! })),
  };
}
