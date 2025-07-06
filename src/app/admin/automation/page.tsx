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
import { Progress } from '@/components/ui/progress';
import { 
  Bot, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Play,
  Pause,
  Square,
  RefreshCw,
  Settings,
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Zap,
  AlertCircle,
  Eye,
  BarChart3,
  Loader2,
  Power,
  PowerOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AutomationMetrics {
  totalProcessed: number;
  successfulPayouts: number;
  failedPayouts: number;
  averageProcessingTime: number;
  totalVolume: number;
  automationRate: number;
  errorRate: number;
  costSavings: number;
  lastUpdated: string;
}

interface SystemStatus {
  isOperational: boolean;
  healthScore: number;
  emergencyHalt: boolean;
  schedulerRunning: boolean;
  lastProcessingRun: string;
  uptime: string;
  version: string;
}

interface QueueStatus {
  queueId: string;
  status: string;
  requestCount: number;
  priority: number;
}

interface AutomatedPayoutRequest {
  id: string;
  merchantId: string;
  merchantEmail: string;
  amount: number;
  currency: string;
  destinationWallet: string;
  destinationNetwork: string;
  scheduleType: string;
  priority: string;
  status: string;
  riskScore: number;
  automationDecision: string;
  processingAttempts: number;
  createdAt: string;
  executedAt?: string;
  failureReason?: string;
  merchantRiskScore?: number;
  automationLevel?: string;
}

interface RiskScore {
  merchantId: string;
  merchantEmail: string;
  overallScore: number;
  factors: {
    transactionHistory: number;
    chargebackRate: number;
    accountAge: number;
    verificationLevel: number;
    recentActivity: number;
  };
  automationLevel: string;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  lastUpdated: string;
  merchantStats?: {
    accountAge: number;
    totalOrders: number;
    totalRevenue: number;
    recentOrders: number;
  };
}

export default function AdminAutomationPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data states
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<AutomatedPayoutRequest[]>([]);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);

  // Dialog states
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [showCreatePayoutDialog, setShowCreatePayoutDialog] = useState(false);
  const [showRiskUpdateDialog, setShowRiskUpdateDialog] = useState(false);

  // Form states
  const [emergencyForm, setEmergencyForm] = useState({
    action: 'HALT' as 'HALT' | 'RESUME',
    reason: '',
    authorizedBy: 'admin_user',
    duration: 24
  });

  const [createPayoutForm, setCreatePayoutForm] = useState({
    merchantId: '',
    amount: '',
    currency: 'TAIC',
    destinationWallet: '',
    destinationNetwork: 'FANTOM',
    scheduleType: 'REAL_TIME',
    priority: 'NORMAL'
  });

  const [riskUpdateForm, setRiskUpdateForm] = useState({
    merchantId: '',
    overallScore: '',
    automationLevel: 'PARTIAL',
    dailyLimit: '',
    weeklyLimit: '',
    monthlyLimit: ''
  });

  // Load automation data
  const loadAutomationData = async () => {
    try {
      setIsLoading(true);

      // Load system status and metrics
      const statusResponse = await fetch('/api/admin/automation/control', {
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setSystemStatus(statusData.systemStatus);
        setMetrics(statusData.metrics);
        setQueueStatus(statusData.queueStatus || []);
      }

      // Load payout requests
      const payoutsResponse = await fetch('/api/admin/automation/payouts?limit=20&includeMetrics=true', {
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
      });

      if (payoutsResponse.ok) {
        const payoutsData = await payoutsResponse.json();
        setPayoutRequests(payoutsData.requests || []);
        if (payoutsData.metrics && !metrics) {
          setMetrics(payoutsData.metrics);
        }
      }

      // Load risk scores
      const riskResponse = await fetch('/api/admin/automation/risk?limit=10', {
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
      });

      if (riskResponse.ok) {
        const riskData = await riskResponse.json();
        setRiskScores(riskData.riskScores || []);
      }

    } catch (error: any) {
      console.error('Error loading automation data:', error);
      toast({
        title: "Error Loading Automation Data",
        description: error.message || "Failed to load automation information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Emergency control
  const handleEmergencyControl = async () => {
    if (!emergencyForm.reason.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a reason for the emergency action",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/automation/control?type=emergency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
        body: JSON.stringify(emergencyForm),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to execute emergency control');
      }

      toast({
        title: "Emergency Control Executed",
        description: `${emergencyForm.action === 'HALT' ? 'Emergency halt activated' : 'Processing resumed'} successfully`,
      });

      setShowEmergencyDialog(false);
      setEmergencyForm({
        action: 'HALT',
        reason: '',
        authorizedBy: 'admin_user',
        duration: 24
      });

      await loadAutomationData();
    } catch (error: any) {
      toast({
        title: "Failed to Execute Emergency Control",
        description: error.message || "Unable to execute emergency control",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create automated payout
  const handleCreatePayout = async () => {
    if (!createPayoutForm.merchantId || !createPayoutForm.amount || !createPayoutForm.destinationWallet) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/automation/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
        body: JSON.stringify({
          ...createPayoutForm,
          amount: parseFloat(createPayoutForm.amount)
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create automated payout');
      }

      toast({
        title: "Automated Payout Created",
        description: "Automated payout request has been created successfully",
      });

      setShowCreatePayoutDialog(false);
      setCreatePayoutForm({
        merchantId: '',
        amount: '',
        currency: 'TAIC',
        destinationWallet: '',
        destinationNetwork: 'FANTOM',
        scheduleType: 'REAL_TIME',
        priority: 'NORMAL'
      });

      await loadAutomationData();
    } catch (error: any) {
      toast({
        title: "Failed to Create Payout",
        description: error.message || "Unable to create automated payout",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadAutomationData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadAutomationData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Helper functions
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'PROCESSING':
        return <Badge className="bg-blue-100 text-blue-800"><Activity className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'EXECUTED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Executed</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAutomationDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'AUTO_APPROVE':
        return <Badge className="bg-green-100 text-green-800"><Bot className="w-3 h-3 mr-1" />Auto Approved</Badge>;
      case 'MANUAL_REVIEW':
        return <Badge className="bg-orange-100 text-orange-800"><Users className="w-3 h-3 mr-1" />Manual Review</Badge>;
      case 'AUTO_REJECT':
        return <Badge className="bg-red-100 text-red-800"><Shield className="w-3 h-3 mr-1" />Auto Rejected</Badge>;
      default:
        return <Badge variant="outline">{decision}</Badge>;
    }
  };

  const getAutomationLevelBadge = (level: string) => {
    switch (level) {
      case 'FULL':
        return <Badge className="bg-green-100 text-green-800"><Zap className="w-3 h-3 mr-1" />Full Automation</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-yellow-100 text-yellow-800"><Settings className="w-3 h-3 mr-1" />Partial Automation</Badge>;
      case 'MANUAL_REVIEW':
        return <Badge className="bg-red-100 text-red-800"><Users className="w-3 h-3 mr-1" />Manual Review</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case 'NORMAL':
        return <Badge className="bg-blue-100 text-blue-800">Normal</Badge>;
      case 'LOW':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
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

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading automation system...</span>
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
            <Bot className="mr-3 h-8 w-8 text-primary" />
            Automated Payout Processing
          </h1>
          <p className="text-muted-foreground">Intelligent automation system with risk-based processing and multi-signature integration</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadAutomationData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowEmergencyDialog(true)}
            className={systemStatus?.emergencyHalt ? 'border-red-500 text-red-600' : ''}
          >
            {systemStatus?.emergencyHalt ? (
              <>
                <Power className="h-4 w-4 mr-2" />
                Resume
              </>
            ) : (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Emergency
              </>
            )}
          </Button>
          <Button onClick={() => setShowCreatePayoutDialog(true)}>
            <Bot className="h-4 w-4 mr-2" />
            Create Automated Payout
          </Button>
        </div>
      </div>

      {/* System Status Cards */}
      {systemStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              {systemStatus.isOperational ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemStatus.isOperational ? 'Operational' : 'Issues Detected'}
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Progress value={systemStatus.healthScore} className="flex-1" />
                <span className="text-sm text-muted-foreground">{systemStatus.healthScore}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing Status</CardTitle>
              {systemStatus.schedulerRunning ? (
                <Play className="h-4 w-4 text-green-600" />
              ) : (
                <Pause className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemStatus.schedulerRunning ? 'Running' : 'Stopped'}
              </div>
              <p className="text-xs text-muted-foreground">
                {systemStatus.emergencyHalt ? 'Emergency halt active' : `Uptime: ${systemStatus.uptime}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing Queues</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{queueStatus.length}</div>
              <p className="text-xs text-muted-foreground">
                {queueStatus.filter(q => q.status === 'PROCESSING').length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Version</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemStatus.version}</div>
              <p className="text-xs text-muted-foreground">
                Last run: {formatDate(systemStatus.lastProcessingRun)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalProcessed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.successfulPayouts} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Automation Rate</CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.automationRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Error rate: {metrics.errorRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalVolume.toLocaleString()} TAIC</div>
              <p className="text-xs text-muted-foreground">
                Avg time: {(metrics.averageProcessingTime / 60).toFixed(1)}m
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${metrics.costSavings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Through automation
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payouts">Automated Payouts</TabsTrigger>
          <TabsTrigger value="risk">Risk Management</TabsTrigger>
          <TabsTrigger value="controls">System Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Automated Payouts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="mr-2 h-5 w-5" />
                  Recent Automated Payouts
                </CardTitle>
                <CardDescription>Latest automated payout processing activity</CardDescription>
              </CardHeader>
              <CardContent>
                {payoutRequests.slice(0, 5).length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No recent automated payouts
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payoutRequests.slice(0, 5).map((payout) => (
                      <div key={payout.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{payout.amount} {payout.currency}</span>
                            {getStatusBadge(payout.status)}
                            {getAutomationDecisionBadge(payout.automationDecision)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payout.merchantEmail} • {formatDate(payout.createdAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">Risk: {payout.riskScore}</div>
                          <div className="text-xs text-muted-foreground">{payout.scheduleType}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Processing Queues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="mr-2 h-5 w-5" />
                  Processing Queues
                </CardTitle>
                <CardDescription>Current automation processing queues</CardDescription>
              </CardHeader>
              <CardContent>
                {queueStatus.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No active processing queues
                  </div>
                ) : (
                  <div className="space-y-3">
                    {queueStatus.map((queue) => (
                      <div key={queue.queueId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{queue.queueId}</span>
                            {getStatusBadge(queue.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {queue.requestCount} requests
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">Priority: {queue.priority}</div>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Automated Payout Requests</h3>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreatePayoutDialog(true)}>
                <Bot className="h-4 w-4 mr-2" />
                Create Automated Payout
              </Button>
            </div>
          </div>

          {payoutRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Automated Payouts</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first automated payout to start intelligent processing
                </p>
                <Button onClick={() => setShowCreatePayoutDialog(true)}>
                  <Bot className="h-4 w-4 mr-2" />
                  Create Automated Payout
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {payoutRequests.map((payout) => (
                <Card key={payout.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <span>{payout.amount} {payout.currency}</span>
                          {getStatusBadge(payout.status)}
                        </CardTitle>
                        <CardDescription>
                          {payout.merchantEmail} • {payout.destinationNetwork} • Created {formatDate(payout.createdAt)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getAutomationDecisionBadge(payout.automationDecision)}
                        {getPriorityBadge(payout.priority)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Destination Wallet</Label>
                        <div className="font-mono text-sm">{formatAddress(payout.destinationWallet)}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Risk Score</Label>
                        <div className="text-sm">
                          <span className={`font-medium ${payout.riskScore > 70 ? 'text-red-600' : payout.riskScore > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {payout.riskScore}/100
                          </span>
                          {payout.merchantRiskScore && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Merchant: {payout.merchantRiskScore})
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Processing Attempts</Label>
                        <div className="text-sm">{payout.processingAttempts}/3</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Schedule Type</Label>
                        <div className="text-sm">{payout.scheduleType}</div>
                      </div>
                    </div>

                    {payout.failureReason && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <Label className="text-xs text-red-600">Failure Reason</Label>
                        <p className="text-sm text-red-800">{payout.failureReason}</p>
                      </div>
                    )}

                    <div className="mt-4 flex justify-between items-center">
                      <div className="flex space-x-2">
                        {payout.automationLevel && getAutomationLevelBadge(payout.automationLevel)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payout.executedAt ? `Executed: ${formatDate(payout.executedAt)}` : `Created: ${formatDate(payout.createdAt)}`}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Merchant Risk Management</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/automation/risk?action=recalculate', {
                      method: 'POST',
                      headers: {
                        'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
                      },
                    });

                    if (response.ok) {
                      toast({
                        title: "Risk Scores Recalculated",
                        description: "All merchant risk scores have been recalculated",
                      });
                      await loadAutomationData();
                    }
                  } catch (error) {
                    toast({
                      title: "Recalculation Failed",
                      description: "Failed to recalculate risk scores",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalculate All
              </Button>
              <Button onClick={() => setShowRiskUpdateDialog(true)}>
                <Shield className="h-4 w-4 mr-2" />
                Update Risk Score
              </Button>
            </div>
          </div>

          {riskScores.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Risk Scores</h3>
                <p className="text-muted-foreground mb-4">
                  Risk scores will be calculated automatically as merchants use the platform
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {riskScores.map((risk) => (
                <Card key={risk.merchantId}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <span>{risk.merchantEmail}</span>
                          {getAutomationLevelBadge(risk.automationLevel)}
                        </CardTitle>
                        <CardDescription>
                          Last updated: {formatDate(risk.lastUpdated)}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          <span className={`${risk.overallScore > 70 ? 'text-red-600' : risk.overallScore > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {risk.overallScore}
                          </span>
                          <span className="text-sm text-muted-foreground">/100</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Risk Score</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Transaction History</Label>
                        <div className="text-sm font-medium">{risk.factors.transactionHistory}/25</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Chargeback Rate</Label>
                        <div className="text-sm font-medium">{risk.factors.chargebackRate}/25</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Account Age</Label>
                        <div className="text-sm font-medium">{risk.factors.accountAge}/15</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Verification</Label>
                        <div className="text-sm font-medium">{risk.factors.verificationLevel}/15</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Recent Activity</Label>
                        <div className="text-sm font-medium">{risk.factors.recentActivity}/20</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Daily Limit</Label>
                        <div className="text-sm font-medium">{risk.dailyLimit.toLocaleString()} TAIC</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Weekly Limit</Label>
                        <div className="text-sm font-medium">{risk.weeklyLimit.toLocaleString()} TAIC</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Monthly Limit</Label>
                        <div className="text-sm font-medium">{risk.monthlyLimit.toLocaleString()} TAIC</div>
                      </div>
                    </div>

                    {risk.merchantStats && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-muted rounded-lg">
                        <div>
                          <Label className="text-xs text-muted-foreground">Account Age</Label>
                          <div className="text-sm">{risk.merchantStats.accountAge} days</div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Total Orders</Label>
                          <div className="text-sm">{risk.merchantStats.totalOrders}</div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Total Revenue</Label>
                          <div className="text-sm">{risk.merchantStats.totalRevenue.toLocaleString()} TAIC</div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Recent Orders</Label>
                          <div className="text-sm">{risk.merchantStats.recentOrders}</div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex justify-between items-center">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRiskUpdateForm(prev => ({
                              ...prev,
                              merchantId: risk.merchantId,
                              overallScore: risk.overallScore.toString(),
                              automationLevel: risk.automationLevel,
                              dailyLimit: risk.dailyLimit.toString(),
                              weeklyLimit: risk.weeklyLimit.toString(),
                              monthlyLimit: risk.monthlyLimit.toString()
                            }));
                            setShowRiskUpdateDialog(true);
                          }}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Update
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Emergency Controls
                </CardTitle>
                <CardDescription>System-wide emergency controls and safety measures</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      {systemStatus?.emergencyHalt ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      <span className="text-sm">Emergency Halt Status</span>
                    </div>
                    <Badge className={systemStatus?.emergencyHalt ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                      {systemStatus?.emergencyHalt ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      {systemStatus?.schedulerRunning ? (
                        <Play className="h-4 w-4 text-green-600" />
                      ) : (
                        <Pause className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm">Processing Scheduler</span>
                    </div>
                    <Badge className={systemStatus?.schedulerRunning ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {systemStatus?.schedulerRunning ? 'RUNNING' : 'STOPPED'}
                    </Badge>
                  </div>

                  <Button
                    onClick={() => setShowEmergencyDialog(true)}
                    variant={systemStatus?.emergencyHalt ? "default" : "destructive"}
                    className="w-full"
                  >
                    {systemStatus?.emergencyHalt ? (
                      <>
                        <Power className="h-4 w-4 mr-2" />
                        Resume Processing
                      </>
                    ) : (
                      <>
                        <PowerOff className="h-4 w-4 mr-2" />
                        Emergency Halt
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  System Configuration
                </CardTitle>
                <CardDescription>Automation system settings and parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Processing Configuration</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Max Batch Size</span>
                        <span className="text-sm font-mono">50</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Optimal Batch Size</span>
                        <span className="text-sm font-mono">20</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Processing Interval</span>
                        <span className="text-sm font-mono">60s</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Max Retries</span>
                        <span className="text-sm font-mono">3</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Risk Thresholds</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Auto Approve</span>
                        <span className="text-sm">≤ 30</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Manual Review</span>
                        <span className="text-sm">31-70</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Auto Reject</span>
                        <span className="text-sm">≥ 71</span>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Update Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Emergency Control Dialog */}
      <Dialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Emergency System Control
            </DialogTitle>
            <DialogDescription>
              {emergencyForm.action === 'HALT'
                ? 'Immediately halt all automated processing. This will stop all automation and require manual intervention.'
                : 'Resume automated processing after emergency halt. Ensure all issues have been resolved.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Select
                value={emergencyForm.action}
                onValueChange={(value: 'HALT' | 'RESUME') => setEmergencyForm(prev => ({ ...prev, action: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HALT">Emergency Halt</SelectItem>
                  <SelectItem value="RESUME">Resume Processing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={emergencyForm.reason}
                onChange={(e) => setEmergencyForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Describe the reason for this emergency action..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="authorizedBy">Authorized By</Label>
              <Input
                id="authorizedBy"
                value={emergencyForm.authorizedBy}
                onChange={(e) => setEmergencyForm(prev => ({ ...prev, authorizedBy: e.target.value }))}
                placeholder="admin_user"
              />
            </div>

            {emergencyForm.action === 'HALT' && (
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (Hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="168"
                  value={emergencyForm.duration}
                  onChange={(e) => setEmergencyForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 24 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum 168 hours (1 week). Can be manually resumed earlier.
                </p>
              </div>
            )}

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Warning: Emergency Control</p>
                  <p>
                    {emergencyForm.action === 'HALT'
                      ? 'This will immediately stop all automated processing and may affect merchant payouts.'
                      : 'Ensure all security issues have been resolved before resuming processing.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmergencyDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={emergencyForm.action === 'HALT' ? "destructive" : "default"}
              onClick={handleEmergencyControl}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {emergencyForm.action === 'HALT' ? (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Emergency Halt
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Resume Processing
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Automated Payout Dialog */}
      <Dialog open={showCreatePayoutDialog} onOpenChange={setShowCreatePayoutDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Bot className="mr-2 h-5 w-5" />
              Create Automated Payout
            </DialogTitle>
            <DialogDescription>
              Create a new automated payout request with intelligent risk assessment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="merchantId">Merchant ID</Label>
              <Input
                id="merchantId"
                value={createPayoutForm.merchantId}
                onChange={(e) => setCreatePayoutForm(prev => ({ ...prev, merchantId: e.target.value }))}
                placeholder="merchant-uuid"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={createPayoutForm.amount}
                  onChange={(e) => setCreatePayoutForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={createPayoutForm.currency}
                  onValueChange={(value) => setCreatePayoutForm(prev => ({ ...prev, currency: value }))}
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
              <Label htmlFor="destinationWallet">Destination Wallet</Label>
              <Input
                id="destinationWallet"
                value={createPayoutForm.destinationWallet}
                onChange={(e) => setCreatePayoutForm(prev => ({ ...prev, destinationWallet: e.target.value }))}
                placeholder="0x..."
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="destinationNetwork">Network</Label>
                <Select
                  value={createPayoutForm.destinationNetwork}
                  onValueChange={(value) => setCreatePayoutForm(prev => ({ ...prev, destinationNetwork: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FANTOM">Fantom Opera</SelectItem>
                    <SelectItem value="ETHEREUM">Ethereum</SelectItem>
                    <SelectItem value="POLYGON">Polygon</SelectItem>
                    <SelectItem value="BSC">BNB Smart Chain</SelectItem>
                    <SelectItem value="BITCOIN">Bitcoin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduleType">Schedule Type</Label>
                <Select
                  value={createPayoutForm.scheduleType}
                  onValueChange={(value) => setCreatePayoutForm(prev => ({ ...prev, scheduleType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REAL_TIME">Real Time</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="THRESHOLD_TRIGGERED">Threshold Triggered</SelectItem>
                    <SelectItem value="MANUAL_OVERRIDE">Manual Override</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={createPayoutForm.priority}
                onValueChange={(value) => setCreatePayoutForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreatePayoutDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePayout}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Create Automated Payout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Update Dialog */}
      <Dialog open={showRiskUpdateDialog} onOpenChange={setShowRiskUpdateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Update Merchant Risk Score
            </DialogTitle>
            <DialogDescription>
              Manually adjust merchant risk assessment and automation settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="riskMerchantId">Merchant ID</Label>
              <Input
                id="riskMerchantId"
                value={riskUpdateForm.merchantId}
                onChange={(e) => setRiskUpdateForm(prev => ({ ...prev, merchantId: e.target.value }))}
                placeholder="merchant-uuid"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overallScore">Overall Risk Score</Label>
                <Input
                  id="overallScore"
                  type="number"
                  min="0"
                  max="100"
                  value={riskUpdateForm.overallScore}
                  onChange={(e) => setRiskUpdateForm(prev => ({ ...prev, overallScore: e.target.value }))}
                  placeholder="50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="automationLevel">Automation Level</Label>
                <Select
                  value={riskUpdateForm.automationLevel}
                  onValueChange={(value) => setRiskUpdateForm(prev => ({ ...prev, automationLevel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">Full Automation</SelectItem>
                    <SelectItem value="PARTIAL">Partial Automation</SelectItem>
                    <SelectItem value="MANUAL_REVIEW">Manual Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyLimit">Daily Limit</Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  value={riskUpdateForm.dailyLimit}
                  onChange={(e) => setRiskUpdateForm(prev => ({ ...prev, dailyLimit: e.target.value }))}
                  placeholder="5000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weeklyLimit">Weekly Limit</Label>
                <Input
                  id="weeklyLimit"
                  type="number"
                  value={riskUpdateForm.weeklyLimit}
                  onChange={(e) => setRiskUpdateForm(prev => ({ ...prev, weeklyLimit: e.target.value }))}
                  placeholder="25000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyLimit">Monthly Limit</Label>
                <Input
                  id="monthlyLimit"
                  type="number"
                  value={riskUpdateForm.monthlyLimit}
                  onChange={(e) => setRiskUpdateForm(prev => ({ ...prev, monthlyLimit: e.target.value }))}
                  placeholder="100000"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRiskUpdateDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!riskUpdateForm.merchantId) {
                  toast({
                    title: "Missing Information",
                    description: "Please provide a merchant ID",
                    variant: "destructive",
                  });
                  return;
                }

                setIsSubmitting(true);
                try {
                  const updateData: any = {
                    merchantId: riskUpdateForm.merchantId,
                    automationLevel: riskUpdateForm.automationLevel
                  };

                  if (riskUpdateForm.overallScore) {
                    updateData.overallScore = parseInt(riskUpdateForm.overallScore);
                  }
                  if (riskUpdateForm.dailyLimit) {
                    updateData.dailyLimit = parseFloat(riskUpdateForm.dailyLimit);
                  }
                  if (riskUpdateForm.weeklyLimit) {
                    updateData.weeklyLimit = parseFloat(riskUpdateForm.weeklyLimit);
                  }
                  if (riskUpdateForm.monthlyLimit) {
                    updateData.monthlyLimit = parseFloat(riskUpdateForm.monthlyLimit);
                  }

                  const response = await fetch('/api/admin/automation/risk', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
                    },
                    body: JSON.stringify(updateData),
                  });

                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(result.error || 'Failed to update risk score');
                  }

                  toast({
                    title: "Risk Score Updated",
                    description: "Merchant risk score has been updated successfully",
                  });

                  setShowRiskUpdateDialog(false);
                  setRiskUpdateForm({
                    merchantId: '',
                    overallScore: '',
                    automationLevel: 'PARTIAL',
                    dailyLimit: '',
                    weeklyLimit: '',
                    monthlyLimit: ''
                  });

                  await loadAutomationData();
                } catch (error: any) {
                  toast({
                    title: "Failed to Update Risk Score",
                    description: error.message || "Unable to update risk score",
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
                  Updating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Update Risk Score
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
