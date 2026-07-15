'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Medal,
  RefreshCw,
  Loader2,
  BarChart3,
  Users,
  User,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AssignedEvent {
  id: string;
  name: string;
  eventType: 'TEAM' | 'INDIVIDUAL';
}

interface LeaderboardEntry {
  id: string;
  name: string;
  college: string | null;
  type: 'team' | 'participant';
  totalScore: number;
  averageScore: number;
  evaluationCount: number;
  rank: number;
}

interface LeaderboardData {
  eventId: string;
  eventName: string;
  eventType: string;
  evaluationMode: string;
  leaderboard: LeaderboardEntry[];
}

interface PreviousRank {
  rank: number;
  timestamp: number;
}

const REFRESH_INTERVAL = 30000; // 30 seconds

const rankStyles: Record<number, { bg: string; text: string; icon: typeof Trophy; border: string }> = {
  1: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    icon: Trophy,
    border: 'border-amber-300 dark:border-amber-700',
  },
  2: {
    bg: 'bg-slate-50 dark:bg-slate-950/30',
    text: 'text-slate-600 dark:text-slate-400',
    icon: Medal,
    border: 'border-slate-300 dark:border-slate-600',
  },
  3: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-700 dark:text-orange-400',
    icon: Medal,
    border: 'border-orange-300 dark:border-orange-700',
  },
};

export function Leaderboard({ defaultEventId }: { defaultEventId?: string }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId || '');

  useEffect(() => {
    if (defaultEventId) {
      setSelectedEventId(defaultEventId);
    }
  }, [defaultEventId]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [previousRanks, setPreviousRanks] = useState<Record<string, PreviousRank>>({});
  const [panels, setPanels] = useState<any[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const downloadReport = async (type: string, format: string) => {
    if (!selectedEventId || !token) return;
    try {
      const panelParam = selectedPanelId && selectedPanelId !== 'all' ? `&panelId=${selectedPanelId}` : '';
      const res = await fetch(`/api/reports?type=${type}&format=${format}&eventId=${selectedEventId}${panelParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to download report');
      }

      const contentDisposition = res.headers.get('content-disposition');
      let filename = `${type}-report.${format === 'doc' ? 'doc' : 'csv'}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during download');
    }
  };

  // Fetch programs (Admins only)
  useEffect(() => {
    async function fetchPrograms() {
      if (!token || !isAdmin) return;
      try {
        const res = await fetch('/api/programs?status=ACTIVE', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPrograms(data.data);
          }
        }
      } catch {
        toast.error('Failed to load programs');
      } finally {
        setLoading(false);
      }
    }
    if (isAdmin) {
      fetchPrograms();
    }
  }, [token, isAdmin]);

  // Fetch assigned events (non-Admins on mount)
  useEffect(() => {
    async function fetchAssignedEvents() {
      if (!token || isAdmin) return;
      try {
        const res = await fetch('/api/events', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setEvents(data.data);
            if (data.data.length === 1) {
              setSelectedEventId(data.data[0].id);
            }
          }
        }
      } catch {
        toast.error('Failed to load events');
      } finally {
        setLoading(false);
      }
    }
    fetchAssignedEvents();
  }, [token, isAdmin]);

  // Fetch events for chosen program (Admins when program selection changes)
  useEffect(() => {
    async function fetchEventsForProgram() {
      if (!token || !selectedProgramId) {
        setEvents([]);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/events?programId=${selectedProgramId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) setEvents(data.data);
        }
      } catch {
        toast.error('Failed to load events');
      } finally {
        setLoading(false);
      }
    }
    if (isAdmin) {
      fetchEventsForProgram();
    }
  }, [token, selectedProgramId, isAdmin]);

  // Reset selected event when program changes
  useEffect(() => {
    setSelectedEventId('');
    setPanels([]);
    setSelectedPanelId('all');
    setLeaderboardData(null);
  }, [selectedProgramId]);

  // Fetch panels when event changes
  useEffect(() => {
    async function fetchPanels() {
      if (!selectedEventId || !token) {
        setPanels([]);
        setSelectedPanelId('all');
        return;
      }
      try {
        const res = await fetch(`/api/events/${selectedEventId}/panels`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPanels(data.data);
          }
        }
      } catch {
        // silent
      }
    }
    fetchPanels();
  }, [selectedEventId, token]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    if (!selectedEventId || !token) return;
    setDataLoading(true);
    try {
      const panelParam = selectedPanelId && selectedPanelId !== 'all' ? `&panelId=${selectedPanelId}` : '';
      const res = await fetch(`/api/leaderboard?eventId=${selectedEventId}${panelParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Save previous ranks for animation using functional state update
          setLeaderboardData((prevLeaderboardData) => {
            if (prevLeaderboardData?.leaderboard) {
              const prevRanks: Record<string, PreviousRank> = {};
              prevLeaderboardData.leaderboard.forEach((entry) => {
                prevRanks[entry.id] = { rank: entry.rank, timestamp: Date.now() };
              });
              setPreviousRanks(prevRanks);
            }
            return data.data;
          });
          setLastRefresh(new Date());
          setCountdown(30);
        }
      }
    } catch {
      toast.error('Failed to load leaderboard');
    } finally {
      setDataLoading(false);
    }
  }, [selectedEventId, selectedPanelId, token]);

  // Fetch when event or panel changes
  useEffect(() => {
    if (selectedEventId) {
      fetchLeaderboard();
    } else {
      setLeaderboardData(null);
    }
  }, [selectedEventId, selectedPanelId, fetchLeaderboard]);

  // Auto-refresh interval
  useEffect(() => {
    if (!selectedEventId) return;

    intervalRef.current = setInterval(() => {
      fetchLeaderboard();
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedEventId, fetchLeaderboard]);

  // Countdown timer
  useEffect(() => {
    if (!selectedEventId) return;

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [selectedEventId, lastRefresh]);

  const getRankTrend = (entry: LeaderboardEntry): 'up' | 'down' | 'same' | 'new' => {
    const prev = previousRanks[entry.id];
    if (!prev) return 'new';
    if (entry.rank < prev.rank) return 'up';
    if (entry.rank > prev.rank) return 'down';
    return 'same';
  };

  // Insights
  const insights = leaderboardData?.leaderboard
    ? {
        totalRegistrations: leaderboardData.leaderboard.length,
        evaluationsCompleted: leaderboardData.leaderboard.reduce(
          (sum, e) => sum + e.evaluationCount,
          0
        ),
        averageScore:
          leaderboardData.leaderboard.length > 0
            ? Math.round(
                (leaderboardData.leaderboard.reduce((s, e) => s + e.averageScore, 0) /
                  leaderboardData.leaderboard.length) *
                  100
              ) / 100
            : 0,
        highestScore:
          leaderboardData.leaderboard.length > 0
            ? leaderboardData.leaderboard[0].averageScore
            : 0,
        lowestScore:
          leaderboardData.leaderboard.length > 0
            ? leaderboardData.leaderboard[leaderboardData.leaderboard.length - 1].averageScore
            : 0,
      }
    : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Event Selector */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Live Leaderboard</CardTitle>
              <CardDescription className="flex items-center gap-1.5 mt-0.5">
                <span>Real-time rankings with auto-refresh</span>
                {selectedEventId && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium ml-1.5">
                    <RefreshCw className={`h-2.5 w-2.5 ${dataLoading ? 'animate-spin' : ''}`} />
                    <span>reloads in {countdown}s</span>
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isAdmin && (
                <Select
                  value={selectedProgramId}
                  onValueChange={setSelectedProgramId}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select program..." />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((prog) => (
                      <SelectItem key={prog.id} value={prog.id}>
                        {prog.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isAdmin || events.length > 1 ? (
                <Select
                  value={selectedEventId}
                  onValueChange={(v) => {
                    setSelectedEventId(v);
                    setSelectedPanelId('all');
                  }}
                  disabled={isAdmin && !selectedProgramId}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={isAdmin && !selectedProgramId ? "Choose program first..." : "Select event..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : selectedEvent ? (
                <Badge variant="outline" className="text-sm font-semibold px-3 py-1.5 bg-muted/40">
                  Event: {selectedEvent.name}
                </Badge>
              ) : null}
              {selectedEventId && panels.length > 0 && (
                <Select
                  value={selectedPanelId}
                  onValueChange={setSelectedPanelId}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Panels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Panels</SelectItem>
                    {panels.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedEventId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Reports</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Microsoft Word (.doc)</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => downloadReport('event-results', 'doc')}
                      className="cursor-pointer gap-2"
                    >
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <span>Detailed Evaluations</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        downloadReport(
                          selectedEvent?.eventType === 'TEAM'
                            ? 'team-rankings'
                            : 'individual-rankings',
                          'doc'
                        )
                      }
                      className="cursor-pointer gap-2"
                    >
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <span>Event Rankings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => downloadReport('evaluator-report', 'doc')}
                      className="cursor-pointer gap-2"
                    >
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <span>Evaluator Status</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel>CSV Spreadsheet (.csv)</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => downloadReport('event-results', 'csv')}
                      className="cursor-pointer gap-2"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-teal-600" />
                      <span>Detailed Evaluations</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        downloadReport(
                          selectedEvent?.eventType === 'TEAM'
                            ? 'team-rankings'
                            : 'individual-rankings',
                            'csv'
                        )
                      }
                      className="cursor-pointer gap-2"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-teal-600" />
                      <span>Event Rankings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => downloadReport('evaluator-report', 'csv')}
                      className="cursor-pointer gap-2"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-teal-600" />
                      <span>Evaluator Status</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Leaderboard Table */}
      {selectedEventId && (
        <Card className="shadow-md">
          <CardContent className="p-0">
            {dataLoading && !leaderboardData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </div>
            ) : !leaderboardData || leaderboardData.leaderboard.length === 0 ? (
              <div className="py-12 text-center">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No evaluation data available yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 text-center">Rank</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>College</TableHead>
                      <TableHead className="text-center">Avg Score</TableHead>
                      <TableHead className="text-center">Evaluations</TableHead>
                      <TableHead className="w-16 text-center">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {leaderboardData.leaderboard.map((entry) => {
                        const style = rankStyles[entry.rank];
                        const trend = getRankTrend(entry);
                        const TrendIcon =
                          trend === 'up'
                            ? TrendingUp
                            : trend === 'down'
                              ? TrendingDown
                              : Minus;
                        const trendColor =
                          trend === 'up'
                            ? 'text-emerald-600'
                            : trend === 'down'
                              ? 'text-red-500'
                              : 'text-muted-foreground';

                        return (
                          <motion.tr
                            key={entry.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{
                              type: 'spring',
                              stiffness: 350,
                              damping: 30,
                            }}
                            className={`border-b transition-colors hover:bg-muted/50 ${
                              entry.rank <= 3 && style
                                ? `${style.bg} ${style.border} border-l-4`
                                : ''
                            }`}
                          >
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center">
                                {entry.rank <= 3 && style ? (
                                  <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-full ${style.bg} ${style.text}`}
                                  >
                                    {entry.rank === 1 ? (
                                      <Trophy className="h-4 w-4" />
                                    ) : (
                                      <Medal className="h-4 w-4" />
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-sm font-semibold text-muted-foreground">
                                    #{entry.rank}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{entry.name}</span>
                                {entry.rank === 1 && (
                                  <Badge className="bg-amber-500 text-white text-xs">
                                    1st
                                  </Badge>
                                )}
                                {entry.rank === 2 && (
                                  <Badge className="bg-slate-400 text-white text-xs">
                                    2nd
                                  </Badge>
                                )}
                                {entry.rank === 3 && (
                                  <Badge className="bg-orange-400 text-white text-xs">
                                    3rd
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {entry.college || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {entry.averageScore.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{entry.evaluationCount}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {trend !== 'new' && (
                                <TrendIcon className={`mx-auto h-4 w-4 ${trendColor}`} />
                              )}
                              {trend === 'new' && (
                                <Badge variant="secondary" className="text-xs">
                                  New
                                </Badge>
                              )}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Event Insights */}
      {insights && leaderboardData && leaderboardData.leaderboard.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg">Event Insights</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-lg border bg-emerald-50/50 p-3 text-center dark:bg-emerald-950/20">
                  {leaderboardData.eventType === 'TEAM' ? (
                    <Users className="mx-auto h-5 w-5 text-emerald-600" />
                  ) : (
                    <User className="mx-auto h-5 w-5 text-emerald-600" />
                  )}
                  <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {insights.totalRegistrations}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Registrations</p>
                </div>
                <div className="rounded-lg border bg-teal-50/50 p-3 text-center dark:bg-teal-950/20">
                  <ClipboardCheck className="mx-auto h-5 w-5 text-teal-600" />
                  <p className="mt-1 text-xl font-bold text-teal-700 dark:text-teal-400">
                    {insights.evaluationsCompleted}
                  </p>
                  <p className="text-xs text-muted-foreground">Evaluations Done</p>
                </div>
                <div className="rounded-lg border bg-cyan-50/50 p-3 text-center dark:bg-cyan-950/20">
                  <BarChart3 className="mx-auto h-5 w-5 text-cyan-600" />
                  <p className="mt-1 text-xl font-bold text-cyan-700 dark:text-cyan-400">
                    {insights.averageScore.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Average Score</p>
                </div>
                <div className="rounded-lg border bg-green-50/50 p-3 text-center dark:bg-green-950/20">
                  <TrendingUp className="mx-auto h-5 w-5 text-green-600" />
                  <p className="mt-1 text-xl font-bold text-green-700 dark:text-green-400">
                    {insights.highestScore.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Highest Score</p>
                </div>
                <div className="rounded-lg border bg-amber-50/50 p-3 text-center dark:bg-amber-950/20">
                  <TrendingDown className="mx-auto h-5 w-5 text-amber-600" />
                  <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400">
                    {insights.lowestScore.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Lowest Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* No event selected */}
      {!selectedEventId && !loading && (
        <Card className="shadow-md">
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Select an event to view the leaderboard
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
