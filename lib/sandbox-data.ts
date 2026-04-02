/**
 * Sandbox Mock Data
 *
 * Fake data for testing all portal features without touching real spreadsheets.
 * Uses fictional names so there's zero confusion with real data.
 */

// ============================================================================
// FAKE TEAM MEMBERS FOR SANDBOX
// ============================================================================

export const SANDBOX_REPS = [
  'Testen McTester',
  'Sandy Boxworth',
  'Demo Johnson',
  'Preview Williams',
  'Tester Rodriguez',
  'Sammy Sandbox',
  'Quinn Testfield',
];

export const SANDBOX_OWNERS = ['Admin McAdmin', 'Boss Testington'];
export const SANDBOX_OFFICE = ['Sara Sandcastle'];
export const SANDBOX_PM = ['Pete Manager'];
export const SANDBOX_DRIVER = ['Danny Driver'];

// ============================================================================
// MEETING NUMBERS (fake weekly performance data)
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateWeeklyNumbers(repName: string, weekDate: string) {
  const inspected = randomInt(3, 15);
  const damage = randomInt(1, inspected);
  const signed = randomInt(0, damage);
  const revenue = signed * randomInt(8000, 18000);
  return {
    repName,
    weekDate,
    inspected,
    damage,
    signed,
    repair: randomInt(0, 3),
    gutter: randomInt(0, 2),
    revenue,
    approved: randomInt(0, signed),
    goal: 50000,
    referrals: randomInt(0, 3),
    agents: randomInt(0, 2),
    present: true,
    homeShow: randomInt(0, 1),
  };
}

export function getSandboxMeetingNumbers() {
  const weeks = [
    'M.01.06.2026', 'M.01.13.2026', 'M.01.20.2026', 'M.01.27.2026',
    'M.02.03.2026', 'M.02.10.2026', 'M.02.17.2026', 'M.02.24.2026',
    'M.03.02.2026', 'M.03.09.2026', 'M.03.16.2026', 'M.03.23.2026',
    'M.03.30.2026',
  ];
  const records: ReturnType<typeof generateWeeklyNumbers>[] = [];
  for (const week of weeks) {
    for (const rep of SANDBOX_REPS) {
      records.push(generateWeeklyNumbers(rep.split(' ')[0], week));
    }
  }
  return records;
}

// ============================================================================
// COMMISSIONS (fake 1099 data)
// ============================================================================

export function getSandboxCommissions() {
  return SANDBOX_REPS.map((rep, i) => ({
    id: `COMM-${1000 + i}`,
    repName: rep,
    entityName: `${rep.split(' ')[0]}'s Roofing LLC`,
    amount: randomInt(5000, 45000),
    period: 'March 2026',
    paidDate: '2026-03-15',
    type: '1099',
    status: 'paid',
  }));
}

// ============================================================================
// INVENTORY (fake materials)
// ============================================================================

export function getSandboxInventory() {
  return [
    { sku: 'IKO-DYN-DRIFT', name: 'IKO Dynasty - Driftwood', category: 'Shingles', quantity: 45, unit: 'bundle', minStock: 20, location: 'Warehouse A', lastUpdated: '2026-03-28' },
    { sku: 'IKO-DYN-GLAC', name: 'IKO Dynasty - Glacier', category: 'Shingles', quantity: 32, unit: 'bundle', minStock: 15, location: 'Warehouse A', lastUpdated: '2026-03-29' },
    { sku: 'IKO-CAM-CHAR', name: 'IKO Cambridge - Charcoal', category: 'Shingles', quantity: 8, unit: 'bundle', minStock: 20, location: 'Warehouse B', lastUpdated: '2026-03-25' },
    { sku: 'GAF-HDZ-WW', name: 'GAF Timberline HDZ - Weathered Wood', category: 'Shingles', quantity: 28, unit: 'bundle', minStock: 10, location: 'Warehouse A', lastUpdated: '2026-03-30' },
    { sku: 'UNDER-SYNTH', name: 'Synthetic Underlayment', category: 'Underlayment', quantity: 15, unit: 'roll', minStock: 10, location: 'Warehouse A', lastUpdated: '2026-03-28' },
    { sku: 'DRIP-ALU-10', name: 'Aluminum Drip Edge 10ft', category: 'Flashing', quantity: 120, unit: 'piece', minStock: 50, location: 'Warehouse B', lastUpdated: '2026-03-27' },
    { sku: 'RIDGE-IKO', name: 'IKO Hip & Ridge', category: 'Accessories', quantity: 22, unit: 'bundle', minStock: 10, location: 'Warehouse A', lastUpdated: '2026-03-30' },
    { sku: 'NAIL-COIL', name: 'Coil Roofing Nails 1.25"', category: 'Fasteners', quantity: 50, unit: 'box', minStock: 20, location: 'Warehouse B', lastUpdated: '2026-03-29' },
    { sku: 'VENT-RIDGE', name: 'Continuous Ridge Vent 4ft', category: 'Ventilation', quantity: 35, unit: 'piece', minStock: 15, location: 'Warehouse A', lastUpdated: '2026-03-28' },
    { sku: 'LEAFX-STD', name: 'LeafX Gutter Guard Standard', category: 'Gutters', quantity: 60, unit: 'section', minStock: 25, location: 'Warehouse B', lastUpdated: '2026-03-26' },
    { sku: 'PIPE-BOOT-3', name: 'Pipe Boot 3" - Black', category: 'Flashing', quantity: 18, unit: 'piece', minStock: 10, location: 'Warehouse A', lastUpdated: '2026-03-30' },
    { sku: 'ICE-WATER', name: 'Ice & Water Shield 36" x 75ft', category: 'Underlayment', quantity: 6, unit: 'roll', minStock: 5, location: 'Warehouse A', lastUpdated: '2026-03-25' },
  ];
}

// ============================================================================
// CUSTOMERS (fake)
// ============================================================================

export function getSandboxCustomers() {
  return [
    { customerId: 'CUST-001', name: 'Robert Placeholder', email: 'robert@example.com', phone: '256-555-0101', address: '123 Test Street, Decatur, AL 35601', status: 'active', jobType: 'Roof Replacement', assignedRep: 'Testen McTester', createdAt: '2026-02-15' },
    { customerId: 'CUST-002', name: 'Jennifer Fakename', email: 'jennifer@example.com', phone: '256-555-0102', address: '456 Demo Ave, Huntsville, AL 35801', status: 'inspection_scheduled', jobType: 'Storm Damage', assignedRep: 'Sandy Boxworth', createdAt: '2026-03-01' },
    { customerId: 'CUST-003', name: 'Michael Testworth', email: 'mtest@example.com', phone: '256-555-0103', address: '789 Sample Blvd, Madison, AL 35758', status: 'estimate_sent', jobType: 'Roof Replacement', assignedRep: 'Demo Johnson', createdAt: '2026-03-10' },
    { customerId: 'CUST-004', name: 'Sarah Mockdata', email: 'sarah@example.com', phone: '256-555-0104', address: '321 Preview Ln, Athens, AL 35611', status: 'approved', jobType: 'Gutter Installation', assignedRep: 'Preview Williams', createdAt: '2026-03-15' },
    { customerId: 'CUST-005', name: 'David Exampleson', email: 'david@example.com', phone: '256-555-0105', address: '654 Sandbox Dr, Hartselle, AL 35640', status: 'in_progress', jobType: 'Roof Replacement', assignedRep: 'Tester Rodriguez', createdAt: '2026-03-20' },
    { customerId: 'CUST-006', name: 'Lisa Demotest', email: 'lisa@example.com', phone: '256-555-0106', address: '987 Testville Rd, Cullman, AL 35055', status: 'completed', jobType: 'Storm Damage', assignedRep: 'Sammy Sandbox', createdAt: '2026-01-20' },
  ];
}

// ============================================================================
// ORDERS / DELIVERIES (fake)
// ============================================================================

export function getSandboxOrders() {
  return [
    { orderId: 'ORD-001', customerId: 'CUST-005', items: 'IKO Dynasty Driftwood x30, Underlayment x4, Drip Edge x20', status: 'delivered', orderDate: '2026-03-22', deliveryDate: '2026-03-25', assignedDriver: 'Danny Driver' },
    { orderId: 'ORD-002', customerId: 'CUST-004', items: 'LeafX Gutter Guard x40, Aluminum Gutters x12', status: 'in_transit', orderDate: '2026-03-28', deliveryDate: '2026-03-30', assignedDriver: 'Danny Driver' },
    { orderId: 'ORD-003', customerId: 'CUST-003', items: 'GAF HDZ Weathered Wood x35, Ice & Water x3, Ridge Vent x10', status: 'pending', orderDate: '2026-03-30', deliveryDate: null, assignedDriver: null },
  ];
}

// ============================================================================
// REVIEWS (fake Google reviews)
// ============================================================================

export function getSandboxReviews() {
  return [
    { name: 'Robert Placeholder', rating: 5, date: '2026-03-20', text: 'Fantastic work on our roof replacement! The crew was professional and finished in just two days. Highly recommend Testen and the whole team.' },
    { name: 'Jennifer Fakename', rating: 5, date: '2026-03-15', text: 'They handled our entire insurance claim after the hail storm. Sandy was incredibly helpful and we paid almost nothing out of pocket.' },
    { name: 'Michael Testworth', rating: 5, date: '2026-03-10', text: 'Best roofing company in North Alabama. Demo came out same day for the estimate and explained everything clearly.' },
    { name: 'Sarah Mockdata', rating: 5, date: '2026-02-28', text: 'Our new LeafX gutters are amazing. No more climbing ladders to clean leaves every fall. Great installation job.' },
    { name: 'Lisa Demotest', rating: 5, date: '2026-02-15', text: 'Quick response after the storm, had a tarp up within hours. Full replacement was done perfectly. Five stars all the way.' },
    { name: 'Tom Samplefield', rating: 5, date: '2026-01-30', text: 'Very impressed with the quality of work and the professionalism. They cleaned up everything when they were done.' },
  ];
}

// ============================================================================
// AUDIT LOG (fake)
// ============================================================================

const sandboxAuditLog: Array<Record<string, string>> = [];

export function getSandboxAuditLog() {
  return sandboxAuditLog;
}

export function addSandboxAuditEntry(entry: Record<string, string>) {
  sandboxAuditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

// ============================================================================
// WEEKLY NUMBERS (fake RepWeeklyNumbers entries)
// ============================================================================

export function getSandboxWeeklyNumbers() {
  return SANDBOX_REPS.map((rep, i) => ({
    id: `WN-${100 + i}`,
    repName: rep.split(' ')[0],
    weekStarting: '2026-03-30',
    doorsKnocked: randomInt(20, 80),
    appointmentsSet: randomInt(3, 15),
    inspectionsRun: randomInt(2, 10),
    contractsSigned: randomInt(0, 5),
    referralsGiven: randomInt(0, 3),
    submittedAt: '2026-04-01T14:30:00Z',
  }));
}

// ============================================================================
// JOBNIMBUS MOCK DATA
// ============================================================================

export function getSandboxJNContacts() {
  return getSandboxCustomers().map((c, i) => ({
    jnid: `jn-test-${1000 + i}`,
    first_name: c.name.split(' ')[0],
    last_name: c.name.split(' ')[1],
    display_name: c.name,
    email: c.email,
    home_phone: c.phone,
    address_line1: c.address.split(',')[0],
    city: c.address.split(',')[1]?.trim(),
    state_text: 'AL',
    zip: '35601',
    status_name: c.status,
    tags: [c.jobType],
    created_date: Math.floor(new Date(c.createdAt).getTime() / 1000),
    date_updated: Math.floor(Date.now() / 1000),
    sales_rep_name: c.assignedRep,
  }));
}

export function getSandboxJNJobs() {
  return [
    { jnid: 'jn-job-001', number: 'JOB-2026-001', name: 'Placeholder Roof Replacement', status_name: 'In Progress', primary: { jnid: 'jn-test-1004' }, amount: 14500, description: 'Full roof replacement - IKO Dynasty Driftwood', created_date: Math.floor(Date.now() / 1000) - 86400 * 10 },
    { jnid: 'jn-job-002', number: 'JOB-2026-002', name: 'Fakename Storm Damage', status_name: 'Estimate Sent', primary: { jnid: 'jn-test-1001' }, amount: 12800, description: 'Storm damage insurance claim - full replacement', created_date: Math.floor(Date.now() / 1000) - 86400 * 5 },
    { jnid: 'jn-job-003', number: 'JOB-2026-003', name: 'Mockdata Gutter Install', status_name: 'Approved', primary: { jnid: 'jn-test-1003' }, amount: 4200, description: 'LeafX gutter protection system', created_date: Math.floor(Date.now() / 1000) - 86400 * 3 },
  ];
}

// ============================================================================
// MEETING PREP (fake Monday meeting data)
// ============================================================================

export function getSandboxMeetingPrep() {
  return {
    date: '2026-04-06',
    verse: '"For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future." - Jeremiah 29:11',
    prayer: 'Lord, bless our team this week as we serve our community...',
    weather: { temp: 72, condition: 'Partly Cloudy', high: 78, low: 55, rainChance: 20 },
    announcements: [
      { from: 'Sara Sandcastle', department: 'Office', text: 'New inventory system training Wednesday at 2pm', priority: 'normal' },
      { from: 'Pete Manager', department: 'Operations', text: '3 jobs scheduled this week - Decatur, Huntsville, Athens', priority: 'normal' },
    ],
    outstandingPerformers: [
      { name: 'Testen McTester', metric: 'Most Inspections', value: 15, period: 'Last Week' },
      { name: 'Sandy Boxworth', metric: 'Highest Revenue', value: 87000, period: 'Last Week' },
      { name: 'Demo Johnson', metric: 'Most Contracts Signed', value: 5, period: 'Last Week' },
    ],
    teamTotals: {
      inspected: 52, damage: 31, signed: 18, repair: 5, gutter: 7,
      revenue: 285000, approved: 12, referrals: 8, agents: 4, homeShow: 2,
    },
  };
}

// ============================================================================
// TRAINING PROGRESS (fake)
// ============================================================================

export function getSandboxTrainingProgress() {
  return SANDBOX_REPS.map((rep) => ({
    repName: rep,
    modulesCompleted: randomInt(3, 12),
    totalModules: 15,
    lastActivity: '2026-03-28',
    certifications: randomInt(0, 3),
  }));
}
