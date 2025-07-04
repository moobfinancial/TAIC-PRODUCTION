'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  User, ArrowLeft, Mail, Wallet, Shield, Calendar, MapPin, 
  Package, DollarSign, Edit, Save, X, CheckCircle, XCircle 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useToast } from '@/hooks/use-toast';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { createAuditLogger, USER_AUDIT_ACTIONS } from '@/lib/adminAudit';

interface UserAddress {
  id: number;
  address_nickname: string | null;
  contact_name: string;
  company_name: string | null;
  street_address_line1: string;
  street_address_line2: string | null;
  city: string;
  state_province_region: string;
  postal_zip_code: string;
  country_code: string;
  phone_number: string | null;
  is_default_shipping: boolean;
  is_default_billing: boolean;
  created_at: string;
}

interface AdminUserProfile {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: string;
  wallet_address: string | null;
  is_active: boolean;
  is_superuser: boolean;
  email_verified: boolean;
  wallet_verified: boolean;
  business_name: string | null;
  business_description: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  order_count: number;
  total_spent: number;
  addresses: UserAddress[];
}

export default function AdminUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { get, adminApiKey } = useAdminAuth();
  const { toast } = useToast();
  
  const [user, setUser] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    is_active: true,
    role: 'SHOPPER',
    email_verified: false,
    wallet_verified: false,
  });

  const userId = params?.id as string;

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  // Record user view action for audit log
  useEffect(() => {
    if (user && adminApiKey) {
      const auditLogger = createAuditLogger(adminApiKey);
      auditLogger.recordUserAction(USER_AUDIT_ACTIONS.USER_VIEWED, userId, {
        user_email: user.email,
        user_role: user.role,
        viewed_at: new Date().toISOString()
      });
    }
  }, [user, adminApiKey, userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await get(adminApiKey, `/api/admin/users/${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: 'User Not Found',
            description: 'The requested user could not be found.',
            variant: 'destructive',
          });
          router.push('/admin/users');
          return;
        }
        throw new Error('Failed to fetch user profile');
      }

      const userData: AdminUserProfile = await response.json();
      setUser(userData);
      setEditForm({
        is_active: userData.is_active,
        role: userData.role,
        email_verified: userData.email_verified,
        wallet_verified: userData.wallet_verified,
      });
      
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch user profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !adminApiKey) return;

    try {
      setSaving(true);

      // Track changes for audit logging
      const changes: Record<string, any> = {};
      if (editForm.is_active !== user.is_active) {
        changes.is_active = { from: user.is_active, to: editForm.is_active };
      }
      if (editForm.role !== user.role) {
        changes.role = { from: user.role, to: editForm.role };
      }
      if (editForm.email_verified !== user.email_verified) {
        changes.email_verified = { from: user.email_verified, to: editForm.email_verified };
      }
      if (editForm.wallet_verified !== user.wallet_verified) {
        changes.wallet_verified = { from: user.wallet_verified, to: editForm.wallet_verified };
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': adminApiKey,
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      const result = await response.json();

      // Update local state
      setUser(prev => prev ? { ...prev, ...editForm, updated_at: new Date().toISOString() } : null);
      setEditing(false);

      // Record audit log for the changes
      if (Object.keys(changes).length > 0) {
        const auditLogger = createAuditLogger(adminApiKey);
        await auditLogger.recordUserAction(USER_AUDIT_ACTIONS.USER_UPDATED, userId, {
          changes,
          user_email: user.email,
          updated_at: new Date().toISOString()
        });
      }

      toast({
        title: 'Success',
        description: 'User profile updated successfully.',
      });

    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setEditForm({
        is_active: user.is_active,
        role: user.role,
        email_verified: user.email_verified,
        wallet_verified: user.wallet_verified,
      });
    }
    setEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'destructive';
      case 'MERCHANT': return 'default';
      case 'SHOPPER': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading user profile...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!user) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-500">User not found</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/admin/users')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center">
                <User className="mr-2 h-6 w-6" />
                {user.full_name || user.username}
              </h1>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit User
              </Button>
            )}
          </div>
        </div>

        {/* User Information Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Username</label>
                  <p className="font-medium">{user.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Full Name</label>
                  <p className="font-medium">{user.full_name || 'Not provided'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.email || 'Not provided'}</p>
                    {user.email && (
                      editing ? (
                        <Switch
                          checked={editForm.email_verified}
                          onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, email_verified: checked }))}
                        />
                      ) : (
                        user.email_verified ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )
                      )
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Wallet Address</label>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-xs">
                      {user.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : 'Not connected'}
                    </p>
                    {user.wallet_address && (
                      editing ? (
                        <Switch
                          checked={editForm.wallet_verified}
                          onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, wallet_verified: checked }))}
                        />
                      ) : (
                        user.wallet_verified ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Role</label>
                  {editing ? (
                    <Select value={editForm.role} onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SHOPPER">Shopper</SelectItem>
                        <SelectItem value="MERCHANT">Merchant</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Account Status</label>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editForm.is_active}
                        onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, is_active: checked }))}
                      />
                      <span className="text-sm">{editForm.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  ) : (
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  )}
                </div>
              </div>

              {user.business_name && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Business Name</label>
                  <p className="font-medium">{user.business_name}</p>
                  {user.business_description && (
                    <p className="text-sm text-gray-600 mt-1">{user.business_description}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Account Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{user.order_count}</p>
                  <p className="text-sm text-gray-600">Total Orders</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">${user.total_spent.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">Total Spent</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Created:</span>
                  <span className="text-sm font-medium">{formatDate(user.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Last Updated:</span>
                  <span className="text-sm font-medium">{formatDate(user.updated_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Last Login:</span>
                  <span className="text-sm font-medium">
                    {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Addresses */}
        {user.addresses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="mr-2 h-5 w-5" />
                Saved Addresses ({user.addresses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.addresses.map((address) => (
                  <div key={address.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{address.address_nickname || 'Address'}</h4>
                      <div className="flex gap-1">
                        {address.is_default_shipping && (
                          <Badge variant="outline" className="text-xs">Default Shipping</Badge>
                        )}
                        {address.is_default_billing && (
                          <Badge variant="outline" className="text-xs">Default Billing</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{address.contact_name}</p>
                      {address.company_name && <p>{address.company_name}</p>}
                      <p>{address.street_address_line1}</p>
                      {address.street_address_line2 && <p>{address.street_address_line2}</p>}
                      <p>{address.city}, {address.state_province_region} {address.postal_zip_code}</p>
                      <p>{address.country_code}</p>
                      {address.phone_number && <p>{address.phone_number}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
