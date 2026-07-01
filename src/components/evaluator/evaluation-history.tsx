'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { StarRating } from './star-rating';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Eye,
  FilePenLine,
  Trash2,
  Filter,
  FileText,
  Star,
  Hash,
  Loader2,
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

/* ---------- Component ---------- */

export function EvaluationHistory() {
  const token = useAuthStore((s) => s.token);

  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  // Detail dialog
  const [selectedEval, setSelectedEval] = useState<EvaluationItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Delete confirmation
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ---------- Fetch ---------- */
  const fetchEvaluations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setEvaluations(data.data);
      } else {
        setError(data.error || 'Failed to load evaluations');
      }
    } catch {
      setError('An error occurred while loading evaluations');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  /* ---------- Unique events for filter ---------- */
  const uniqueEvents = useMemo(() => {
    const map = new Map<string, string>();
    evaluations.forEach((e) => {
      if (!map.has(e.event.id)) {
        map.set(e.event.id, e.event.name);
      }
    });
    return Array.from(map.entries());
  }, [evaluations]);

  /* ---------- Filtered evaluations ---------- */
  const filtered = useMemo(() => {
    return evaluations.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (eventFilter !== 'all' && e.event.id !== eventFilter) return false;
      return true;
    });
  }, [evaluations, statusFilter, eventFilter]);

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
        setEvaluations((prev) => prev.filter((e) => e.id !== id));
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setDeleting(null);
    }
  };

  /* ---------- Render ---------- */

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
          <p className="text-destructive font-medium">Failed to load evaluations</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="size-4" />
          Filters:
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>
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
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} evaluation{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="size-10 mb-3 opacity-40" />
              <p className="text-sm">No evaluations found</p>
              <p className="text-xs mt-1">
                {evaluations.length > 0
                  ? 'Try adjusting your filters'
                  : 'Start by evaluating an event'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Team / Participant</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {filtered.map((evalItem) => (
                    <motion.tr
                      key={evalItem.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-muted/50 border-b transition-colors"
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{evalItem.event.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {evalItem.event.evaluationMode} mode
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {evalItem.team?.name ||
                            evalItem.participant?.name ||
                            'Unknown'}
                        </p>
                        {(evalItem.team?.college || evalItem.participant?.college) && (
                          <p className="text-xs text-muted-foreground">
                            {evalItem.team?.college || evalItem.participant?.college}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold tabular-nums">
                          {evalItem.totalScore}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={
                            evalItem.status === 'SUBMITTED'
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200'
                          }
                        >
                          {evalItem.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {format(new Date(evalItem.createdAt), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(evalItem.createdAt), 'h:mm a')}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEval(evalItem);
                              setDetailOpen(true);
                            }}
                            title="View details"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {evalItem.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Navigate to edit - we'll use a custom event for this
                                  const editEvent = new CustomEvent('edit-evaluation', {
                                    detail: evalItem,
                                  });
                                  window.dispatchEvent(editEvent);
                                }}
                                title="Edit draft"
                              >
                                <FilePenLine className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(evalItem.id)}
                                disabled={deleting === evalItem.id}
                                title="Delete draft"
                              >
                                {deleting === evalItem.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-emerald-600" />
              Evaluation Details
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of the evaluation scores
            </DialogDescription>
          </DialogHeader>

          {selectedEval && (
            <div className="space-y-5">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Event</p>
                  <p className="font-medium text-sm">{selectedEval.event.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {selectedEval.team ? 'Team' : 'Participant'}
                  </p>
                  <p className="font-medium text-sm">
                    {selectedEval.team?.name || selectedEval.participant?.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    className={
                      selectedEval.status === 'SUBMITTED'
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    }
                  >
                    {selectedEval.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Score</p>
                  <p className="font-bold text-lg text-emerald-700 tabular-nums">
                    {selectedEval.totalScore}
                  </p>
                </div>
              </div>

              {/* Scores Breakdown */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="size-4" />
                  Scores Breakdown
                </h4>
                <div className="space-y-3">
                  {selectedEval.scores.map((scoreItem) => (
                    <div
                      key={scoreItem.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{scoreItem.criteria.name}</p>
                        {scoreItem.criteria.weightage > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Weight: {scoreItem.criteria.weightage}%
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        {selectedEval.event.evaluationMode === 'STARS' ? (
                          <StarRating
                            value={scoreItem.starRating}
                            onChange={() => {}}
                            maxStars={scoreItem.criteria.maxStars || 5}
                            size="sm"
                            readonly
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold tabular-nums">
                              {scoreItem.score}
                            </span>
                            <span className="text-muted-foreground text-sm">
                              / {scoreItem.criteria.maxMarks}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comments */}
              {selectedEval.comments && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Comments</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">
                    {selectedEval.comments}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                <span>
                  Created: {format(new Date(selectedEval.createdAt), 'MMM d, yyyy h:mm a')}
                </span>
                {selectedEval.submittedAt && (
                  <span>
                    Submitted:{' '}
                    {format(new Date(selectedEval.submittedAt), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
