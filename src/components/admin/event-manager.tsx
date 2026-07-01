'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  MoreHorizontal,
  ArrowUpDown,
  CalendarDays,
  X,
  Star,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Program {
  id: string;
  name: string;
  status: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Criteria {
  name: string;
  maxMarks: number;
  maxStars: number;
  weightage: number;
}

interface EventRow {
  id: string;
  name: string;
  description: string | null;
  venue: string | null;
  eventDate: string | null;
  eventType: 'TEAM' | 'INDIVIDUAL';
  evaluationMode: 'MARKS' | 'STARS';
  maxStarRating: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DELETED';
  programId: string;
  program: { id: string; name: string };
  criteria: Array<{
    id: string;
    name: string;
    maxMarks: number;
    maxStars: number;
    weightage: number;
    order: number;
  }>;
  coordinators: Array<{ userId: string; user: { id: string; name: string; email: string } }>;
  evaluators: Array<{ userId: string; user: { id: string; name: string; email: string } }>;
  _count?: { teams: number; participants: number; evaluations: number };
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  COMPLETED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  CANCELLED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  DELETED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const eventTypeColors: Record<string, string> = {
  TEAM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  INDIVIDUAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

interface SearchableMultiSelectProps {
  placeholder: string;
  options: Array<{ id: string; name: string; email: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  emptyMessage: string;
}

function SearchableMultiSelect({
  placeholder,
  options,
  selectedIds,
  onToggle,
  emptyMessage,
}: SearchableMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(search.toLowerCase()) ||
        opt.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal hover:bg-background h-10 px-3"
          >
            <span className="truncate text-muted-foreground">
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full min-w-[var(--radix-popover-trigger-width)] p-2" align="start">
          <div className="flex items-center border-b pb-2 mb-2 gap-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0 outline-none"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {emptyMessage}
              </p>
            ) : (
              filtered.map((opt) => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2.5 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors text-sm ${
                      isSelected ? 'bg-accent/45 font-medium' : ''
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggle(opt.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{opt.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {opt.email}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Items Badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedIds.map((id) => {
            const opt = options.find((o) => o.id === id);
            if (!opt) return null;
            return (
              <Badge
                key={id}
                variant="secondary"
                className="gap-1 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/85 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30 dark:hover:bg-emerald-900/40 py-0.5 pl-2.5 pr-1.5"
              >
                <span className="truncate max-w-[120px]">{opt.name}</span>
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  className="text-emerald-700/60 hover:text-emerald-900 hover:bg-emerald-200/50 dark:text-emerald-400/60 dark:hover:text-emerald-200 dark:hover:bg-emerald-800/50 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EventManager() {
  const token = useAuthStore((s) => s.token);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [coordinators, setCoordinators] = useState<UserOption[]>([]);
  const [evaluators, setEvaluators] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVenue, setFormVenue] = useState('');
  const [formEventDate, setFormEventDate] = useState('');
  const [formProgramId, setFormProgramId] = useState('');
  const [formEventType, setFormEventType] = useState<'TEAM' | 'INDIVIDUAL'>('TEAM');
  const [formEvalMode, setFormEvalMode] = useState<'MARKS' | 'STARS'>('MARKS');
  const [formMaxStarRating, setFormMaxStarRating] = useState(5);
  const [formCriteria, setFormCriteria] = useState<Criteria[]>([
    { name: '', maxMarks: 10, maxStars: 5, weightage: 0 },
  ]);
  const [formCoordinatorIds, setFormCoordinatorIds] = useState<string[]>([]);
  const [formEvaluatorIds, setFormEvaluatorIds] = useState<string[]>([]);

  const fetchEvents = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/events', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setEvents(data.data);
    } catch {
      toast.error('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch('/api/programs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPrograms(
          data.data.filter((p: Program) => p.status === 'ACTIVE')
        );
      }
    } catch {
      // Silently fail for dropdown data
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const [coordRes, evalRes] = await Promise.all([
        fetch('/api/users?role=COORDINATOR', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/users?role=EVALUATOR', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const coordData = await coordRes.json();
      const evalData = await evalRes.json();
      if (coordData.success) setCoordinators(coordData.data);
      if (evalData.success) setEvaluators(evalData.data);
    } catch {
      // Silently fail for dropdown data
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchEvents();
      fetchPrograms();
      fetchUsers();
    }
  }, [token, fetchEvents, fetchPrograms, fetchUsers]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormVenue('');
    setFormEventDate('');
    setFormProgramId('');
    setFormEventType('TEAM');
    setFormEvalMode('MARKS');
    setFormMaxStarRating(5);
    setFormCriteria([{ name: '', maxMarks: 10, maxStars: 5, weightage: 0 }]);
    setFormCoordinatorIds([]);
    setFormEvaluatorIds([]);
    setEditingEvent(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (event: EventRow) => {
    setEditingEvent(event);
    setFormName(event.name);
    setFormDescription(event.description || '');
    setFormVenue(event.venue || '');
    setFormEventDate(event.eventDate ? event.eventDate.split('T')[0] : '');
    setFormProgramId(event.programId);
    setFormEventType(event.eventType);
    setFormEvalMode(event.evaluationMode);
    setFormMaxStarRating(event.maxStarRating);
    setFormCriteria(
      event.criteria.length > 0
        ? event.criteria.map((c) => ({
            name: c.name,
            maxMarks: c.maxMarks,
            maxStars: c.maxStars,
            weightage: c.weightage,
          }))
        : [{ name: '', maxMarks: 10, maxStars: 5, weightage: 0 }]
    );
    setFormCoordinatorIds(event.coordinators.map((c) => c.user.id));
    setFormEvaluatorIds(event.evaluators.map((e) => e.user.id));
    setDialogOpen(true);
  };

  const addCriterion = () => {
    setFormCriteria([
      ...formCriteria,
      { name: '', maxMarks: 10, maxStars: 5, weightage: 0 },
    ]);
  };

  const removeCriterion = (index: number) => {
    if (formCriteria.length <= 1) return;
    setFormCriteria(formCriteria.filter((_, i) => i !== index));
  };

  const updateCriterion = (index: number, field: keyof Criteria, value: string | number) => {
    const updated = [...formCriteria];
    updated[index] = { ...updated[index], [field]: value };
    setFormCriteria(updated);
  };

  const toggleCoordinator = (userId: string) => {
    setFormCoordinatorIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleEvaluator = (userId: string) => {
    setFormEvaluatorIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Event name is required');
      return;
    }
    if (!formProgramId) {
      toast.error('Please select a program');
      return;
    }

    const validCriteria = formCriteria.filter((c) => c.name.trim());
    if (validCriteria.length === 0) {
      toast.error('At least one criterion is required');
      return;
    }

    try {
      setSubmitting(true);
      const body = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        venue: formVenue.trim() || undefined,
        eventDate: formEventDate || undefined,
        programId: formProgramId,
        eventType: formEventType,
        evaluationMode: formEvalMode,
        maxStarRating: formEvalMode === 'STARS' ? formMaxStarRating : undefined,
        criteria: validCriteria.map((c, index) => ({
          name: c.name.trim(),
          maxMarks: formEvalMode === 'MARKS' ? c.maxMarks : 0,
          maxStars: formEvalMode === 'STARS' ? c.maxStars : 5,
          weightage: c.weightage,
          order: index,
        })),
        coordinatorIds: formCoordinatorIds,
        evaluatorIds: formEvaluatorIds,
      };

      const url = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events';
      const method = editingEvent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingEvent ? 'Event updated' : 'Event created');
        setDialogOpen(false);
        resetForm();
        fetchEvents(true);
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEvent) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/events/${deletingEvent.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Event deleted');
        fetchEvents(true);
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
      setDeleteDialogOpen(false);
      setDeletingEvent(null);
    }
  };

  const columns: ColumnDef<EventRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue('name')}</div>
        ),
      },
      {
        id: 'program',
        header: 'Program',
        accessorFn: (row) => row.program?.name,
        cell: ({ row }) => {
          const prog = row.original.program;
          return prog ? <span className="text-sm">{prog.name}</span> : '—';
        },
      },
      {
        accessorKey: 'eventType',
        header: 'Type',
        cell: ({ row }) => {
          const type = row.getValue('eventType') as string;
          return (
            <Badge className={eventTypeColors[type] || ''} variant="secondary">
              {type}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'evaluationMode',
        header: 'Mode',
        cell: ({ row }) => {
          const mode = row.getValue('evaluationMode') as string;
          return (
            <Badge variant="outline" className="text-xs">
              {mode === 'STARS' && <Star className="mr-1 h-3 w-3" />}
              {mode}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'eventDate',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = row.getValue('eventDate') as string | null;
          return date ? (
            <div className="flex items-center gap-1.5 text-sm">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {new Date(date).toLocaleDateString()}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          return (
            <Badge className={statusColors[status] || ''} variant="secondary">
              {status}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const event = row.original;
          if (event.status === 'DELETED') return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(event)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    setDeletingEvent(event);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: events,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Events</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage events, criteria, and assignments
              </p>
            </div>
            <Button onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </div>
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && events.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No events found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">
                  {table.getFilteredRowModel().rows.length} event(s) total
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Edit Event' : 'Create Event'}
            </DialogTitle>
            <DialogDescription>
              {editingEvent
                ? 'Update event details, criteria, and assignments.'
                : 'Set up a new event with criteria and role assignments.'}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            <div className="grid gap-5 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Basic Information
                </h4>
                <div className="grid gap-2">
                  <Label htmlFor="eventName">Name *</Label>
                  <Input
                    id="eventName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Event name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="eventDesc">Description</Label>
                  <Textarea
                    id="eventDesc"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Event description"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="eventProgram">Program *</Label>
                    <Select value={formProgramId} onValueChange={setFormProgramId}>
                      <SelectTrigger id="eventProgram">
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="eventVenue">Venue</Label>
                    <Input
                      id="eventVenue"
                      value={formVenue}
                      onChange={(e) => setFormVenue(e.target.value)}
                      placeholder="Event venue"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="eventDate">Event Date</Label>
                    <Input
                      id="eventDate"
                      type="date"
                      value={formEventDate}
                      onChange={(e) => setFormEventDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="eventType">Event Type</Label>
                    <Select
                      value={formEventType}
                      onValueChange={(v) => setFormEventType(v as 'TEAM' | 'INDIVIDUAL')}
                    >
                      <SelectTrigger id="eventType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEAM">Team</SelectItem>
                        <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="evalMode">Evaluation Mode</Label>
                    <Select
                      value={formEvalMode}
                      onValueChange={(v) => setFormEvalMode(v as 'MARKS' | 'STARS')}
                    >
                      <SelectTrigger id="evalMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKS">Marks</SelectItem>
                        <SelectItem value="STARS">Stars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formEvalMode === 'STARS' && (
                  <div className="grid gap-2 w-32">
                    <Label htmlFor="maxStar">Max Star Rating</Label>
                    <Input
                      id="maxStar"
                      type="number"
                      min={1}
                      max={10}
                      value={formMaxStarRating}
                      onChange={(e) => setFormMaxStarRating(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Criteria Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Evaluation Criteria
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCriterion}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Criterion
                  </Button>
                </div>
                <div className="space-y-3">
                  {formCriteria.map((c, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={c.name}
                          onChange={(e) =>
                            updateCriterion(index, 'name', e.target.value)
                          }
                          placeholder="Criterion name"
                          className="mt-1"
                        />
                      </div>
                      {formEvalMode === 'MARKS' && (
                        <div className="w-24">
                          <Label className="text-xs">Max Marks</Label>
                          <Input
                            type="number"
                            min={0}
                            value={c.maxMarks}
                            onChange={(e) =>
                              updateCriterion(
                                index,
                                'maxMarks',
                                Number(e.target.value)
                              )
                            }
                            className="mt-1"
                          />
                        </div>
                      )}
                      {formEvalMode === 'STARS' && (
                        <div className="w-24">
                          <Label className="text-xs">Max Stars</Label>
                          <Input
                            type="number"
                            min={1}
                            max={formMaxStarRating}
                            value={c.maxStars}
                            onChange={(e) =>
                              updateCriterion(
                                index,
                                'maxStars',
                                Number(e.target.value)
                              )
                            }
                            className="mt-1"
                          />
                        </div>
                      )}
                      <div className="w-24">
                        <Label className="text-xs">Weightage</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={c.weightage}
                          onChange={(e) =>
                            updateCriterion(
                              index,
                              'weightage',
                              Number(e.target.value)
                            )
                          }
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => removeCriterion(index)}
                          disabled={formCriteria.length <= 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Coordinator Assignment */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Coordinators
                </Label>
                <SearchableMultiSelect
                  placeholder="Select coordinators"
                  options={coordinators}
                  selectedIds={formCoordinatorIds}
                  onToggle={toggleCoordinator}
                  emptyMessage="No coordinators found. Create users with COORDINATOR role first."
                />
              </div>

              <Separator />

              {/* Evaluator Assignment */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Evaluators
                </Label>
                <SearchableMultiSelect
                  placeholder="Select evaluators"
                  options={evaluators}
                  selectedIds={formEvaluatorIds}
                  onToggle={toggleEvaluator}
                  emptyMessage="No evaluators found. Create users with EVALUATOR role first."
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Saving...' : editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingEvent?.name}&quot;? This
              action will soft-delete the event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button
              disabled={submitting}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
