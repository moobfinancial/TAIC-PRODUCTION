'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Filter, ChevronLeft, ChevronRight, Eye, Edit, Shield, Mail, Wallet, Download, CheckSquare, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useToast } from '@/hooks/use-toast';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import Link from 'next/link';

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: string;
  wallet_address: string | null;
  is_active: boolean;
  email_verified: boolean;
  wallet_verified: boolean;
  business_name: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface UsersListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const { adminApiKey, get } = useAdminAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);

  // Bulk operations state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState('');
  const [walletVerifiedFilter, setWalletVerifiedFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });

      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (emailVerifiedFilter) params.append('emailVerified', emailVerifiedFilter);
      if (walletVerifiedFilter) params.append('walletVerified', walletVerifiedFilter);

      const response = await get(adminApiKey, `/api/admin/users?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data: UsersListResponse = await response.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, search, roleFilter, statusFilter, emailVerifiedFilter, walletVerifiedFilter, sortBy, sortOrder, get, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setCurrentPage(1); // Reset to first page when filtering
    
    switch (filterType) {
      case 'role':
        setRoleFilter(value);
        break;
      case 'status':
        setStatusFilter(value);
        break;
      case 'emailVerified':
        setEmailVerifiedFilter(value);
        break;
      case 'walletVerified':
        setWalletVerifiedFilter(value);
        break;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'destructive';
      case 'MERCHANT': return 'default';
      case 'SHOPPER': return 'secondary';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Bulk operations handlers
  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(user => user.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleExportUsers = async () => {
    try {
      setBulkOperationLoading(true);

      const params = new URLSearchParams({
        export: 'csv',
        ...(selectedUsers.size > 0 && { user_ids: Array.from(selectedUsers).join(',') })
      });

      const response = await get(adminApiKey, `/api/admin/users/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to export users');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: `Exported ${selectedUsers.size > 0 ? selectedUsers.size : total} users successfully.`,
      });

    } catch (error) {
      console.error('Error exporting users:', error);
      toast({
        title: 'Error',
        description: 'Failed to export users. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBulkOperationLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-6 w-6" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search and Filters */}
            <div className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by email, username, name, or wallet address..."
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </div>

              {/* Filter Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Select value={roleFilter || "ALL_ROLES"} onValueChange={(value) => handleFilterChange('role', value === "ALL_ROLES" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_ROLES">All Roles</SelectItem>
                    <SelectItem value="SHOPPER">Shopper</SelectItem>
                    <SelectItem value="MERCHANT">Merchant</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter || "ALL_STATUS"} onValueChange={(value) => handleFilterChange('status', value === "ALL_STATUS" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_STATUS">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={emailVerifiedFilter || "ALL_EMAIL"} onValueChange={(value) => handleFilterChange('emailVerified', value === "ALL_EMAIL" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Email Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_EMAIL">All Email</SelectItem>
                    <SelectItem value="true">Verified</SelectItem>
                    <SelectItem value="false">Unverified</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={walletVerifiedFilter || "ALL_WALLET"} onValueChange={(value) => handleFilterChange('walletVerified', value === "ALL_WALLET" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wallet Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_WALLET">All Wallet</SelectItem>
                    <SelectItem value="true">Verified</SelectItem>
                    <SelectItem value="false">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Summary and Bulk Operations */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600">
                  Showing {users.length} of {total} users
                </p>
                {selectedUsers.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-600 font-medium">
                      {selectedUsers.size} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportUsers}
                      disabled={bulkOperationLoading}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Selected
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Created</SelectItem>
                    <SelectItem value="updated_at">Updated</SelectItem>
                    <SelectItem value="last_login_at">Last Login</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="username">Username</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
              </div>
            </div>

            {/* Users Table */}
            {loading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium w-12">
                        <button
                          onClick={() => handleSelectAll(selectedUsers.size !== users.length)}
                          className="flex items-center justify-center w-5 h-5"
                        >
                          {selectedUsers.size === users.length && users.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : selectedUsers.size > 0 ? (
                            <div className="w-4 h-4 bg-blue-600 border border-blue-600 rounded-sm flex items-center justify-center">
                              <div className="w-2 h-1 bg-white"></div>
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Role</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Verification</th>
                      <th className="text-left p-3 font-medium">Created</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <button
                            onClick={() => handleSelectUser(user.id, !selectedUsers.has(user.id))}
                            className="flex items-center justify-center w-5 h-5"
                          >
                            {selectedUsers.has(user.id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{user.full_name || user.username}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                            {user.business_name && (
                              <div className="text-sm text-blue-600">{user.business_name}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={user.is_active ? 'default' : 'secondary'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Badge variant={user.email_verified ? 'default' : 'outline'} className="text-xs">
                              <Mail className="w-3 h-3 mr-1" />
                              {user.email_verified ? 'Verified' : 'Unverified'}
                            </Badge>
                            {user.wallet_address && (
                              <Badge variant={user.wallet_verified ? 'default' : 'outline'} className="text-xs">
                                <Wallet className="w-3 h-3 mr-1" />
                                {user.wallet_verified ? 'Verified' : 'Unverified'}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Link href={`/admin/users/${user.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
