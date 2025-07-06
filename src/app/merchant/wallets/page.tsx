'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { 
  Wallet, 
  Plus, 
  Eye, 
  EyeOff, 
  Copy, 
  ExternalLink, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Shield,
  Loader2
} from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useToast } from '@/hooks/use-toast';

interface MerchantWallet {
  id: number;
  merchant_id: string;
  wallet_address: string;
  wallet_type: string;
  network: string;
  is_active: boolean;
  is_verified: boolean;
  verification_date: string | null;
  created_at: string;
  updated_at: string;
  balance?: {
    taicBalance: string;
    nativeBalance: string;
    lastUpdated: string;
  };
}

const NETWORK_CONFIGS = {
  FANTOM: { name: 'Fantom Opera', symbol: 'FTM', color: 'bg-blue-500' },
  ETHEREUM: { name: 'Ethereum', symbol: 'ETH', color: 'bg-gray-600' },
  POLYGON: { name: 'Polygon', symbol: 'MATIC', color: 'bg-purple-500' },
  BSC: { name: 'BNB Smart Chain', symbol: 'BNB', color: 'bg-yellow-500' },
  BITCOIN: { name: 'Bitcoin', symbol: 'BTC', color: 'bg-orange-500' }
};

export default function MerchantWalletsPage() {
  const { token, loading: merchantAuthLoading } = useMerchantAuth();
  const { toast } = useToast();

  const [wallets, setWallets] = useState<MerchantWallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddWalletDialog, setShowAddWalletDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBalances, setShowBalances] = useState(false);
  const [refreshingBalances, setRefreshingBalances] = useState(false);

  const [newWalletForm, setNewWalletForm] = useState({
    walletAddress: '',
    walletType: 'TAIC_PAYOUT',
    network: 'FANTOM',
    isActive: true
  });

  // Load wallets
  const loadWallets = async (includeBalances = false) => {
    if (!token) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/merchant/wallets?includeBalances=${includeBalances}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallets');
      }

      const data = await response.json();
      setWallets(data.wallets || []);
    } catch (error: any) {
      console.error('Error loading wallets:', error);
      toast({
        title: "Error Loading Wallets",
        description: error.message || "Failed to load wallet information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh balances
  const refreshBalances = async () => {
    setRefreshingBalances(true);
    await loadWallets(true);
    setRefreshingBalances(false);
    setShowBalances(true);
  };

  // Add new wallet
  const handleAddWallet = async () => {
    if (!newWalletForm.walletAddress.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a wallet address",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/merchant/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newWalletForm),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add wallet');
      }

      toast({
        title: "Wallet Added",
        description: "Your wallet has been added successfully",
      });

      setShowAddWalletDialog(false);
      setNewWalletForm({
        walletAddress: '',
        walletType: 'TAIC_PAYOUT',
        network: 'FANTOM',
        isActive: true
      });

      await loadWallets(showBalances);
    } catch (error: any) {
      toast({
        title: "Failed to Add Wallet",
        description: error.message || "Unable to add wallet",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove wallet
  const handleRemoveWallet = async (walletId: number) => {
    if (!confirm('Are you sure you want to remove this wallet?')) {
      return;
    }

    try {
      const response = await fetch(`/api/merchant/wallets/${walletId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove wallet');
      }

      toast({
        title: "Wallet Removed",
        description: "Wallet has been removed successfully",
      });

      await loadWallets(showBalances);
    } catch (error: any) {
      toast({
        title: "Failed to Remove Wallet",
        description: error.message || "Unable to remove wallet",
        variant: "destructive",
      });
    }
  };

  // Toggle wallet active status
  const toggleWalletStatus = async (walletId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/merchant/wallets/${walletId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update wallet');
      }

      toast({
        title: "Wallet Updated",
        description: `Wallet ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      await loadWallets(showBalances);
    } catch (error: any) {
      toast({
        title: "Failed to Update Wallet",
        description: error.message || "Unable to update wallet status",
        variant: "destructive",
      });
    }
  };

  // Copy wallet address
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Wallet address copied to clipboard",
    });
  };

  // Format wallet address for display
  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  // Load wallets on component mount
  useEffect(() => {
    if (token) {
      loadWallets();
    }
  }, [token]);

  if (merchantAuthLoading || isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading wallets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Crypto Wallets</h1>
          <p className="text-muted-foreground">Manage your payout wallet addresses</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowBalances(!showBalances)}
            disabled={refreshingBalances}
          >
            {showBalances ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showBalances ? 'Hide' : 'Show'} Balances
          </Button>
          {showBalances && (
            <Button 
              variant="outline" 
              onClick={refreshBalances}
              disabled={refreshingBalances}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshingBalances ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
          <Button onClick={() => setShowAddWalletDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Wallet
          </Button>
        </div>
      </div>

      {/* Wallets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wallet className="h-5 w-5 mr-2" />
            Your Wallets
          </CardTitle>
          <CardDescription>
            Manage your cryptocurrency wallet addresses for receiving payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wallets.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No wallets added</h3>
              <p className="text-muted-foreground mb-4">
                Add your first wallet address to start receiving crypto payouts
              </p>
              <Button onClick={() => setShowAddWalletDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Wallet
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Network</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  {showBalances && <TableHead>Balance</TableHead>}
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet) => {
                  const networkConfig = NETWORK_CONFIGS[wallet.network as keyof typeof NETWORK_CONFIGS];
                  return (
                    <TableRow key={wallet.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full ${networkConfig?.color || 'bg-gray-400'} mr-2`} />
                          <div>
                            <div className="font-medium">{networkConfig?.name || wallet.network}</div>
                            <div className="text-xs text-muted-foreground">{networkConfig?.symbol || wallet.network}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {formatAddress(wallet.wallet_address)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(wallet.wallet_address)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{wallet.wallet_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant={wallet.is_active ? "default" : "secondary"}>
                            {wallet.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {wallet.is_verified && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {showBalances && (
                        <TableCell>
                          {wallet.balance ? (
                            <div className="text-sm">
                              <div>{parseFloat(wallet.balance.taicBalance).toFixed(2)} TAIC</div>
                              <div className="text-xs text-muted-foreground">
                                {parseFloat(wallet.balance.nativeBalance).toFixed(4)} {networkConfig?.symbol}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(wallet.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleWalletStatus(wallet.id, wallet.is_active)}
                          >
                            {wallet.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveWallet(wallet.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Wallet Dialog */}
      <Dialog open={showAddWalletDialog} onOpenChange={setShowAddWalletDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Add New Wallet
            </DialogTitle>
            <DialogDescription>
              Add a cryptocurrency wallet address to receive payouts
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="network">Network</Label>
              <Select 
                value={newWalletForm.network} 
                onValueChange={(value) => setNewWalletForm(prev => ({ ...prev, network: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NETWORK_CONFIGS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${config.color} mr-2`} />
                        {config.name} ({config.symbol})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletAddress">Wallet Address</Label>
              <Input
                id="walletAddress"
                value={newWalletForm.walletAddress}
                onChange={(e) => setNewWalletForm(prev => ({ ...prev, walletAddress: e.target.value }))}
                placeholder="Enter your wallet address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletType">Wallet Type</Label>
              <Select 
                value={newWalletForm.walletType} 
                onValueChange={(value) => setNewWalletForm(prev => ({ ...prev, walletType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAIC_PAYOUT">TAIC Payout</SelectItem>
                  <SelectItem value="ETHEREUM">Ethereum</SelectItem>
                  <SelectItem value="BITCOIN">Bitcoin</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddWalletDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddWallet}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Wallet'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back to Dashboard */}
      <div className="text-center">
        <Button variant="outline" asChild>
          <Link href="/merchant/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
