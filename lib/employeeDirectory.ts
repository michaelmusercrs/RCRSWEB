// Employee Directory - Real Data from Items.xlsx
// Total: 28 entries
// Data imported: 2025-12-04 22:43:17

export type EmployeeRole =
  | 'Owner'
  | 'Admin'
  | 'Production'
  | 'Sales Inspector'
  | 'Contractor'
  | 'Vendor';

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  phone: string;
  email: string;
  imageUrl: string;
  department?: string;
  hireDate?: string;
  active: boolean;
  notes?: string;
}

// 28 Employees from Excel
export const employeeDirectory: Employee[] = [
  {
    id: 'EMP-001',
    name: 'Chris Muse',
    role: 'Owner',
    phone: '256-648-1224',
    email: 'chrismuse@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/1-acX70RTyQzxpbV21L-RrDgRGoYwRI-r/view?usp=drive_link',
    department: 'Leadership',
    active: true
  },
  {
    id: 'EMP-002',
    name: 'Michael Muse',
    role: 'Owner',
    phone: '256-221-4290',
    email: 'michaelmuse@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/1-dKMcMxL8ECk0bmqQZNXJ4MJxZQLmjz5/view?usp=drive_link',
    department: 'Leadership',
    active: true
  },
  {
    id: 'EMP-003',
    name: 'Sara',
    role: 'Admin',
    phone: '256-810-3594',
    email: 'sara@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/112O-dHhhhWzSFXI4sFKVA8UxRWwlAnle/view?usp=drive_link',
    department: 'Office',
    active: true
  },
  {
    id: 'EMP-004',
    name: 'Destin',
    role: 'Admin',
    phone: '256-905-7738',
    email: 'destin@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/10bsLKG_Y277IJwFdPWdrovUE053v78cD/view?usp=drive_link',
    department: 'Office',
    active: true
  },
  {
    id: 'EMP-005',
    name: 'Tia',
    role: 'Admin',
    phone: '256-394-8396',
    email: 'tia@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/106gnoEXJl7ijl1XtHRzwK0UFW99QJZ2d/view?usp=drive_link',
    department: 'Office',
    active: true
  },
  {
    id: 'EMP-006',
    name: 'John',
    role: 'Production',
    phone: '256-654-0875',
    email: 'john@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/10oaNuJyucRObuF6dwiswwg6TSqc7l-u5/view?usp=drive_link',
    department: 'Production',
    active: true
  },
  {
    id: 'EMP-007',
    name: 'Bart',
    role: 'Production',
    phone: '256-654-0747',
    email: 'bart@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/115l-wgSHiYJ46rXzat5dE9dln7U6pGyG/view?usp=drive_link',
    department: 'Production',
    active: true
  },
  {
    id: 'EMP-008',
    name: 'Tae',
    role: 'Production',
    phone: '256-200-3467',
    email: 'tae@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/103Db4B-rJz2GBqO1wazWdFKAqON1ZM4g/view?usp=drive_link',
    department: 'Production',
    active: true
  },
  {
    id: 'EMP-009',
    name: 'Hunter',
    role: 'Sales Inspector',
    phone: '256-221-0548',
    email: 'hunter@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/106wFzq0Iz4zZqhGN41vmCrgRbqMpnOTl/view?usp=drive_link',
    department: 'Sales',
    active: true
  },
  {
    id: 'EMP-010',
    name: 'Rick',
    role: 'Sales Inspector',
    phone: '256-701-7376',
    email: 'rick@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/1-KZ8OQaK5QbuK_VZDNejQJG8QIu8Ffaz/view?usp=drive_link',
    department: 'Sales',
    active: true, notes: "Driver / Warehouse Manager"
  },
  {
    id: 'EMP-011',
    name: 'Rudy',
    role: 'Sales Inspector',
    phone: '256-654-3631',
    email: 'rudy@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/1-_bIdSogWNRuH8j0t-O1CISkAubPQAz5/view?usp=drive_link',
    department: 'Sales',
    active: true
  },
  {
    id: 'EMP-012',
    name: 'Aaron',
    role: 'Sales Inspector',
    phone: '256-656-7856',
    email: 'aaron@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/10OXZl45v7aq6JRTD8J5zFHyybkuYXyYl/view?usp=drive_link',
    department: 'Sales',
    active: true
  },
  {
    id: 'EMP-013',
    name: 'Brendon',
    role: 'Sales Inspector',
    phone: '256-616-6174',
    email: 'brendon@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/10OQePaPsPYkj1jer8KQzdYe1ytn_wVBa/view?usp=drive_link',
    department: 'Sales',
    active: true
  },
  {
    id: 'EMP-014',
    name: 'Greg',
    role: 'Sales Inspector',
    phone: '256-221-1809',
    email: 'greg@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/100Y60GaATbhZkK80ffL3x1pnmg3n1NOC/view?usp=drive_link',
    department: 'Sales',
    active: true
  },
  {
    id: 'EMP-015',
    name: 'Buck',
    role: 'Sales Inspector',
    phone: '256-606-5024',
    email: 'buck@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/1-VQ1Lhm9mYzhX2tUeBYaRbZ-8WiL3F2m/view?usp=drive_link',
    department: 'Sales',
    active: true
  },
  {
    id: 'EMP-016',
    name: 'Ethan',
    role: 'Sales Inspector',
    phone: '256-255-6773',
    email: 'ethan@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/10EJ-wX6IAo3HeCbHkpYvLWwJN6cbRwLO/view?usp=drive_link',
    department: 'Sales',
    active: true
  },
  {
    id: 'EMP-017',
    name: 'Danny',
    role: 'Sales Inspector',
    phone: '256-994-7623',
    email: 'danny@RiverCityRoofingSolutions.com',
    imageUrl: 'https://drive.google.com/file/d/118mMMLX5JozBN9kshpHemBgUBikq2jhZ/view?usp=drive_link',
    department: 'Sales',
    active: true
  },
  {
    id: 'EMP-018',
    name: 'Martin',
    role: 'Contractor',
    phone: '256-479-4149',
    email: '',
    imageUrl: '/uploads/martin.png',
    department: 'Roofing Crew',
    active: true, notes: "Roofing Contractor"
  },
  {
    id: 'EMP-019',
    name: 'Roger',
    role: 'Contractor',
    phone: '256-318-2815',
    email: '',
    imageUrl: '/uploads/roger.png',
    department: 'Roofing Crew',
    active: true, notes: "Roofing Contractor"
  },
  {
    id: 'EMP-020',
    name: 'Daniel',
    role: 'Contractor',
    phone: '256-606-3443',
    email: '',
    imageUrl: '/uploads/daniel.png',
    department: 'Roofing Crew',
    active: true, notes: "Roofing Contractor"
  },
  {
    id: 'EMP-021',
    name: 'Saul',
    role: 'Contractor',
    phone: '256-893-6676',
    email: '',
    imageUrl: '/uploads/saul.png',
    department: 'Roofing Crew',
    active: true, notes: "Roofing Contractor"
  },
  {
    id: 'EMP-022',
    name: 'Paul Spradlin',
    role: 'Contractor',
    phone: '256-755-1027',
    email: 'prspradlin@gmail.com',
    imageUrl: '/uploads/paul-spradlin.png',
    department: 'Roofing Crew',
    active: true, notes: "Roofing Contractor"
  },
  {
    id: 'EMP-023',
    name: 'Patrick',
    role: 'Contractor',
    phone: '205-612-7162',
    email: 'manuelpetee10@aol.com',
    imageUrl: '/uploads/patrick.png',
    department: 'Roofing Crew',
    active: true, notes: "Roofing Contractor"
  },
  {
    id: 'EMP-024',
    name: 'Advanced Building',
    role: 'Vendor',
    phone: '256-852-6415',
    email: 'srsicorp@billtrust.com',
    imageUrl: '/uploads/advanced-building.png',
    department: 'Vendor',
    active: true, notes: "Materials Supplier"
  },
  {
    id: 'EMP-025',
    name: 'Beacon Roofing Supply',
    role: 'Vendor',
    phone: '256-361-0912',
    email: 'beaconroofingsupply@billtrust.com',
    imageUrl: '/uploads/beacon-roofing-supply.png',
    department: 'Vendor',
    active: true, notes: "Materials Supplier"
  },
  {
    id: 'EMP-026',
    name: 'Gulf Eagle Supply',
    role: 'Vendor',
    phone: '256-355-1145',
    email: 'gulfeaglesupply@billtrust.com',
    imageUrl: '/uploads/gulf-eagle-supply.png',
    department: 'Vendor',
    active: true, notes: "Materials Supplier"
  },
  {
    id: 'EMP-027',
    name: 'Littrell Lumber Mill',
    role: 'Vendor',
    phone: '256-355-6768',
    email: 'amanda@littrelllumbermill.com',
    imageUrl: '/uploads/littrell-lumber-mill.png',
    department: 'Vendor',
    active: true, notes: "Materials Supplier"
  },
  {
    id: 'EMP-028',
    name: 'Majestic Metals',
    role: 'Vendor',
    phone: '256-771-0107',
    email: 'alcustservice@majesticmetalsinc.com',
    imageUrl: '/uploads/majestic-metals.png',
    department: 'Vendor',
    active: true, notes: "Materials Supplier"
  },
];

// Helper functions
export function getEmployeeById(id: string): Employee | undefined {
  return employeeDirectory.find(e => e.id === id);
}

export function getEmployeeByEmail(email: string): Employee | undefined {
  return employeeDirectory.find(e => e.email.toLowerCase() === email.toLowerCase());
}

export function getEmployeeByName(name: string): Employee | undefined {
  return employeeDirectory.find(e => e.name.toLowerCase() === name.toLowerCase());
}

export function getEmployeesByRole(role: EmployeeRole): Employee[] {
  return employeeDirectory.filter(e => e.role === role);
}

export function getEmployeesByDepartment(department: string): Employee[] {
  return employeeDirectory.filter(e => e.department === department);
}

export function getActiveEmployees(): Employee[] {
  return employeeDirectory.filter(e => e.active);
}

export function searchEmployees(query: string): Employee[] {
  const lowerQuery = query.toLowerCase();
  return employeeDirectory.filter(e =>
    e.name.toLowerCase().includes(lowerQuery) ||
    e.email.toLowerCase().includes(lowerQuery) ||
    e.role.toLowerCase().includes(lowerQuery) ||
    (e.department && e.department.toLowerCase().includes(lowerQuery))
  );
}

// Get all unique departments
export function getDepartments(): string[] {
  const departments = new Set<string>();
  employeeDirectory.forEach(e => {
    if (e.department) departments.add(e.department);
  });
  return Array.from(departments);
}

// Get employee count by role
export function getEmployeeCountByRole(): Record<EmployeeRole, number> {
  const counts = {
    Owner: 0,
    Admin: 0,
    Production: 0,
    'Sales Inspector': 0,
    Contractor: 0,
    Vendor: 0
  };

  employeeDirectory.forEach(e => {
    if (e.active) counts[e.role]++;
  });

  return counts;
}

// Get drivers (for delivery assignment)
export function getDrivers(): Employee[] {
  return employeeDirectory.filter(e => 
    e.notes?.includes('Driver') || 
    e.name === 'Rick' ||
    e.department === 'Production'
  );
}

// Get vendors (for restock orders)
export function getVendors(): Employee[] {
  return employeeDirectory.filter(e => e.role === 'Vendor');
}

// Get contractors (for crew assignment)
export function getContractors(): Employee[] {
  return employeeDirectory.filter(e => e.role === 'Contractor');
}

// Get admins (for approvals)
export function getAdmins(): Employee[] {
  return employeeDirectory.filter(e => e.role === 'Admin' || e.role === 'Owner');
}
