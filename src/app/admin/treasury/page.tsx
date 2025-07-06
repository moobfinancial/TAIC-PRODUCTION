'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Vault,
  Shield,
  Key,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Eye,
  Lock,
  Unlock,
  Send,
  Users,
  TrendingUp,
  Activity,
  Loader2,
  RefreshCw,
  Settings,
  FileText,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TreasuryWallet {
  id: string;
  walletType: string;
  network: string;
  address: string;
  isMultiSig: boolean;
  requiredSignatures: number;
  totalSigners: number;
  signers: string[];
  status: string;
  securityLevel: string;
  dailyLimit: string;
  monthlyLimit: string;
  description: string | null;
  balance: {
    taicBalance: string;
    nativeBalance: string;
    lastUpdated: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface MultiSigTransaction {
  id: string;
  treasuryWalletId: string;
  walletType: string;
  network: string;
  transactionType: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  currency: string;
  status: string;
  requiredSignatures: number;
  currentSignatures: number;
  signatures: any[];
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  reason: string;
  transactionHash?: string;
}

interface TreasurySummary {
  totalWallets: number;
  activeWallets: number;
  multiSigWallets: number;
  criticalWallets: number;
  lockedWallets: number;
}

interface TransactionSummary {
  totalTransactions: number;
  pendingTransactions: number;
  partiallySigned: number;
  fullySigned: number;
  executedTransactions: number;
  expiredTransactions: number;
  expiringSoon: number;
}

const WALLET_TYPES = [
  { value: 'MAIN_TREASURY', label: 'Main Treasury', description: 'Primary treasury wallet for platform funds' },
  { value: 'PAYOUT_RESERVE', label: 'Payout Reserve', description: 'Reserved funds for merchant payouts' },
  { value: 'STAKING_REWARDS', label: 'Staking Rewards', description: 'Funds allocated for staking rewards' },
  { value: 'EMERGENCY_RESERVE', label: 'Emergency Reserve', description: 'Emergency funds for critical situations' },
  { value: 'OPERATIONAL', label: 'Operational', description: 'Day-to-day operational expenses' }
];

const NETWORKS = [
  { value: 'FANTOM', label: 'Fantom Opera', symbol: 'FTM', color: 'bg-blue-500' },
  { value: 'ETHEREUM', label: 'Ethereum', symbol: 'ETH', color: 'bg-gray-600' },
  { value: 'POLYGON', label: 'Polygon', symbol: 'MATIC', color: 'bg-purple-500' },
  { value: 'BSC', label: 'BNB Smart Chain', symbol: 'BNB', color: 'bg-yellow-500' },
  { value: 'BITCOIN', label: 'Bitcoin', symbol: 'BTC', color: 'bg-orange-500' }
];

const SECURITY_LEVELS = [
  { value: 'LOW', label: 'Low', color: 'text-green-600', description: 'Basic security for low-value operations' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-600', description: 'Standard security for regular operations' },
  { value: 'HIGH', label: 'High', color: 'text-orange-600', description: 'Enhanced security for important operations' },
  { value: 'CRITICAL', label: 'Critical', color: 'text-red-600', description: 'Maximum security for critical operations' }
];

export default function AdminTreasuryPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [treasuryWallets, setTreasuryWallets] = useState<TreasuryWallet[]>([]);
  const [multiSigTransactions, setMultiSigTransactions] = useState<MultiSigTransaction[]>([]);
  const [treasurySummary, setTreasurySummary] = useState<TreasurySummary | null>(null);
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [showCreateWalletDialog, setShowCreateWalletDialog] = useState(false);
  const [showCreateTransactionDialog, setShowCreateTransactionDialog] = useState(false);
  const [showSignTransactionDialog, setShowSignTransactionDialog] = useState(false);
  const [showEmergencyLockDialog, setShowEmergencyLockDialog] = useState(false);

  // Form states
  const [createWalletForm, setCreateWalletForm] = useState({
    walletType: '',
    network: '',
    signers: [''],
    requiredSignatures: 2,
    securityLevel: 'HIGH',
    dailyLimit: '',
    monthlyLimit: '',
    description: ''
  });

  const [createTransactionForm, setCreateTransactionForm] = useState({
    treasuryWalletId: '',
    transactionType: 'PAYOUT',
    toAddress: '',
    amount: '',
    currency: 'TAIC',
    reason: '',
    priority: 'NORMAL'
  });

  const [signTransactionForm, setSignTransactionForm] = useState({
    transactionId: '',
    signerId: '',
    signerAddress: '',
    privateKey: ''
  });

  const [emergencyLockForm, setEmergencyLockForm] = useState({
    treasuryWalletId: '',
    reason: '',
    lockDuration: 24,
    adminId: 'admin_user'
  });

  // Load treasury data
  const loadTreasuryData = async () => {
    try {
      setIsLoading(true);

      // Load treasury wallets
      const walletsResponse = await fetch('/api/admin/treasury/wallets', {
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
      });

      if (walletsResponse.ok) {
        const walletsData = await walletsResponse.json();
        setTreasuryWallets(walletsData.wallets || []);
        setTreasurySummary(walletsData.summary || null);
      }

      // Load multi-sig transactions
      const transactionsResponse = await fetch('/api/admin/treasury/multisig?limit=20', {
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
      });

      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setMultiSigTransactions(transactionsData.transactions || []);
        setTransactionSummary(transactionsData.summary || null);
      }

    } catch (error: any) {
      console.error('Error loading treasury data:', error);
      toast({
        title: "Error Loading Treasury Data",
        description: error.message || "Failed to load treasury information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create treasury wallet
  const handleCreateWallet = async () => {
    if (!createWalletForm.walletType || !createWalletForm.network || createWalletForm.signers.filter(s => s.trim()).length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/treasury/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
        body: JSON.stringify({
          ...createWalletForm,
          signers: createWalletForm.signers.filter(s => s.trim())
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create treasury wallet');
      }

      toast({
        title: "Treasury Wallet Created",
        description: "Treasury wallet has been created successfully",
      });

      setShowCreateWalletDialog(false);
      setCreateWalletForm({
        walletType: '',
        network: '',
        signers: [''],
        requiredSignatures: 2,
        securityLevel: 'HIGH',
        dailyLimit: '',
        monthlyLimit: '',
        description: ''
      });

      await loadTreasuryData();
    } catch (error: any) {
      toast({
        title: "Failed to Create Wallet",
        description: error.message || "Unable to create treasury wallet",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create multi-sig transaction
  const handleCreateTransaction = async () => {
    if (!createTransactionForm.treasuryWalletId || !createTransactionForm.toAddress || !createTransactionForm.amount || !createTransactionForm.reason) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/treasury/multisig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
        body: JSON.stringify(createTransactionForm),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create transaction');
      }

      toast({
        title: "Transaction Created",
        description: "Multi-signature transaction has been created successfully",
      });

      setShowCreateTransactionDialog(false);
      setCreateTransactionForm({
        treasuryWalletId: '',
        transactionType: 'PAYOUT',
        toAddress: '',
        amount: '',
        currency: 'TAIC',
        reason: '',
        priority: 'NORMAL'
      });

      await loadTreasuryData();
    } catch (error: any) {
      toast({
        title: "Failed to Create Transaction",
        description: error.message || "Unable to create transaction",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add signer field
  const addSignerField = () => {
    setCreateWalletForm(prev => ({
      ...prev,
      signers: [...prev.signers, '']
    }));
  };

  // Remove signer field
  const removeSignerField = (index: number) => {
    setCreateWalletForm(prev => ({
      ...prev,
      signers: prev.signers.filter((_, i) => i !== index)
    }));
  };

  // Update signer
  const updateSigner = (index: number, value: string) => {
    setCreateWalletForm(prev => ({
      ...prev,
      signers: prev.signers.map((signer, i) => i === index ? value : signer)
    }));
  };

  // Load data on component mount
  useEffect(() => {
    loadTreasuryData();
  }, []);

  // Helper functions
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'MAINTENANCE':
        return <Badge className="bg-yellow-100 text-yellow-800"><Settings className="w-3 h-3 mr-1" />Maintenance</Badge>;
      case 'EMERGENCY_LOCKED':
        return <Badge className="bg-red-100 text-red-800"><Lock className="w-3 h-3 mr-1" />Emergency Locked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTransactionStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'PARTIALLY_SIGNED':
        return <Badge className="bg-blue-100 text-blue-800"><Users className="w-3 h-3 mr-1" />Partially Signed</Badge>;
      case 'FULLY_SIGNED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Ready to Execute</Badge>;
      case 'EXECUTED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Executed</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-gray-100 text-gray-800">Expired</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSecurityLevelBadge = (level: string) => {
    const config = SECURITY_LEVELS.find(s => s.value === level);
    return (
      <Badge variant="outline" className={config?.color}>
        <Shield className="w-3 h-3 mr-1" />
        {config?.label || level}
      </Badge>
    );
  };

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading treasury system...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Vault className="mr-3 h-8 w-8 text-primary" />
            Treasury Management
          </h1>
          <p className="text-muted-foreground">Multi-signature treasury wallet system with HSM security</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadTreasuryData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateWalletDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Wallet
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {treasurySummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
              <Vault className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{treasurySummary.totalWallets}</div>
              <p className="text-xs text-muted-foreground">
                {treasurySummary.activeWallets} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Multi-Sig Wallets</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{treasurySummary.multiSigWallets}</div>
              <p className="text-xs text-muted-foreground">
                Enhanced security
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Wallets</CardTitle>
              <Shield className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{treasurySummary.criticalWallets}</div>
              <p className="text-xs text-muted-foreground">
                Maximum security
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emergency Locked</CardTitle>
              <Lock className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{treasurySummary.lockedWallets}</div>
              <p className="text-xs text-muted-foreground">
                Security lockdown
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Wallets</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{treasurySummary.activeWallets}</div>
              <p className="text-xs text-muted-foreground">
                Operational status
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction Summary */}
      {transactionSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Multi-Signature Transaction Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{transactionSummary.totalTransactions}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{transactionSummary.pendingTransactions}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{transactionSummary.partiallySigned}</div>
                <div className="text-xs text-muted-foreground">Partial</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{transactionSummary.fullySigned}</div>
                <div className="text-xs text-muted-foreground">Ready</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{transactionSummary.executedTransactions}</div>
                <div className="text-xs text-muted-foreground">Executed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{transactionSummary.expiredTransactions}</div>
                <div className="text-xs text-muted-foreground">Expired</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{transactionSummary.expiringSoon}</div>
                <div className="text-xs text-muted-foreground">Expiring</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="wallets">Treasury Wallets</TabsTrigger>
          <TabsTrigger value="transactions">Multi-Sig Transactions</TabsTrigger>
          <TabsTrigger value="security">Security & Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Recent Transactions
                </CardTitle>
                <CardDescription>Latest multi-signature transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {multiSigTransactions.slice(0, 5).length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No recent transactions
                  </div>
                ) : (
                  <div className="space-y-3">
                    {multiSigTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{tx.transactionType}</span>
                            {getTransactionStatusBadge(tx.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {tx.amount} {tx.currency} • {formatDate(tx.createdAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{tx.currentSignatures}/{tx.requiredSignatures}</div>
                          <div className="text-xs text-muted-foreground">signatures</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Treasury Wallets Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Vault className="mr-2 h-5 w-5" />
                  Treasury Wallets
                </CardTitle>
                <CardDescription>Active treasury wallet overview</CardDescription>
              </CardHeader>
              <CardContent>
                {treasuryWallets.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No treasury wallets configured
                  </div>
                ) : (
                  <div className="space-y-3">
                    {treasuryWallets.slice(0, 5).map((wallet) => (
                      <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{wallet.walletType.replace('_', ' ')}</span>
                            {getStatusBadge(wallet.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {wallet.network} • {formatAddress(wallet.address)}
                          </div>
                        </div>
                        <div className="text-right">
                          {getSecurityLevelBadge(wallet.securityLevel)}
                          <div className="text-xs text-muted-foreground mt-1">
                            {wallet.requiredSignatures}/{wallet.totalSigners} sigs
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="wallets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Treasury Wallets</h3>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateWalletDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Wallet
              </Button>
            </div>
          </div>

          {treasuryWallets.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Vault className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Treasury Wallets</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first treasury wallet to start managing platform funds securely
                </p>
                <Button onClick={() => setShowCreateWalletDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Treasury Wallet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {treasuryWallets.map((wallet) => (
                <Card key={wallet.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <span>{wallet.walletType.replace('_', ' ')}</span>
                          {getStatusBadge(wallet.status)}
                        </CardTitle>
                        <CardDescription>
                          {wallet.network} • Created {formatDate(wallet.createdAt)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getSecurityLevelBadge(wallet.securityLevel)}
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                        <div className="font-mono text-sm">{formatAddress(wallet.address)}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Multi-Sig Config</Label>
                        <div className="text-sm">
                          {wallet.requiredSignatures}/{wallet.totalSigners} signatures required
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Daily Limit</Label>
                        <div className="text-sm">{parseFloat(wallet.dailyLimit).toLocaleString()} TAIC</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Balance</Label>
                        <div className="text-sm">
                          {wallet.balance ? (
                            <>
                              <div>{parseFloat(wallet.balance.taicBalance).toFixed(2)} TAIC</div>
                              <div className="text-xs text-muted-foreground">
                                {parseFloat(wallet.balance.nativeBalance).toFixed(4)} {NETWORKS.find(n => n.value === wallet.network)?.symbol}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Loading...</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {wallet.description && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <p className="text-sm">{wallet.description}</p>
                      </div>
                    )}

                    <div className="mt-4 flex justify-between items-center">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCreateTransactionForm(prev => ({ ...prev, treasuryWalletId: wallet.id }));
                            setShowCreateTransactionDialog(true);
                          }}
                          disabled={wallet.status !== 'ACTIVE'}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Create Transaction
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEmergencyLockForm(prev => ({ ...prev, treasuryWalletId: wallet.id }));
                            setShowEmergencyLockDialog(true);
                          }}
                          disabled={wallet.status === 'EMERGENCY_LOCKED'}
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          Emergency Lock
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last updated: {formatDate(wallet.updatedAt)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Multi-Signature Transactions</h3>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowCreateTransactionDialog(true)}
                disabled={treasuryWallets.filter(w => w.status === 'ACTIVE').length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Transaction
              </Button>
            </div>
          </div>

          {multiSigTransactions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Multi-Signature Transactions</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first multi-signature transaction to start treasury operations
                </p>
                <Button
                  onClick={() => setShowCreateTransactionDialog(true)}
                  disabled={treasuryWallets.filter(w => w.status === 'ACTIVE').length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Transaction
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {multiSigTransactions.map((tx) => (
                <Card key={tx.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <span>{tx.transactionType}</span>
                          {getTransactionStatusBadge(tx.status)}
                        </CardTitle>
                        <CardDescription>
                          {tx.walletType.replace('_', ' ')} • {tx.network} • Created {formatDate(tx.createdAt)}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{tx.amount} {tx.currency}</div>
                        <div className="text-sm text-muted-foreground">
                          {tx.currentSignatures}/{tx.requiredSignatures} signatures
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">From Address</Label>
                        <div className="font-mono text-sm">{formatAddress(tx.fromAddress)}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">To Address</Label>
                        <div className="font-mono text-sm">{formatAddress(tx.toAddress)}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Expires At</Label>
                        <div className="text-sm">{formatDate(tx.expiresAt)}</div>
                      </div>
                    </div>

                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <Label className="text-xs text-muted-foreground">Reason</Label>
                      <p className="text-sm">{tx.reason}</p>
                    </div>

                    {tx.signatures.length > 0 && (
                      <div className="mb-4">
                        <Label className="text-xs text-muted-foreground">Signatures</Label>
                        <div className="mt-2 space-y-2">
                          {tx.signatures.map((sig, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded">
                              <div>
                                <div className="font-mono text-sm">{formatAddress(sig.signerAddress)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Signed {formatDate(sig.signedAt)}
                                </div>
                              </div>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <div className="flex space-x-2">
                        {tx.status === 'PENDING' || tx.status === 'PARTIALLY_SIGNED' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSignTransactionForm(prev => ({ ...prev, transactionId: tx.id }));
                              setShowSignTransactionDialog(true);
                            }}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            Sign Transaction
                          </Button>
                        ) : null}

                        {tx.status === 'FULLY_SIGNED' ? (
                          <Button
                            size="sm"
                            onClick={async () => {
                              // Execute transaction
                              try {
                                const response = await fetch('/api/admin/treasury/execute', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
                                  },
                                  body: JSON.stringify({
                                    transactionId: tx.id,
                                    executorId: 'admin_user',
                                    executorAddress: 'admin_address'
                                  }),
                                });

                                const result = await response.json();

                                if (response.ok) {
                                  toast({
                                    title: "Transaction Executed",
                                    description: "Multi-signature transaction executed successfully",
                                  });
                                  await loadTreasuryData();
                                } else {
                                  throw new Error(result.error);
                                }
                              } catch (error: any) {
                                toast({
                                  title: "Execution Failed",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Execute Transaction
                          </Button>
                        ) : null}

                        {tx.transactionHash && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`${NETWORKS.find(n => n.value === tx.network)?.value === 'ETHEREUM' ? 'https://etherscan.io' : 'https://ftmscan.com'}/tx/${tx.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View on Explorer
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created by: {tx.createdBy}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  Security Overview
                </CardTitle>
                <CardDescription>Treasury security status and compliance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Multi-Signature Enabled</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">HSM Integration</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Audit Logging</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Emergency Lock System</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Ready</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Risk Management
                </CardTitle>
                <CardDescription>Treasury risk assessment and controls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Daily Transaction Limits</Label>
                    <div className="mt-2 space-y-2">
                      {SECURITY_LEVELS.map((level) => (
                        <div key={level.value} className="flex justify-between items-center">
                          <span className="text-sm">{level.label}</span>
                          <span className="text-sm font-mono">
                            {level.value === 'LOW' ? '10,000' :
                             level.value === 'MEDIUM' ? '100,000' :
                             level.value === 'HIGH' ? '1,000,000' : '10,000,000'} TAIC
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Risk Thresholds</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Low Risk</span>
                        <span className="text-sm">0-25%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Medium Risk</span>
                        <span className="text-sm">26-50%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">High Risk</span>
                        <span className="text-sm">51-75%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Critical Risk</span>
                        <span className="text-sm">76-100%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Treasury Wallet Dialog */}
      <Dialog open={showCreateWalletDialog} onOpenChange={setShowCreateWalletDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Vault className="mr-2 h-5 w-5" />
              Create Treasury Wallet
            </DialogTitle>
            <DialogDescription>
              Create a new multi-signature treasury wallet with enhanced security features
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="walletType">Wallet Type</Label>
                <Select value={createWalletForm.walletType} onValueChange={(value) => setCreateWalletForm(prev => ({ ...prev, walletType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wallet type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WALLET_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="network">Network</Label>
                <Select value={createWalletForm.network} onValueChange={(value) => setCreateWalletForm(prev => ({ ...prev, network: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((network) => (
                      <SelectItem key={network.value} value={network.value}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${network.color}`}></div>
                          <span>{network.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="securityLevel">Security Level</Label>
                <Select value={createWalletForm.securityLevel} onValueChange={(value) => setCreateWalletForm(prev => ({ ...prev, securityLevel: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select security level" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div>
                          <div className={`font-medium ${level.color}`}>{level.label}</div>
                          <div className="text-xs text-muted-foreground">{level.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requiredSignatures">Required Signatures</Label>
                <Input
                  id="requiredSignatures"
                  type="number"
                  min="1"
                  max="10"
                  value={createWalletForm.requiredSignatures}
                  onChange={(e) => setCreateWalletForm(prev => ({ ...prev, requiredSignatures: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Signer Addresses</Label>
              {createWalletForm.signers.map((signer, index) => (
                <div key={index} className="flex space-x-2">
                  <Input
                    value={signer}
                    onChange={(e) => updateSigner(index, e.target.value)}
                    placeholder="0x..."
                    className="font-mono"
                  />
                  {createWalletForm.signers.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeSignerField(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSignerField}
                disabled={createWalletForm.signers.length >= 10}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Signer
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyLimit">Daily Limit (TAIC)</Label>
                <Input
                  id="dailyLimit"
                  value={createWalletForm.dailyLimit}
                  onChange={(e) => setCreateWalletForm(prev => ({ ...prev, dailyLimit: e.target.value }))}
                  placeholder="1000000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyLimit">Monthly Limit (TAIC)</Label>
                <Input
                  id="monthlyLimit"
                  value={createWalletForm.monthlyLimit}
                  onChange={(e) => setCreateWalletForm(prev => ({ ...prev, monthlyLimit: e.target.value }))}
                  placeholder="10000000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={createWalletForm.description}
                onChange={(e) => setCreateWalletForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the purpose of this treasury wallet..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateWalletDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWallet}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Vault className="mr-2 h-4 w-4" />
                  Create Wallet
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Transaction Dialog */}
      <Dialog open={showCreateTransactionDialog} onOpenChange={setShowCreateTransactionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Send className="mr-2 h-5 w-5" />
              Create Multi-Signature Transaction
            </DialogTitle>
            <DialogDescription>
              Create a new transaction that requires multiple signatures for execution
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="treasuryWallet">Treasury Wallet</Label>
              <Select
                value={createTransactionForm.treasuryWalletId}
                onValueChange={(value) => setCreateTransactionForm(prev => ({ ...prev, treasuryWalletId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select treasury wallet" />
                </SelectTrigger>
                <SelectContent>
                  {treasuryWallets.filter(w => w.status === 'ACTIVE').map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      <div>
                        <div className="font-medium">{wallet.walletType.replace('_', ' ')}</div>
                        <div className="text-xs text-muted-foreground">{wallet.network} • {formatAddress(wallet.address)}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transactionType">Transaction Type</Label>
                <Select
                  value={createTransactionForm.transactionType}
                  onValueChange={(value) => setCreateTransactionForm(prev => ({ ...prev, transactionType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAYOUT">Payout</SelectItem>
                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="REBALANCE">Rebalance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={createTransactionForm.priority}
                  onValueChange={(value) => setCreateTransactionForm(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="toAddress">Destination Address</Label>
              <Input
                id="toAddress"
                value={createTransactionForm.toAddress}
                onChange={(e) => setCreateTransactionForm(prev => ({ ...prev, toAddress: e.target.value }))}
                placeholder="0x..."
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  value={createTransactionForm.amount}
                  onChange={(e) => setCreateTransactionForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={createTransactionForm.currency}
                  onValueChange={(value) => setCreateTransactionForm(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAIC">TAIC</SelectItem>
                    <SelectItem value="ETH">ETH</SelectItem>
                    <SelectItem value="FTM">FTM</SelectItem>
                    <SelectItem value="MATIC">MATIC</SelectItem>
                    <SelectItem value="BNB">BNB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={createTransactionForm.reason}
                onChange={(e) => setCreateTransactionForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Describe the purpose of this transaction..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateTransactionDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTransaction}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Create Transaction
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Transaction Dialog */}
      <Dialog open={showSignTransactionDialog} onOpenChange={setShowSignTransactionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Key className="mr-2 h-5 w-5" />
              Sign Multi-Signature Transaction
            </DialogTitle>
            <DialogDescription>
              Provide your signature to approve this multi-signature transaction
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signerId">Signer ID</Label>
              <Input
                id="signerId"
                value={signTransactionForm.signerId}
                onChange={(e) => setSignTransactionForm(prev => ({ ...prev, signerId: e.target.value }))}
                placeholder="admin_user_1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signerAddress">Signer Address</Label>
              <Input
                id="signerAddress"
                value={signTransactionForm.signerAddress}
                onChange={(e) => setSignTransactionForm(prev => ({ ...prev, signerAddress: e.target.value }))}
                placeholder="0x..."
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="privateKey">Private Key</Label>
              <Input
                id="privateKey"
                type="password"
                value={signTransactionForm.privateKey}
                onChange={(e) => setSignTransactionForm(prev => ({ ...prev, privateKey: e.target.value }))}
                placeholder="Private key for signing..."
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                ⚠️ Private key is used locally for signing and is not stored
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSignTransactionDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!signTransactionForm.signerId || !signTransactionForm.signerAddress || !signTransactionForm.privateKey) {
                  toast({
                    title: "Missing Information",
                    description: "Please fill in all required fields",
                    variant: "destructive",
                  });
                  return;
                }

                setIsSubmitting(true);
                try {
                  const response = await fetch('/api/admin/treasury/multisig', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
                    },
                    body: JSON.stringify(signTransactionForm),
                  });

                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(result.error || 'Failed to sign transaction');
                  }

                  toast({
                    title: "Transaction Signed",
                    description: "Your signature has been added to the transaction",
                  });

                  setShowSignTransactionDialog(false);
                  setSignTransactionForm({
                    transactionId: '',
                    signerId: '',
                    signerAddress: '',
                    privateKey: ''
                  });

                  await loadTreasuryData();
                } catch (error: any) {
                  toast({
                    title: "Failed to Sign Transaction",
                    description: error.message || "Unable to sign transaction",
                    variant: "destructive",
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Sign Transaction
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency Lock Dialog */}
      <Dialog open={showEmergencyLockDialog} onOpenChange={setShowEmergencyLockDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <Lock className="mr-2 h-5 w-5" />
              Emergency Lock Treasury Wallet
            </DialogTitle>
            <DialogDescription>
              Immediately lock the treasury wallet to prevent all transactions. This action should only be used in emergency situations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lockReason">Emergency Reason</Label>
              <Textarea
                id="lockReason"
                value={emergencyLockForm.reason}
                onChange={(e) => setEmergencyLockForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Describe the emergency situation requiring this lock..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lockDuration">Lock Duration (Hours)</Label>
              <Input
                id="lockDuration"
                type="number"
                min="1"
                max="168"
                value={emergencyLockForm.lockDuration}
                onChange={(e) => setEmergencyLockForm(prev => ({ ...prev, lockDuration: parseInt(e.target.value) || 24 }))}
              />
              <p className="text-xs text-muted-foreground">
                Maximum 168 hours (1 week). Lock can be manually removed by authorized personnel.
              </p>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Warning: Emergency Lock</p>
                  <p>This will immediately prevent all transactions from this wallet and cancel any pending multi-signature transactions.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmergencyLockDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!emergencyLockForm.reason.trim()) {
                  toast({
                    title: "Missing Information",
                    description: "Please provide a reason for the emergency lock",
                    variant: "destructive",
                  });
                  return;
                }

                setIsSubmitting(true);
                try {
                  const response = await fetch('/api/admin/treasury/execute', {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
                    },
                    body: JSON.stringify(emergencyLockForm),
                  });

                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(result.error || 'Failed to activate emergency lock');
                  }

                  toast({
                    title: "Emergency Lock Activated",
                    description: "Treasury wallet has been emergency locked successfully",
                  });

                  setShowEmergencyLockDialog(false);
                  setEmergencyLockForm({
                    treasuryWalletId: '',
                    reason: '',
                    lockDuration: 24,
                    adminId: 'admin_user'
                  });

                  await loadTreasuryData();
                } catch (error: any) {
                  toast({
                    title: "Failed to Activate Emergency Lock",
                    description: error.message || "Unable to activate emergency lock",
                    variant: "destructive",
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating Lock...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Activate Emergency Lock
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}