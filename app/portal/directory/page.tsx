'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Users,
  User,
  Briefcase,
  Building,
  Star
} from 'lucide-react';
import { employeeDirectory, Employee, EmployeeRole, getDepartments, getEmployeeCountByRole } from '@/lib/employeeDirectory';

export default function EmployeeDirectoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const departments = getDepartments();
  const roleCounts = getEmployeeCountByRole();

  const filteredEmployees = useMemo(() => {
    let filtered = [...employeeDirectory].filter(e => e.active);

    // Search filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(lower) ||
        e.email.toLowerCase().includes(lower) ||
        e.role.toLowerCase().includes(lower) ||
        (e.department && e.department.toLowerCase().includes(lower))
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(e => e.role === roleFilter);
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(e => e.department === departmentFilter);
    }

    return filtered;
  }, [searchTerm, roleFilter, departmentFilter]);

  const getRoleBadgeColor = (role: EmployeeRole) => {
    const colors: Record<EmployeeRole, string> = {
      Owner: 'bg-amber-100 text-amber-800 border-amber-200',
      Admin: 'bg-red-100 text-red-800 border-red-200',
      Production: 'bg-blue-100 text-blue-800 border-blue-200',
      'Sales Inspector': 'bg-green-100 text-green-800 border-green-200',
      Contractor: 'bg-purple-100 text-purple-800 border-purple-200',
      Vendor: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard" className="text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">Employee Directory</h1>
              <p className="text-sm text-neutral-500">21 team members from River City Roofing Solutions</p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(roleCounts).map(([role, count]) => (
            <div key={role} className="bg-white rounded-lg border border-neutral-200 p-4">
              <div className="text-sm text-neutral-500 mb-1">{role}</div>
              <div className="text-2xl font-bold text-neutral-900">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b border-neutral-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="Owner">Owners</option>
              <option value="Admin">Admin</option>
              <option value="Production">Production</option>
              <option value="Sales Inspector">Sales Inspectors</option>
              <option value="Contractor">Contractors</option>
              <option value="Vendor">Vendors</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-neutral-500" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 text-sm text-neutral-500">
          Showing {filteredEmployees.length} employees
        </div>
      </div>

      {/* Employee Grid */}
      <div className="px-6 py-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className="bg-white rounded-lg border border-neutral-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Header with image */}
              <div className="relative h-32 bg-gradient-to-br from-green-500 to-emerald-600">
                <div className="absolute -bottom-8 left-4">
                  <div className="w-16 h-16 rounded-full bg-white border-4 border-white overflow-hidden">
                    {employee.imageUrl ? (
                      <Image
                        src={employee.imageUrl}
                        alt={employee.name}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
                        <User className="w-8 h-8 text-neutral-400" />
                      </div>
                    )}
                  </div>
                </div>
                {employee.role === 'Owner' && (
                  <div className="absolute top-2 right-2">
                    <Star className="w-5 h-5 text-amber-300 fill-amber-300" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="pt-10 p-4">
                <h3 className="font-semibold text-neutral-900 text-lg">{employee.name}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(employee.role)}`}>
                  {employee.role}
                </span>

                {employee.department && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-neutral-500">
                    <Briefcase className="w-3 h-3" />
                    {employee.department}
                  </div>
                )}

                {employee.notes && (
                  <p className="mt-2 text-sm text-neutral-600">{employee.notes}</p>
                )}

                <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2">
                  {employee.phone && (
                    <a
                      href={`tel:${employee.phone}`}
                      className="flex items-center gap-2 text-sm text-neutral-600 hover:text-green-600"
                    >
                      <Phone className="w-4 h-4" />
                      {employee.phone}
                    </a>
                  )}
                  {employee.email && (
                    <a
                      href={`mailto:${employee.email}`}
                      className="flex items-center gap-2 text-sm text-neutral-600 hover:text-green-600 truncate"
                    >
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{employee.email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
