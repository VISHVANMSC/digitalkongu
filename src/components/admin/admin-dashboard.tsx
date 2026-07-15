'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  Trophy,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuthStore } from '@/store/authStore';

interface DashboardStats {
  role: string;
  totalPrograms: number;
  totalEvents: number;
  activeEvents: number;
  completedEvents: number;
  totalTeams: number;
  totalParticipants: number;
  totalEvaluations: number;
  submittedEvaluations: number;
  draftEvaluations: number;
  panelMonitor?: Array<{
    id: string;
    name: string;
    eventId: string;
    eventName: string;
    coordinators: string[];
    evaluators: string[];
    totalEntities: number;
    completedEvaluations: number;
    averageScore: number;
  }>;
}

interface ProgramEventCount {
  name: string;
  events: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  }),
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

export function AdminDashboard() {
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ProgramEventCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [dashRes, progRes] = await Promise.all([
          fetch('/api/dashboard', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/programs', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!dashRes.ok || !progRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const dashData = await dashRes.json();
        const progData = await progRes.json();

        if (dashData.success) {
          setStats(dashData.data);
        }

        if (progData.success && Array.isArray(progData.data)) {
          const chartInfo = progData.data.map((p: { name: string; _count: { events: number } }) => ({
            name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
            events: p._count?.events ?? 0,
          }));
          setChartData(chartInfo);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const statCards = stats
    ? [
        {
          label: 'Total Programs',
          value: stats.totalPrograms,
          icon: BarChart3,
          gradient: 'from-emerald-500/10 to-emerald-600/5',
          iconColor: 'text-emerald-600',
        },
        {
          label: 'Total Events',
          value: stats.totalEvents,
          icon: Calendar,
          gradient: 'from-teal-500/10 to-teal-600/5',
          iconColor: 'text-teal-600',
        },
        {
          label: 'Active Events',
          value: stats.activeEvents,
          icon: TrendingUp,
          gradient: 'from-green-500/10 to-green-600/5',
          iconColor: 'text-green-600',
        },
        {
          label: 'Total Teams',
          value: stats.totalTeams,
          icon: Users,
          gradient: 'from-amber-500/10 to-amber-600/5',
          iconColor: 'text-amber-600',
        },
        {
          label: 'Total Participants',
          value: stats.totalParticipants,
          icon: Trophy,
          gradient: 'from-rose-500/10 to-rose-600/5',
          iconColor: 'text-rose-600',
        },
        {
          label: 'Evaluations Completed',
          value: stats.submittedEvaluations,
          icon: CheckCircle2,
          gradient: 'from-emerald-500/10 to-emerald-600/5',
          iconColor: 'text-emerald-600',
        },
        {
          label: 'Evaluations Pending',
          value: stats.draftEvaluations,
          icon: Clock,
          gradient: 'from-orange-500/10 to-orange-600/5',
          iconColor: 'text-orange-600',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {statCards.map((card, i) => (
          <motion.div key={card.label} custom={i} variants={cardVariants}>
            <Card className={`overflow-hidden bg-gradient-to-br ${card.gradient} border-0 shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-white/80 shadow-sm ${card.iconColor}`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold">Events per Program</h3>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  />
                  <Bar
                    dataKey="events"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No program data available
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {stats?.panelMonitor && stats.panelMonitor.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <ClipboardList className="h-5 w-5 text-emerald-600 animate-pulse" />
                <h3 className="text-lg font-semibold text-foreground">Real-Time Panel Progress Monitor</h3>
              </div>
              <div className="border rounded-lg overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-3 text-xs font-semibold text-muted-foreground uppercase">Event & Panel</th>
                        <th className="p-3 text-xs font-semibold text-muted-foreground uppercase">Coordinators & Evaluators</th>
                        <th className="p-3 text-xs font-semibold text-muted-foreground uppercase">Progress</th>
                        <th className="p-3 text-xs font-semibold text-muted-foreground uppercase text-right">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats.panelMonitor.map((pm) => {
                        const percent = pm.totalEntities > 0 ? Math.round((pm.completedEvaluations / pm.totalEntities) * 100) : 0;
                        return (
                          <tr key={pm.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-sm text-foreground">{pm.name}</div>
                              <div className="text-xs text-muted-foreground">{pm.eventName}</div>
                            </td>
                            <td className="p-3 space-y-1">
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Coord:</span> {pm.coordinators.join(', ') || '—'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Eval:</span> {pm.evaluators.join(', ') || '—'}
                              </div>
                            </td>
                            <td className="p-3 min-w-[200px]">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-medium text-foreground">{pm.completedEvaluations} / {pm.totalEntities} Evaluated</span>
                                <span className="font-bold text-muted-foreground">{percent}%</span>
                              </div>
                              <div className="w-full bg-muted dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </td>
                            <td className="p-3 text-right font-bold text-sm text-emerald-700 dark:text-emerald-400">
                              {pm.averageScore || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
