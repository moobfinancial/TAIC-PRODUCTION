'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Search, Filter, ChevronLeft, ChevronRight, Eye, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useToast } from '@/hooks/use-toast';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { createAuditLogger, AuditLogEntry } from '@/lib/adminAudit';

interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminAuditLogPage() {
  const { adminApiKey } = useAdminAuth();
  const { toast } = useToast();
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(50);
  
  // Filter states
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [adminUsernameFilter, setAdminUsernameFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAuditLogs = useCallback(async () => {
    if (!adminApiKey) return;
    
    try {
      setLoading(true);
      
      const auditLogger = createAuditLogger(adminApiKey);
      const params: any = {
        page: currentPage,
        limit,
      };

      if (actionFilter) params.action = actionFilter;
      if (entityTypeFilter) params.target_entity_type = entityTypeFilter;
      if (adminUsernameFilter) params.admin_username = adminUsernameFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const data = await auditLogger.getAuditLogs(params);
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch audit logs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, actionFilter, entityTypeFilter, adminUsernameFilter, startDate, endDate, adminApiKey, toast]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleFilterChange = (filterType: string, value: string) => {
    setCurrentPage(1); // Reset to first page when filtering
    
    switch (filterType) {
      case 'action':
        setActionFilter(value);
        break;
      case 'entityType':
        setEntityTypeFilter(value);
        break;
      case 'adminUsername':
        setAdminUsernameFilter(value);
        break;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('viewed')) return 'secondary';
    if (action.includes('updated') || action.includes('changed')) return 'default';
    if (action.includes('activated') || action.includes('verified')) return 'default';
    if (action.includes('deactivated') || action.includes('unverified')) return 'destructive';
    if (action.includes('export')) return 'outline';
    return 'secondary';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDetails = (details: Record<string, any> | null) => {
    if (!details) return 'No details';
    
    const entries = Object.entries(details);
    if (entries.length === 0) return 'No details';
    
    return entries.map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${value}`;
    }).join(', ');
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-6 w-6" />
              Admin Audit Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <Select value={actionFilter || "ALL_ACTIONS"} onValueChange={(value) => handleFilterChange('action', value === "ALL_ACTIONS" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_ACTIONS">All Actions</SelectItem>
                    <SelectItem value="user_viewed">User Viewed</SelectItem>
                    <SelectItem value="user_updated">User Updated</SelectItem>
                    <SelectItem value="user_activated">User Activated</SelectItem>
                    <SelectItem value="user_deactivated">User Deactivated</SelectItem>
                    <SelectItem value="user_export">User Export</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={entityTypeFilter || "ALL_ENTITIES"} onValueChange={(value) => handleFilterChange('entityType', value === "ALL_ENTITIES" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_ENTITIES">All Entities</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="order">Order</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Admin Username"
                  value={adminUsernameFilter}
                  onChange={(e) => setAdminUsernameFilter(e.target.value)}
                />

                <Input
                  type="date"
                  placeholder="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />

                <Input
                  type="date"
                  placeholder="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Results Summary */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-600">
                Showing {logs.length} of {total} audit log entries
              </p>
            </div>

            {/* Audit Log Table */}
            {loading ? (
              <div className="text-center py-8">Loading audit logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No audit log entries found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Timestamp</th>
                      <th className="text-left p-3 font-medium">Admin</th>
                      <th className="text-left p-3 font-medium">Action</th>
                      <th className="text-left p-3 font-medium">Target</th>
                      <th className="text-left p-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{log.admin_username}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {log.action.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">
                          {log.target_entity_type && log.target_entity_id ? (
                            <div>
                              <div className="font-medium">{log.target_entity_type}</div>
                              <div className="text-gray-500 text-xs">
                                {log.target_entity_id.length > 20 
                                  ? `${log.target_entity_id.slice(0, 20)}...` 
                                  : log.target_entity_id}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-gray-600 max-w-xs">
                          <div className="truncate" title={formatDetails(log.details)}>
                            {formatDetails(log.details)}
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
