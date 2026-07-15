'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StarRating } from './star-rating';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ChevronRight,
  Save,
  Send,
  Users,
  User,
  CheckCircle2,
  FilePenLine,
  ArrowLeft,
  Loader2,
  CalendarDays,
} from 'lucide-react';

/* ---------- Types ---------- */

interface Criteria {
  id: string;
  name: string;
  maxMarks: number;
  maxStars: number;
  weightage: number;
  order: number;
}

interface EventData {
  id: string;
  name: string;
  eventType: string;
  evaluationMode: string;
  maxStarRating: number;
  evaluationStart: string | null;
  criteria: Criteria[];
  _count: { teams: number; participants: number };
}

interface TeamData {
  id: string;
  name: string;
  college: string | null;
  _count: { members: number; evaluations: number };
}

interface ParticipantData {
  id: string;
  name: string;
  college: string | null;
  teamId?: string | null;
}

interface ExistingEvaluation {
  id: string;
  eventId: string;
  teamId: string | null;
  participantId: string | null;
  status: string;
  totalScore: number;
  comments: string | null;
  scores: Array<{
    criteriaId: string;
    score: number;
    starRating: number;
    comments: string | null;
    criteria: { id: string; name: string; maxMarks: number; maxStars: number };
  }>;
}

/* ---------- Component ---------- */

interface EvaluationFormProps {
  initialDraftToEdit?: any;
  onClearDraftToEdit?: () => void;
  defaultEventId?: string;
}

export function EvaluationForm({ initialDraftToEdit, onClearDraftToEdit, defaultEventId }: EvaluationFormProps = {}) {
  const token = useAuthStore((s) => s.token);

  // Step 1: Event selection
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId || '');
  const [eventsLoading, setEventsLoading] = useState(true);

  const [panels, setPanels] = useState<any[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');

  useEffect(() => {
    if (defaultEventId) {
      setSelectedEventId(defaultEventId);
    }
  }, [defaultEventId]);

  useEffect(() => {
    if (!selectedEventId || !token) {
      setPanels([]);
      setSelectedPanelId('');
      return;
    }

    async function fetchPanels() {
      try {
        const res = await fetch(`/api/events/${selectedEventId}/panels`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPanels(data.data);
            if (data.data.length > 0) {
              setSelectedPanelId(data.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchPanels();
  }, [selectedEventId, token]);

  // Step 2: Team/Participant selection
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);

  // Step 3: Evaluation
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<'team' | 'participant'>('team');
  const [scores, setScores] = useState<Record<string, { score: number; starRating: number }>>({});
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  // Existing evaluations for this event
  const [existingEvals, setExistingEvals] = useState<ExistingEvaluation[]>([]);
  const [editingEval, setEditingEval] = useState<ExistingEvaluation | null>(null);

  /* ---------- Load initial draft if passed from another tab ---------- */
  useEffect(() => {
    if (!initialDraftToEdit) return;

    setSelectedEventId(initialDraftToEdit.eventId);
    const entityId = initialDraftToEdit.teamId || initialDraftToEdit.participantId || '';
    setSelectedEntityId(entityId);
    setSelectedEntityType(initialDraftToEdit.teamId ? 'team' : 'participant');
    setEditingEval(initialDraftToEdit);
    setComments(initialDraftToEdit.comments || '');

    const draftScores: Record<string, { score: number; starRating: number }> = {};
    initialDraftToEdit.scores.forEach((s: any) => {
      draftScores[s.criteriaId] = {
        score: s.score,
        starRating: s.starRating,
      };
    });
    setScores(draftScores);

    if (onClearDraftToEdit) {
      onClearDraftToEdit();
    }
  }, [initialDraftToEdit, onClearDraftToEdit]);

  // Derived
  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  const isTeamEvent = selectedEvent?.eventType === 'TEAM';
  const isMarksMode = selectedEvent?.evaluationMode === 'MARKS';

  const evaluatedIds = useMemo(() => {
    const ids = new Set<string>();
    existingEvals.forEach((e) => {
      if (e.status === 'SUBMITTED') {
        if (e.teamId) ids.add(`team-${e.teamId}`);
        if (e.participantId) ids.add(`participant-${e.participantId}`);
      }
    });
    return ids;
  }, [existingEvals]);

  const draftIds = useMemo(() => {
    const ids = new Map<string, string>();
    existingEvals.forEach((e) => {
      if (e.status === 'DRAFT') {
        if (e.teamId) ids.set(`team-${e.teamId}`, e.id);
        if (e.participantId) ids.set(`participant-${e.participantId}`, e.id);
      }
    });
    return ids;
  }, [existingEvals]);

  const totalScore = useMemo(() => {
    if (!selectedEvent) return 0;
    return Object.values(scores).reduce((sum, s) => {
      return sum + (isMarksMode ? s.score : s.starRating);
    }, 0);
  }, [scores, selectedEvent, isMarksMode]);

  const isLocked = useMemo(() => {
    if (!selectedEvent || !selectedEvent.evaluationStart) return false;
    return new Date() < new Date(selectedEvent.evaluationStart);
  }, [selectedEvent]);

  /* ---------- Fetch Events ---------- */
  useEffect(() => {
    if (!token) return;
    const fetchEvents = async () => {
      setEventsLoading(true);
      try {
        const res = await fetch('/api/events', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          // Fetch detailed events with criteria
          const detailedEvents = await Promise.all(
            data.data.map(async (e: { id: string }) => {
              const detailRes = await fetch(`/api/events/${e.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const detailData = await detailRes.json();
              return detailData.success ? detailData.data : null;
            })
          );
          const filteredEvents = detailedEvents.filter(Boolean);
          setEvents(filteredEvents);
          if (filteredEvents.length === 1) {
            setSelectedEventId(filteredEvents[0].id);
          }
        }
      } catch {
        toast.error('Failed to load events');
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEvents();
  }, [token]);

  /* ---------- Fetch Teams/Participants & Existing Evaluations ---------- */
  useEffect(() => {
    if (!token || !selectedEventId) {
      setTeams([]);
      setParticipants([]);
      setExistingEvals([]);
      return;
    }

    const fetchEntities = async () => {
      setEntitiesLoading(true);
      try {
        const panelParam = selectedPanelId ? `&panelId=${selectedPanelId}` : '';
        const [teamsRes, participantsRes, evalsRes] = await Promise.all([
          fetch(`/api/teams?eventId=${selectedEventId}${panelParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/participants?eventId=${selectedEventId}${panelParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/evaluations?eventId=${selectedEventId}${panelParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const teamsData = await teamsRes.json();
        const participantsData = await participantsRes.json();
        const evalsData = await evalsRes.json();

        if (teamsData.success) setTeams(teamsData.data);
        if (participantsData.success) setParticipants(participantsData.data);
        if (evalsData.success) setExistingEvals(evalsData.data);
      } catch {
        toast.error('Failed to load data');
      } finally {
        setEntitiesLoading(false);
      }
    };

    fetchEntities();
  }, [token, selectedEventId, selectedPanelId]);

  /* ---------- Initialize scores when event selected ---------- */
  useEffect(() => {
    if (!selectedEvent) {
      setScores({});
      return;
    }
    if (editingEval) {
      // Don't overwrite draft/existing scores if we are editing an evaluation
      return;
    }
    const initialScores: Record<string, { score: number; starRating: number }> = {};
    selectedEvent.criteria.forEach((c) => {
      initialScores[c.id] = { score: 0, starRating: 0 };
    });
    setScores(initialScores);
  }, [selectedEvent, editingEval]);

  /* ---------- Load existing evaluation for editing ---------- */
  const loadExistingEval = useCallback(
    (evalItem: ExistingEvaluation) => {
      setEditingEval(evalItem);
      const newScores: Record<string, { score: number; starRating: number }> = {};
      selectedEvent?.criteria.forEach((c) => {
        const existing = evalItem.scores.find((s) => s.criteriaId === c.id);
        newScores[c.id] = {
          score: existing?.score ?? 0,
          starRating: existing?.starRating ?? 0,
        };
      });
      setScores(newScores);
      setComments(evalItem.comments || '');
    },
    [selectedEvent]
  );

  /* ---------- Submit handler ---------- */
  const handleSubmit = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!token || !selectedEventId || !selectedEntityId) return;

    // Validate for SUBMITTED
    if (status === 'SUBMITTED') {
      const hasAnyScore = Object.values(scores).some(
        (s) => (isMarksMode && s.score > 0) || (!isMarksMode && s.starRating > 0)
      );
      if (!hasAnyScore) {
        toast.error('Please provide at least one score before submitting');
        return;
      }
    }

    setSaving(true);
    try {
      const scoresArray = selectedEvent!.criteria.map((c) => ({
        criteriaId: c.id,
        score: scores[c.id]?.score ?? 0,
        starRating: scores[c.id]?.starRating ?? 0,
      }));

      const body: Record<string, unknown> = {
        eventId: selectedEventId,
        status,
        totalScore,
        comments: comments || null,
        scores: scoresArray,
      };

      if (selectedEntityType === 'team') {
        body.teamId = selectedEntityId;
      } else {
        body.participantId = selectedEntityId;
      }

      let res: Response;

      if (editingEval) {
        // PUT to update
        res = await fetch(`/api/evaluations/${editingEval.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      } else {
        // POST to create
        res = await fetch('/api/evaluations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();

      if (data.success) {
        toast.success(
          status === 'DRAFT'
            ? 'Draft saved successfully'
            : 'Evaluation submitted successfully'
        );

        // Refresh evaluations
        const evalsRes = await fetch(`/api/evaluations?eventId=${selectedEventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const evalsData = await evalsRes.json();
        if (evalsData.success) setExistingEvals(evalsData.data);

        // Reset form
        setSelectedEntityId('');
        setEditingEval(null);
        setComments('');
        const resetScores: Record<string, { score: number; starRating: number }> = {};
        selectedEvent!.criteria.forEach((c) => {
          resetScores[c.id] = { score: 0, starRating: 0 };
        });
        setScores(resetScores);
      } else {
        toast.error(data.error || 'Failed to save evaluation');
      }
    } catch {
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Render ---------- */

  if (eventsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!selectedEntityId ? (
          <motion.div
            key="selectors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Step 1: Event Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    1
                  </span>
                  Select Event
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {events.length > 1 ? (
                  <Select
                    value={selectedEventId}
                    onValueChange={(v) => {
                      setSelectedEventId(v);
                      setSelectedEntityId('');
                      setEditingEval(null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose an event to evaluate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          <span className="flex items-center gap-2">
                            {event.eventType === 'TEAM' ? (
                              <Users className="size-3.5" />
                            ) : (
                              <User className="size-3.5" />
                            )}
                            {event.name}
                            <span className="text-muted-foreground text-xs">
                              ({event.evaluationMode})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : selectedEvent ? (
                  <div className="p-3 border rounded-lg bg-muted/40 font-semibold flex items-center gap-2 text-sm">
                    {selectedEvent.eventType === 'TEAM' ? (
                      <Users className="size-4 text-emerald-600" />
                    ) : (
                      <User className="size-4 text-emerald-600" />
                    )}
                    <span>{selectedEvent.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedEvent.evaluationMode}
                    </Badge>
                  </div>
                ) : (
                  <div className="p-3 border rounded-lg bg-muted/40 text-muted-foreground text-sm italic">
                    No event available
                  </div>
                )}

                {selectedEventId && panels.length > 0 && (
                  <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Select Panel
                    </label>
                    {panels.length > 1 ? (
                      <Select
                        value={selectedPanelId}
                        onValueChange={(v) => {
                          setSelectedPanelId(v);
                          setSelectedEntityId('');
                          setEditingEval(null);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a panel..." />
                        </SelectTrigger>
                        <SelectContent>
                          {panels.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 border rounded-lg bg-muted/20 text-sm font-medium">
                        Panel: <span className="text-emerald-600 font-semibold">{panels[0].name}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Entity Selection */}
            {selectedEventId && (
              isLocked ? (
                <Card className="border-amber-200 bg-amber-50/20 backdrop-blur-sm overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <CalendarDays className="size-48 text-amber-500" />
                  </div>
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto">
                    <div className="size-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 animate-pulse">
                      <CalendarDays className="size-8" />
                    </div>
                    <h3 className="font-bold text-lg text-amber-900">Evaluation hasn't started yet!</h3>
                    <p className="text-sm text-amber-800 font-medium leading-relaxed">
                      Evaluation has not started yet. Please wait until the scheduled evaluation time.
                    </p>
                    <div className="bg-amber-100/60 border border-amber-200 px-4 py-2 rounded-xl text-sm font-semibold text-amber-950">
                      Starts on: {new Date(selectedEvent!.evaluationStart!).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
                        2
                      </span>
                      {isTeamEvent ? 'Select Team' : 'Select Participant'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    {entitiesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
                      {isTeamEvent
                        ? teams.map((team) => {
                            const key = `team-${team.id}`;
                            const isEvaluated = evaluatedIds.has(key);
                            const draftEvalId = draftIds.get(key);
                            const isSelected = selectedEntityId === team.id;

                            return (
                              <button
                                key={team.id}
                                type="button"
                                disabled={isEvaluated}
                                onClick={() => {
                                  setSelectedEntityType('team');
                                  setSelectedEntityId(team.id);
                                  setEditingEval(null);

                                  if (draftEvalId) {
                                    const existing = existingEvals.find(
                                      (e) => e.id === draftEvalId
                                    );
                                    if (existing) loadExistingEval(existing);
                                  } else {
                                    setComments('');
                                    const resetScores: Record<string, { score: number; starRating: number }> = {};
                                    selectedEvent?.criteria.forEach((c) => {
                                      resetScores[c.id] = { score: 0, starRating: 0 };
                                    });
                                    setScores(resetScores);
                                  }
                                }}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                                  isEvaluated
                                    ? 'border-green-200 bg-green-50/40 dark:bg-green-950/20 dark:border-green-900/30 cursor-not-allowed text-green-900 dark:text-green-300'
                                    : isSelected
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                                      : 'border-border hover:border-emerald-300 hover:bg-emerald-50/50'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate">{team.name}</p>
                                  {team.college && (
                                    <p className={`text-xs truncate ${isEvaluated ? 'text-green-700/80 dark:text-green-400/80' : 'text-muted-foreground'}`}>
                                      {team.college}
                                    </p>
                                  )}
                                  <p className={`text-xs ${isEvaluated ? 'text-green-700/80 dark:text-green-400/80' : 'text-muted-foreground'}`}>
                                    {team._count.members} members
                                  </p>
                                </div>
                                <div className="ml-2 shrink-0">
                                  {isEvaluated ? (
                                    <Badge className="bg-green-100 text-green-700 border-green-200">
                                      <CheckCircle2 className="size-3 mr-1" />
                                      Done
                                    </Badge>
                                  ) : draftEvalId ? (
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                      <FilePenLine className="size-3 mr-1" />
                                      Draft
                                    </Badge>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                        : participants
                            .filter((p) => !p.teamId) // Only individual participants
                            .map((participant) => {
                              const key = `participant-${participant.id}`;
                              const isEvaluated = evaluatedIds.has(key);
                              const draftEvalId = draftIds.get(key);
                              const isSelected = selectedEntityId === participant.id;

                              return (
                                <button
                                  key={participant.id}
                                  type="button"
                                  disabled={isEvaluated}
                                  onClick={() => {
                                    setSelectedEntityType('participant');
                                    setSelectedEntityId(participant.id);
                                    setEditingEval(null);

                                    if (draftEvalId) {
                                      const existing = existingEvals.find(
                                        (e) => e.id === draftEvalId
                                      );
                                      if (existing) loadExistingEval(existing);
                                    } else {
                                      setComments('');
                                      const resetScores: Record<string, { score: number; starRating: number }> = {};
                                      selectedEvent?.criteria.forEach((c) => {
                                        resetScores[c.id] = { score: 0, starRating: 0 };
                                      });
                                      setScores(resetScores);
                                    }
                                  }}
                                  className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                                    isEvaluated
                                      ? 'border-green-200 bg-green-50/40 dark:bg-green-950/20 dark:border-green-900/30 cursor-not-allowed text-green-900 dark:text-green-300'
                                      : isSelected
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                                        : 'border-border hover:border-emerald-300 hover:bg-emerald-50/50'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">
                                      {participant.name}
                                    </p>
                                    {participant.college && (
                                      <p className={`text-xs truncate ${isEvaluated ? 'text-green-700/80 dark:text-green-400/80' : 'text-muted-foreground'}`}>
                                        {participant.college}
                                      </p>
                                    )}
                                  </div>
                                  <div className="ml-2 shrink-0">
                                    {isEvaluated ? (
                                      <Badge className="bg-green-100 text-green-700 border-green-200">
                                        <CheckCircle2 className="size-3 mr-1" />
                                        Done
                                      </Badge>
                                    ) : draftEvalId ? (
                                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                        <FilePenLine className="size-3 mr-1" />
                                        Draft
                                      </Badge>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </motion.div>
        ) : (
          selectedEventId && selectedEvent && (
            <motion.div
              key="evaluation-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="shadow-lg border border-emerald-100 dark:border-emerald-950">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                        3
                      </span>
                      Evaluation Form
                      {editingEval && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200 ml-2 animate-pulse"
                        >
                          Editing Draft
                        </Badge>
                      )}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedEntityId('');
                        setEditingEval(null);
                      }}
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="size-4" />
                      Back to Selector
                    </Button>
                  </div>

                  {/* Focused Context Header */}
                  <div className="mt-4 pt-4 border-t flex flex-col gap-1">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                      {selectedEvent.name}
                    </span>
                    <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">
                      Evaluating: {isTeamEvent
                        ? teams.find((t) => t.id === selectedEntityId)?.name
                        : participants.find((p) => p.id === selectedEntityId)?.name}
                    </h2>
                    {(isTeamEvent
                      ? teams.find((t) => t.id === selectedEntityId)?.college
                      : participants.find((p) => p.id === selectedEntityId)?.college) && (
                      <p className="text-sm font-medium text-muted-foreground">
                        {isTeamEvent
                          ? teams.find((t) => t.id === selectedEntityId)?.college
                          : participants.find((p) => p.id === selectedEntityId)?.college}
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-6">
                  {/* Criteria Scores */}
                  <div className="space-y-5">
                    {selectedEvent.criteria
                      .sort((a, b) => a.order - b.order)
                      .map((criterion) => (
                        <div key={criterion.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">{criterion.name}</Label>
                            {isMarksMode ? (
                              <span className="text-xs text-muted-foreground font-medium">
                                Max Marks: {criterion.maxMarks}
                                {criterion.weightage > 0 &&
                                  ` (Weight: ${criterion.weightage}%)`}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground font-medium">
                                Max Stars: {criterion.maxStars} stars
                                {criterion.weightage > 0 &&
                                  ` (Weight: ${criterion.weightage}%)`}
                              </span>
                            )}
                          </div>

                          {isMarksMode ? (
                            <div className="flex items-center gap-4">
                              <Slider
                                value={[scores[criterion.id]?.score ?? 0]}
                                min={0}
                                max={criterion.maxMarks || 100}
                                step={0.5}
                                onValueChange={([val]) =>
                                  setScores((prev) => ({
                                    ...prev,
                                    [criterion.id]: {
                                      ...prev[criterion.id],
                                      score: val,
                                    },
                                  }))
                                }
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                min={0}
                                max={criterion.maxMarks || 100}
                                step={0.5}
                                value={scores[criterion.id]?.score ?? 0}
                                onChange={(e) => {
                                  const val = Math.min(
                                    parseFloat(e.target.value) || 0,
                                    criterion.maxMarks || 100
                                  );
                                  setScores((prev) => ({
                                    ...prev,
                                    [criterion.id]: {
                                      ...prev[criterion.id],
                                      score: Math.max(0, val),
                                    },
                                  }));
                                }}
                                className="w-20 text-center tabular-nums font-bold"
                              />
                            </div>
                          ) : (
                            <StarRating
                              value={scores[criterion.id]?.starRating ?? 0}
                              onChange={(val) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [criterion.id]: {
                                    ...prev[criterion.id],
                                    starRating: val,
                                  },
                                }))
                              }
                              maxStars={criterion.maxStars || selectedEvent.maxStarRating || 5}
                              size="lg"
                            />
                          )}
                        </div>
                      ))}
                  </div>

                  {/* Total Score */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
                        Total Performance Score
                      </span>
                      <motion.span
                        key={totalScore}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums"
                      >
                        {totalScore.toFixed(1)}
                      </motion.span>
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="space-y-2">
                    <Label htmlFor="eval-comments" className="font-semibold">Comments / Feedback</Label>
                    <Textarea
                      id="eval-comments"
                      placeholder="Add your comments or performance feedback here..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={4}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSubmit('DRAFT')}
                      disabled={saving}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/20"
                    >
                      {saving ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="size-4 mr-2" />
                      )}
                      Save Draft
                    </Button>
                    <Button
                      onClick={() => handleSubmit('SUBMITTED')}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                    >
                      {saving ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="size-4 mr-2" />
                      )}
                      Submit Final Score
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
