'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  FilePenLine,
  Trash2,
  Filter,
  FileText,
  Loader2,
  Users,
  User,
  ArrowRight,
} from 'lucide-react';

/* ---------- Types ---------- */

interface EvaluationItem {
  id: string;
  status: string;
  totalScore: number;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  event: {
    id: string;
    name: string;
    eventType: string;
    evaluationMode: string;
  };
  team: { id: string; name: string; college: string | null } | null;
  participant: { id: string; name: string; college: string | null } | null;
  evaluator: { id: string; name: string; email: string };
  scores: Array<{
    id: string;
    score: number;
    starRating: number;
    comments: string | null;
    criteria: {
      id: string;
      name: string;
      maxMarks: number;
      maxStars: number;
      weightage: number;
    };
  }>;
}

interface EvaluationDraftsProps {
  onEditDraft: (draft: EvaluationItem) => void;
}

export function EvaluationDrafts({ onEditDraft }: EvaluationDraftsProps) {
  const token = useAuthStore((s) => s.token);

  const [drafts, setDrafts] = useState<EvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [eventFilter, setEventFilter] = useState<string>('all');

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ---------- Fetch ---------- */
  const fetchDrafts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        // Filter evaluations to only show DRAFT status
        const draftItems = data.data.filter((e: EvaluationItem) => e.status === 'DRAFT');
        setDrafts(draftItems);
      } else {
        setError(data.error || 'Failed to load drafts');
      }
    } catch {
      setError('An error occurred while loading drafts');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  /* ---------- Unique events for filter ---------- */
  const uniqueEvents = useMemo(() => {
    const map = new Map<string, string>();
    drafts.forEach((d) => {
      if (!map.has(d.event.id)) {
        map.set(d.event.id, d.event.name);
      }
    });
    return Array.from(map.entries());
  }, [drafts]);

  /* ---------- Filtered drafts ---------- */
  const filtered = useMemo(() => {
    return drafts.filter((d) => {
      if (eventFilter !== 'all' && d.event.id !== eventFilter) return false;
      return true;
    });
  }, [drafts, eventFilter]);

  /* ---------- Delete handler ---------- */
  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/evaluations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Draft evaluation deleted');
        setDrafts((prev) => prev.filter((d) => d.id !== id));
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 text-center">
          <p className="text-destructive font-medium">Failed to load drafts</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="border-emerald-100 dark:border-emerald-950 shadow-md">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FilePenLine className="h-5 w-5 text-emerald-600" />
                Draft Evaluations
              </CardTitle>
              <CardDescription>
                Resume, update, or delete your pending evaluations. Drafts are not visible on the leaderboards until submitted.
              </CardDescription>
            </div>
            {drafts.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Filter className="size-4" />
                  Filter Event:
                </div>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {uniqueEvents.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Grid or Table */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="size-12 mb-4 text-emerald-600/40" />
                <p className="text-base font-semibold">No draft evaluations found</p>
                <p className="text-sm mt-1 text-center max-w-sm">
                  {drafts.length > 0
                    ? 'No drafts match the selected event filter.'
                    : 'When evaluating participants, you can save your progress as a draft and it will show up here.'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 md:grid-cols-2"
          >
            {filtered.map((draft) => (
              <motion.div
                key={draft.id}
                layout
                className="group relative rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-900"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
                        {draft.event.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {draft.event.eventType === 'TEAM' ? (
                          <Users className="size-3" />
                        ) : (
                          <User className="size-3" />
                        )}
                        {draft.event.eventType}
                      </span>
                    </div>

                    <h3 className="font-bold text-lg text-foreground truncate mt-1">
                      {draft.team?.name || draft.participant?.name || 'Unknown'}
                    </h3>

                    {(draft.team?.college || draft.participant?.college) && (
                      <p className="text-sm text-muted-foreground truncate">
                        {draft.team?.college || draft.participant?.college}
                      </p>
                    )}

                    {draft.comments && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2 bg-muted/30 p-2 rounded border border-border/50">
                        "{draft.comments}"
                      </p>
                    )}
                  </div>

                  <div className="text-right pl-4">
                    <span className="text-xs text-muted-foreground block font-medium">Draft Score</span>
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {draft.totalScore}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-5 pt-3 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">
                    Saved: {format(new Date(draft.updatedAt), 'MMM d, h:mm a')}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive size-8 p-0"
                      onClick={() => handleDelete(draft.id)}
                      disabled={deleting === draft.id}
                      title="Delete draft"
                    >
                      {deleting === draft.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm"
                      onClick={() => onEditDraft(draft)}
                    >
                      Resume
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
