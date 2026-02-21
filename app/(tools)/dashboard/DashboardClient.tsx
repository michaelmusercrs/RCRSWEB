'use client';

/**
 * Lead Management Dashboard
 * Comprehensive business intelligence for lead tracking and conversion optimization
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Phone,
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Target,
  Zap,
  BarChart3,
} from 'lucide-react';
import type { DashboardMetrics, Lead } from '@/lib/dashboard-metrics';

interface DashboardData {
  metrics: DashboardMetrics;
  bySource: Record<string, number>;
  byInspector: Array<{
    inspector: string;
    leadsAssigned: number;
    projectsWon: number;
    conversionRate: number;
    revenue: number;
  }>;
  timeSeries: Array<{
    date: string;
    leads: number;
    conversions: number;
    revenue: number;
  }>;
  urgentActions: string[];
  recentLeads: Lead[];
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // days

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  async function fetchDashboardData() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/dashboard/leads?view=overview&days=${selectedPeriod}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError('Failed to connect to dashboard API');
      console.error('Dashboard error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-green border-t-transparent mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <Card className="border-red-900 bg-neutral-950 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Dashboard Error</h2>
            <p className="text-neutral-400 mb-4">{error}</p>
            <Button
              onClick={fetchDashboardData}
              className="bg-brand-green text-black hover:bg-lime-300"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { metrics, urgentActions, recentLeads, bySource, byInspector } = data;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-wider mb-2">
              Lead Dashboard
            </h1>
            <p className="text-neutral-400">
              Business intelligence and lead management
            </p>
          </div>
          <div className="flex gap-2">
            {['7', '30', '90'].map((days) => (
              <Button
                key={days}
                variant={selectedPeriod === days ? 'default' : 'outline'}
                className={
                  selectedPeriod === days
                    ? 'bg-brand-green text-black hover:bg-lime-300'
                    : 'border-neutral-700 text-neutral-300 hover:bg-neutral-900'
                }
                onClick={() => setSelectedPeriod(days)}
              >
                {days} Days
              </Button>
            ))}
          </div>
        </div>

        {/* Urgent Actions */}
        {urgentActions.length > 0 && (
          <Card className="border-red-900 bg-gradient-to-r from-red-950/50 to-neutral-950">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-400 mb-3">
                    🚨 URGENT ACTIONS REQUIRED
                  </h3>
                  <ul className="space-y-2">
                    {urgentActions.map((action, idx) => (
                      <li key={idx} className="text-white text-sm">
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Leads */}
          <MetricCard
            title="Total Leads"
            value={metrics.totalLeads.toString()}
            subtitle={`${metrics.newLeads} new • ${metrics.contactedLeads} contacted`}
            icon={Users}
            trend={
              metrics.monthOverMonthGrowth !== 0
                ? {
                    value: metrics.monthOverMonthGrowth,
                    isPositive: metrics.monthOverMonthGrowth > 0,
                  }
                : undefined
            }
            color="lime"
          />

          {/* Conversion Rate */}
          <MetricCard
            title="Conversion Rate"
            value={`${metrics.overallConversionRate}%`}
            subtitle={`${metrics.projectsWon} won • ${metrics.projectsLost} lost`}
            icon={Target}
            color="blue"
          />

          {/* Total Revenue */}
          <MetricCard
            title="Total Revenue"
            value={`$${(metrics.totalRevenue / 1000).toFixed(1)}K`}
            subtitle={`$${metrics.revenuePerLead.toLocaleString()} per lead`}
            icon={DollarSign}
            color="green"
          />

          {/* Response Time */}
          <MetricCard
            title="Avg Response Time"
            value={`${metrics.averageResponseTime}h`}
            subtitle={`${metrics.leadsContactedWithin1HourPercent}% within 1 hour`}
            icon={Clock}
            color={metrics.averageResponseTime <= 1 ? 'green' : 'orange'}
          />
        </div>

        {/* Lead Quality Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-neutral-800 bg-gradient-to-br from-red-950/20 to-neutral-950">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Hot Leads</p>
                  <p className="text-3xl font-black">{metrics.hotLeadsCount}</p>
                </div>
                <Zap className="h-8 w-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Score 80+</span>
                  <span className="text-red-400 font-bold">
                    {metrics.hotLeadsPercent}%
                  </span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-red-600 to-red-400 h-2 rounded-full"
                    style={{ width: `${metrics.hotLeadsPercent}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-800 bg-gradient-to-br from-orange-950/20 to-neutral-950">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Warm Leads</p>
                  <p className="text-3xl font-black">{metrics.warmLeadsCount}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Score 60-79</span>
                  <span className="text-orange-400 font-bold">
                    {Math.round((metrics.warmLeadsCount / metrics.totalLeads) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-orange-600 to-orange-400 h-2 rounded-full"
                    style={{
                      width: `${(metrics.warmLeadsCount / metrics.totalLeads) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-800 bg-gradient-to-br from-blue-950/20 to-neutral-950">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Cold Leads</p>
                  <p className="text-3xl font-black">{metrics.coldLeadsCount}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Score &lt;60</span>
                  <span className="text-blue-400 font-bold">
                    {Math.round((metrics.coldLeadsCount / metrics.totalLeads) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-blue-400 h-2 rounded-full"
                    style={{
                      width: `${(metrics.coldLeadsCount / metrics.totalLeads) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Funnel */}
        <Card className="border-neutral-800 bg-neutral-950">
          <CardHeader>
            <CardTitle className="text-xl font-black uppercase tracking-wider">
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <FunnelStage
                label="New Leads"
                count={metrics.totalLeads}
                percent={100}
                color="lime"
              />
              <FunnelStage
                label="Contacted"
                count={metrics.contactedLeads}
                percent={(metrics.contactedLeads / metrics.totalLeads) * 100}
                color="blue"
              />
              <FunnelStage
                label="Scheduled"
                count={metrics.scheduledInspections}
                percent={(metrics.scheduledInspections / metrics.totalLeads) * 100}
                color="purple"
              />
              <FunnelStage
                label="Quoted"
                count={metrics.quotesProvided}
                percent={(metrics.quotesProvided / metrics.totalLeads) * 100}
                color="orange"
              />
              <FunnelStage
                label="Won"
                count={metrics.projectsWon}
                percent={(metrics.projectsWon / metrics.totalLeads) * 100}
                color="green"
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card className="border-neutral-800 bg-neutral-950">
          <CardHeader>
            <CardTitle className="text-xl font-black uppercase tracking-wider">
              Recent Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800 text-left">
                    <th className="pb-3 text-sm font-bold text-neutral-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="pb-3 text-sm font-bold text-neutral-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="pb-3 text-sm font-bold text-neutral-400 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="pb-3 text-sm font-bold text-neutral-400 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="pb-3 text-sm font-bold text-neutral-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="pb-3 text-sm font-bold text-neutral-400 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-neutral-900 transition-colors">
                      <td className="py-4">
                        <div>
                          <p className="font-bold">{lead.name}</p>
                          <p className="text-sm text-neutral-400">{lead.email}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm">
                          {lead.phone ? (
                            <a
                              href={`tel:${lead.phone}`}
                              className="text-brand-green hover:text-lime-300 flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </a>
                          ) : (
                            <span className="text-neutral-500">No phone</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="text-sm">{lead.subject}</p>
                      </td>
                      <td className="py-4">
                        <PriorityBadge priority={lead.priority} score={lead.score} />
                      </td>
                      <td className="py-4">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="py-4 text-sm text-neutral-400">
                        {getTimeAgo(new Date(lead.timestamp))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Inspector Performance */}
        {byInspector.length > 0 && (
          <Card className="border-neutral-800 bg-neutral-950">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase tracking-wider">
                Inspector Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {byInspector
                  .sort((a, b) => b.conversionRate - a.conversionRate)
                  .map((inspector) => (
                    <div
                      key={inspector.inspector}
                      className="flex items-center justify-between p-4 bg-neutral-900 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-bold mb-1">{inspector.inspector}</p>
                        <div className="flex gap-4 text-sm text-neutral-400">
                          <span>{inspector.leadsAssigned} leads</span>
                          <span>{inspector.projectsWon} won</span>
                          <span>${(inspector.revenue / 1000).toFixed(1)}K revenue</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-brand-green">
                          {inspector.conversionRate}%
                        </p>
                        <p className="text-xs text-neutral-500 uppercase">Conversion</p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Helper Components

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  trend?: { value: number; isPositive: boolean };
  color?: 'lime' | 'blue' | 'green' | 'orange' | 'red';
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'lime',
}: MetricCardProps) {
  const colorClasses = {
    lime: 'text-brand-green',
    blue: 'text-blue-400',
    green: 'text-brand-green',
    orange: 'text-orange-400',
    red: 'text-red-400',
  };

  return (
    <Card className="border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-colors">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-neutral-400 mb-1 uppercase tracking-widest">
              {title}
            </p>
            <p className="text-3xl font-black">{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${colorClasses[color]}`} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">{subtitle}</p>
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs font-bold ${
                trend.isPositive ? 'text-brand-green' : 'text-red-400'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface FunnelStageProps {
  label: string;
  count: number;
  percent: number;
  color: string;
}

function FunnelStage({ label, count, percent, color }: FunnelStageProps) {
  const colorClasses: Record<string, string> = {
    lime: 'bg-brand-green',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    green: 'bg-brand-green',
  };

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-sm text-neutral-400">
          {count} ({Math.round(percent)}%)
        </span>
      </div>
      <div className="w-full bg-neutral-800 rounded-full h-3">
        <div
          className={`${colorClasses[color]} h-3 rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority, score }: { priority: string; score: number }) {
  const styles = {
    hot: 'bg-red-950 text-red-400 border-red-800',
    warm: 'bg-orange-950 text-orange-400 border-orange-800',
    cold: 'bg-blue-950 text-blue-400 border-blue-800',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
        styles[priority as keyof typeof styles]
      }`}
    >
      <span className="uppercase">{priority}</span>
      <span className="opacity-75">{score}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; icon: any }> = {
    new: {
      bg: 'bg-neutral-800',
      text: 'text-neutral-300',
      icon: AlertCircle,
    },
    contacted: {
      bg: 'bg-blue-950',
      text: 'text-blue-400',
      icon: Phone,
    },
    scheduled: {
      bg: 'bg-purple-950',
      text: 'text-purple-400',
      icon: Calendar,
    },
    quoted: {
      bg: 'bg-orange-950',
      text: 'text-orange-400',
      icon: DollarSign,
    },
    won: {
      bg: 'bg-green-950',
      text: 'text-brand-green',
      icon: CheckCircle2,
    },
    lost: {
      bg: 'bg-red-950',
      text: 'text-red-400',
      icon: XCircle,
    },
  };

  const style = styles[status] || styles.new;
  const Icon = style.icon;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}
    >
      <Icon className="h-3 w-3" />
      <span className="uppercase">{status}</span>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}
