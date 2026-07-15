'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarCheck,
  Users,
  UserCheck,
  ClipboardCheck,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';

interface DashboardStats {
  role: string;
  assignedEvents: number;
  totalTeams: number;
  totalParticipants: number;
  totalEvaluations: number;
  submittedEvaluations: number;
  draftEvaluations: number;
}

interface AssignedEvent {
  id: string;
  name: string;
  eventType: 'TEAM' | 'INDIVIDUAL';
  status: string;
  venue: string | null;
  eventDate: string | null;
  _count: {
    teams: number;
    participants: number;
    evaluations: number;
    coordinators: number;
    evaluators: number;
  };
  program: {
    id: string;
    name: string;
  };
  panels?: Array<{
    id: string;
    name: string;
    coordinators: Array<{ userId: string }>;
  }>;
}

const statCards = [
  {
    key: 'assignedEvents' as const,
    label: 'Assigned Events',
    icon: CalendarCheck,
    gradient: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    key: 'totalTeams' as const,
    label: 'Total Teams',
    icon: Users,
    gradient: 'from-teal-500 to-cyan-600',
    bgLight: 'bg-teal-50 dark:bg-teal-950/40',
  },
  {
    key: 'totalParticipants' as const,
    label: 'Total Participants',
    icon: UserCheck,
    gradient: 'from-cyan-500 to-emerald-600',
    bgLight: 'bg-cyan-50 dark:bg-cyan-950/40',
  },
  {
    key: 'submittedEvaluations' as const,
    label: 'Evaluations Completed',
    icon: ClipboardCheck,
    gradient: 'from-green-500 to-emerald-600',
    bgLight: 'bg-green-50 dark:bg-green-950/40',
  },
  {
    key: 'draftEvaluations' as const,
    label: 'Evaluations Pending',
    icon: Clock,
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function CoordinatorDashboard() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!token) return;
      try {
        setLoading(true);
        const [dashRes, eventsRes] = await Promise.all([
          fetch('/api/dashboard', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/events', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!dashRes.ok || !eventsRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const dashData = await dashRes.json();
        const eventsData = await eventsRes.json();

        if (dashData.success) setStats(dashData.data);
        if (eventsData.success) setEvents(eventsData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6">
          <p className="text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = stats?.[card.key] ?? 0;
          return (
            <motion.div key={card.key} variants={itemVariants}>
              <Card className="relative overflow-hidden border-0 shadow-md">
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-10`} />
                <CardContent className="relative p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        {card.label}
                      </p>
                      <motion.p
                        className="mt-1 text-3xl font-bold"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                      >
                        {value}
                      </motion.p>
                    </div>
                    <div className={`rounded-xl p-2.5 ${card.bgLight}`}>
                      <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Assigned Events Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">Assigned Events Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="py-8 text-center">
                <CalendarCheck className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-2 text-muted-foreground text-sm">No events assigned yet</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                <style jsx>{`
                  div::-webkit-scrollbar { width: 6px; }
                  div::-webkit-scrollbar-track { background: transparent; }
                  div::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
                `}</style>
                {events.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-medium">
                          {event.name}
                          {event.panels && event.panels.some(p => p.coordinators.some(c => c.userId === user?.id)) && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                              ({event.panels.filter(p => p.coordinators.some(c => c.userId === user?.id)).map(p => p.name).join(', ')})
                            </span>
                          )}
                        </h4>
                        <Badge
                          variant={event.eventType === 'TEAM' ? 'default' : 'secondary'}
                          className="shrink-0 text-xs"
                        >
                          {event.eventType}
                        </Badge>
                        <Badge
                          variant={
                            event.status === 'ACTIVE'
                              ? 'default'
                              : event.status === 'COMPLETED'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="shrink-0 text-xs"
                        >
                          {event.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {event.program.name}
                        {event.venue ? ` · ${event.venue}` : ''}
                        {event.eventDate
                          ? ` · ${new Date(event.eventDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
                          : ''}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-4 text-xs shrink-0">
                      {event.eventType === 'TEAM' ? (
                        <div className="text-center">
                          <p className="font-semibold text-emerald-600">{event._count.teams}</p>
                          <p className="text-muted-foreground">Teams</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="font-semibold text-emerald-600">
                            {event._count.participants}
                          </p>
                          <p className="text-muted-foreground">Participants</p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="font-semibold text-teal-600">
                          {event._count.evaluations}
                        </p>
                        <p className="text-muted-foreground">Evals</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
