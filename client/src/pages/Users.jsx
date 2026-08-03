import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, Trash2, Mail, Phone, ArrowUpDown, X } from 'lucide-react';
import { toast } from 'sonner';
import AddUserDialog from '@/components/users/AddUserDialog';

const ROLES = ['Admin', 'Sales', 'Ops', 'Chef', 'Event Host', 'Finance', 'Instructor'];

const roleColors = {
  'Admin': 'bg-purple-100 text-purple-800',
  'Sales': 'bg-blue-100 text-blue-800',
  'Ops': 'bg-green-100 text-green-800',
  'Chef': 'bg-orange-100 text-orange-800',
  'Event Host': 'bg-pink-100 text-pink-800',
  'Finance': 'bg-indigo-100 text-indigo-800',
  'Instructor': 'bg-teal-100 text-teal-800'
};

export default function Users() {
  const queryClient = useQueryClient();
  const [showAddUser, setShowAddUser] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['role-assignments'],
    queryFn: () => base44.entities.RoleAssignment.list(),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => base44.entities.RoleAssignment.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      toast.success('User deactivated');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => base44.entities.RoleAssignment.update(id, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      toast.success('User reactivated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (assignment) => {
      if (assignment.user_id) {
        await base44.entities.User.delete(assignment.user_id);
      }
      await base44.entities.RoleAssignment.delete(assignment.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
  });

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...assignments];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        (a.contact_name || a.user_name || '').toLowerCase().includes(q) ||
        (a.contact_email || a.user_email || '').toLowerCase().includes(q)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      list = list.filter(a => a.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      const active = statusFilter === 'active';
      list = list.filter(a => a.is_active === active);
    }

    // Sort
    list.sort((a, b) => {
      let va, vb;
      if (sortKey === 'name') {
        va = (a.contact_name || a.user_name || '').toLowerCase();
        vb = (b.contact_name || b.user_name || '').toLowerCase();
      } else if (sortKey === 'role') {
        va = a.role;
        vb = b.role;
      } else if (sortKey === 'status') {
        va = a.is_active ? 1 : 0;
        vb = b.is_active ? 1 : 0;
      } else {
        return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [assignments, search, roleFilter, statusFilter, sortKey, sortDir]);

  const hasFilters = search || roleFilter !== 'all' || statusFilter !== 'all';

  const SortHeader = ({ label, field }) => (
    <TableHead>
      <button
        onClick={() => toggleSort(field)}
        className="flex items-center gap-1 hover:text-[#C84B31] transition-colors"
      >
        {label}
        <ArrowUpDown className={`w-3.5 h-3.5 ${sortKey === field ? 'text-[#C84B31]' : 'text-gray-400'}`} />
      </button>
    </TableHead>
  );

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Users</h1>
          <p className="text-gray-600">Team members and their roles</p>
        </div>
        <Button
          onClick={() => setShowAddUser(true)}
          className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl border border-orange-100 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9 border-gray-200 focus:border-[#C84B31]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px] border-gray-200">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] border-gray-200">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <span className="text-xs text-gray-500">
            {filteredAndSorted.length} of {assignments.length} users
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-orange-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Name" field="name" />
              <SortHeader label="Role" field="role" />
              <SortHeader label="Status" field="status" />
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                  {hasFilters ? 'No users match your filters' : 'No users yet — add your first team member'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map(assignment => (
                <TableRow key={assignment.id} className="hover:bg-orange-50/50">
                  <TableCell className="font-medium text-gray-900">
                    {assignment.contact_name || assignment.user_name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={roleColors[assignment.role]}>
                      {assignment.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={assignment.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                      {assignment.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {assignment.contact_email || assignment.user_email || '—'}
                      </div>
                      {assignment.contact_phone && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {assignment.contact_phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {assignment.is_active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deactivateMutation.mutate(assignment.id)}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 px-2 text-xs"
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => reactivateMutation.mutate(assignment.id)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-2 text-xs"
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const name = assignment.contact_name || assignment.user_name;
                          if (confirm(`Remove ${name}?`)) {
                            deleteMutation.mutate(assignment);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredAndSorted.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Showing {filteredAndSorted.length} of {assignments.length} users
        </p>
      )}

      {showAddUser && (
        <AddUserDialog onClose={() => setShowAddUser(false)} />
      )}
    </div>
  );
}