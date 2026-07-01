'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  FileText,
  Send,
  FilePenLine,
  Users,
  User,
  CalendarDays,
} from 'lucide-react';

interface DashboardData {
  role: 'EVALUATOR';
  assignedEvents: number;
  totalEvaluations: number;
  submittedEvaluations: number;
  draftEvaluations: number;
  eventDetails: Array<{
    id: string;
    name: string;
    status: string;
    teams: number;
    participants: number;
  }>;
}

interface RecentEvaluation {
  id: string;
  status: string;
  totalScore: number;
  createdAt: string;
  event: { id: string; name: string; eventType: string };
  team: { id: string; name: string; college: string | null } | null;
  participant: { id: string; name: string; college: string | null } | null;
}

const statCards = [
  { key: 'assignedEvents', label: 'Assigned Events', icon: CalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'totalEvaluations', label: 'Total Evaluations', icon: ClipboardCheck, color: 'text-teal-600', bg: 'bg-teal-50' },
  { key: 'submittedEvaluations', label: 'Submitted', icon: Send, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'draftEvaluations', label: 'Drafts', icon: FilePenLine, color: 'text-amber-600', bg: 'bg-amber-50' },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export function EvaluatorDashboard() {
  const token = useAuthStore((s) => s.token);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentEvals, setRecentEvals] = useState<RecentEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, evalRes] = await Promise.all([
          fetch('/api/dashboard', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/evaluations', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!dashRes.ok || !evalRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const dashData = await dashRes.json();
        const evalData = await evalRes.json();

        if (dashData.success) {
          setDashboard(dashData.data);
        }
        if (evalData.success) {
          setRecentEvals(evalData.data.slice(0, 5));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 text-center">
          <p className="text-destructive font-medium">Failed to load dashboard</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const value = dashboard?.[stat.key] ?? 0;
          return (
            <motion.div key={stat.key} variants={itemVariants}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Events */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4 text-emerald-600" />
                Assigned Events
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {dashboard?.eventDetails && dashboard.eventDetails.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                  {dashboard.eventDetails.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{event.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="size-3" />
                            {event.teams} teams
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="size-3" />
                            {event.participants} participants
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={event.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={
                          event.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : event.status === 'COMPLETED'
                              ? 'bg-gray-100 text-gray-600 border-gray-200'
                              : ''
                        }
                      >
                        {event.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No events assigned yet
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Evaluations */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-teal-600" />
                Recent Evaluations
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {recentEvals.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                  {recentEvals.map((evalItem) => (
                    <div
                      key={evalItem.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {evalItem.team?.name || evalItem.participant?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {evalItem.event.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <span className="text-sm font-semibold tabular-nums">
                          {evalItem.totalScore}
                        </span>
                        <Badge
                          variant={evalItem.status === 'SUBMITTED' ? 'default' : 'secondary'}
                          className={
                            evalItem.status === 'SUBMITTED'
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200'
                          }
                        >
                          {evalItem.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No evaluations yet
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
