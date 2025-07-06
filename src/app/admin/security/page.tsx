'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Lock,
  Users,
  Activity,
  FileText,
  Settings,
  RefreshCw,
  Download,
  Search,
  Filter,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Globe,
  UserX,
  Ban
} from 'lucide-react';

interface SecurityDashboardData {
  overview: {
    securityScore: number;
    securityMetrics: any;
    securitySummary: any;
    complianceSummary: any;
  };
  events: {
    recent: any[];
    total: number;
  };
  violations: {
    recent: any[];
    total: number;
  };
  incidents: {
    recent: any[];
    total: number;
  };
  threats: {
    intelligence: any[];
  };
  timeframe: string;
  lastUpdated: string;
}

export default function AdminSecurityPage() {
  const [securityData, setSecurityData] = useState<SecurityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeframe, setTimeframe] = useState('24h');
  const { toast } = useToast();

  useEffect(() => {
    loadSecurityData();
  }, [timeframe]);

  const loadSecurityData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        timeframe,
        details: 'true'
      });

      const response = await fetch(`/api/admin/security/monitoring?${params}`, {
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch security data');
      }

      const result = await response.json();
      if (result.success) {
        setSecurityData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load security data');
      }
    } catch (error: any) {
      console.error('Error loading security data:', error);
      toast({
        title: "Failed to Load Security Data",
        description: error.message || "Unable to load security monitoring data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSecurityData(true);
  };

  const handleResolveEvent = async (eventId: string) => {
    try {
      const response = await fetch('/api/admin/security/monitoring', {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resolve_event',
          eventId,
          resolution: { resolvedBy: 'admin' }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve event');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: "Event Resolved",
          description: "Security event has been resolved successfully",
        });
        await loadSecurityData(true);
      } else {
        throw new Error(result.error || 'Failed to resolve event');
      }
    } catch (error: any) {
      console.error('Error resolving event:', error);
      toast({
        title: "Failed to Resolve Event",
        description: error.message || "Unable to resolve security event",
        variant: "destructive",
      });
    }
  };

  const handleBlockIP = async (ipAddress: string, reason: string) => {
    try {
      const response = await fetch('/api/admin/security/monitoring', {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'block_ip',
          ipAddress,
          reason,
          duration: '24h'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to block IP');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: "IP Blocked",
          description: `IP address ${ipAddress} has been blocked successfully`,
        });
        await loadSecurityData(true);
      } else {
        throw new Error(result.error || 'Failed to block IP');
      }
    } catch (error: any) {
      console.error('Error blocking IP:', error);
      toast({
        title: "Failed to Block IP",
        description: error.message || "Unable to block IP address",
        variant: "destructive",
      });
    }
  };

  const getSecurityScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'LOGIN_ATTEMPT':
      case 'FAILED_LOGIN':
        return <Users className="h-4 w-4" />;
      case 'SUSPICIOUS_ACTIVITY':
      case 'UNAUTHORIZED_ACCESS':
        return <AlertTriangle className="h-4 w-4" />;
      case 'DATA_ACCESS':
        return <Eye className="h-4 w-4" />;
      case 'SYSTEM_BREACH':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading security dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!securityData) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to Load Security Data</AlertTitle>
          <AlertDescription>
            There was an error loading security monitoring data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { overview, events, violations, incidents, threats } = securityData;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security & Compliance</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive security monitoring and compliance management
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </Button>
        </div>
      </div>

      {/* Security Score and Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Security Score</p>
                <p className={`text-3xl font-bold mt-1 ${getSecurityScoreColor(overview.securityScore)}`}>
                  {overview.securityScore}
                </p>
                <Progress value={overview.securityScore} className="mt-2" />
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Security Events</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {overview.securitySummary?.total_events || 0}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-red-600">
                    {overview.securitySummary?.critical_events || 0} critical
                  </span>
                </div>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Violations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {overview.complianceSummary?.total_violations || 0}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-orange-600">
                    {overview.complianceSummary?.open_violations || 0} open
                  </span>
                </div>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Threats</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {threats.intelligence?.length || 0}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-gray-600">
                    Threat indicators
                  </span>
                </div>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Globe className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Security Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Security Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Recent Security Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {events.recent.slice(0, 5).map((event, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getEventTypeIcon(event.event_type)}
                      <div>
                        <p className="font-medium">{event.event_type.replace('_', ' ')}</p>
                        <p className="text-sm text-gray-600">
                          {event.ip_address} • {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                      {!event.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveEvent(event.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Threat Intelligence */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="h-5 w-5" />
                  <span>Threat Intelligence</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {threats.intelligence.map((threat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{threat.threat_type.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-600">
                        {threat.count} indicators • {threat.avg_confidence.toFixed(1)}% confidence
                      </p>
                    </div>
                    <Badge variant="outline">
                      {threat.count}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Security Events</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.recent.map((event, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getEventTypeIcon(event.event_type)}
                      <div>
                        <h4 className="font-medium">{event.event_type.replace('_', ' ')}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>IP: {event.ip_address}</span>
                          {event.user_id && <span>User: {event.user_id}</span>}
                          <span>{new Date(event.created_at).toLocaleString()}</span>
                        </div>
                        {event.details && Object.keys(event.details).length > 0 && (
                          <p className="text-sm text-gray-500 mt-1">
                            {JSON.stringify(event.details)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                      {event.resolved ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolved
                        </Badge>
                      ) : (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveEvent(event.id)}
                          >
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBlockIP(event.ip_address, 'Suspicious activity')}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Block IP
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Compliance Violations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {violations.recent.map((violation, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{violation.rule_name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>Type: {violation.violation_type}</span>
                        <span>Entity: {violation.entity_type}</span>
                        <span>{new Date(violation.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className={getSeverityColor(violation.severity)}>
                        {violation.severity}
                      </Badge>
                      <Badge variant="outline">
                        {violation.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <XCircle className="h-5 w-5" />
                <span>Security Incidents</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {incidents.recent.map((incident, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{incident.title}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>Type: {incident.incident_type}</span>
                        <span>Discovered: {new Date(incident.discovered_at).toLocaleString()}</span>
                        {incident.resolved_at && (
                          <span>Resolved: {new Date(incident.resolved_at).toLocaleString()}</span>
                        )}
                      </div>
                      {incident.affected_systems && incident.affected_systems.length > 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          Affected: {incident.affected_systems.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className={getSeverityColor(incident.severity)}>
                        {incident.severity}
                      </Badge>
                      <Badge variant="outline">
                        {incident.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Audit Trail</span>
              </CardTitle>
              <CardDescription>
                Comprehensive audit trail of all system activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Audit Trail</h3>
                <p className="text-gray-600 mb-4">
                  Detailed audit trail functionality will be displayed here
                </p>
                <Button variant="outline">
                  View Full Audit Trail
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(securityData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
}
