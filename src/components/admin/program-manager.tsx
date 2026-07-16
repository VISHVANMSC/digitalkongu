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
  Archive,
  MoreHorizontal,
  ArrowUpDown,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  description: string | null;
  venue: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  createdAt: string;
  _count?: { events: number };
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  ARCHIVED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  DELETED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function ProgramManager() {
  const token = useAuthStore((s) => s.token);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<Program | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [confirmNameInput, setConfirmNameInput] = useState('');

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVenue, setFormVenue] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  const fetchPrograms = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/programs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPrograms(data.data);
      }
    } catch {
      toast.error('Failed to fetch programs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchPrograms();
  }, [token, fetchPrograms]);

  const toDateTimeLocalString = (dateInput: any) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormVenue('');
    setFormStartDate('');
    setFormEndDate('');
    setEditingProgram(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (program: Program) => {
    setEditingProgram(program);
    setFormName(program.name);
    setFormDescription(program.description || '');
    setFormVenue(program.venue || '');
    setFormStartDate(program.startDate ? toDateTimeLocalString(program.startDate) : '');
    setFormEndDate(program.endDate ? toDateTimeLocalString(program.endDate) : '');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Program name is required');
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        venue: formVenue.trim() || undefined,
        startDate: formStartDate ? new Date(formStartDate).toISOString() : undefined,
        endDate: formEndDate ? new Date(formEndDate).toISOString() : undefined,
      };

      const url = editingProgram ? `/api/programs/${editingProgram.id}` : '/api/programs';
      const method = editingProgram ? 'PUT' : 'POST';

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
        toast.success(editingProgram ? 'Program updated' : 'Program created');
        setDialogOpen(false);
        resetForm();
        fetchPrograms(true);
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
    if (!deletingProgram) return;
    if (confirmNameInput !== deletingProgram.name) {
      toast.error('Program name does not match');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/programs/${deletingProgram.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Program permanently deleted');
        fetchPrograms(true);
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
      setDeleteDialogOpen(false);
      setDeletingProgram(null);
      setDeleteStep(1);
      setConfirmNameInput('');
    }
  };

  const handleArchive = async (program: Program) => {
    try {
      const res = await fetch(`/api/programs/${program.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: program.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          program.status === 'ARCHIVED' ? 'Program restored' : 'Program archived'
        );
        fetchPrograms(true);
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch {
      toast.error('An error occurred');
    }
  };

  const filteredPrograms = useMemo(() => {
    let result = programs;
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }
    return result;
  }, [programs, statusFilter]);

  const columns: ColumnDef<Program>[] = useMemo(
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
        accessorKey: 'venue',
        header: 'Venue',
        cell: ({ row }) => {
          const venue = row.getValue('venue') as string | null;
          return venue ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {venue}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: 'startDate',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Start Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = row.getValue('startDate') as string | null;
          return date ? (
            <div className="flex items-center gap-1.5 text-sm">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {new Date(date).toLocaleString()}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: 'endDate',
        header: 'End Date',
        cell: ({ row }) => {
          const date = row.getValue('endDate') as string | null;
          return date ? new Date(date).toLocaleString() : '—';
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
          const program = row.original;
          if (program.status === 'DELETED') return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(program)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleArchive(program)}>
                  <Archive className="mr-2 h-4 w-4" />
                  {program.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    setDeletingProgram(program);
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
    data: filteredPrograms,
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
              <CardTitle className="text-xl">Programs</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage event programs
              </p>
            </div>
            <Button onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              New Program
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'ACTIVE', 'ARCHIVED'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className={
                    statusFilter === status
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : ''
                  }
                >
                  {status === 'all' ? 'All' : status}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && programs.length === 0 ? (
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
                        No programs found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">
                  {table.getFilteredRowModel().rows.length} program(s) total
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProgram ? 'Edit Program' : 'Create Program'}
            </DialogTitle>
            <DialogDescription>
              {editingProgram
                ? 'Update program details below.'
                : 'Fill in the details to create a new program.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Program name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Program description"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                value={formVenue}
                onChange={(e) => setFormVenue(e.target.value)}
                placeholder="Event venue"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
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
              {submitting ? 'Saving...' : editingProgram ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setDeleteStep(1);
          setConfirmNameInput('');
          setDeletingProgram(null);
        }
      }}>
        <AlertDialogContent>
          {deleteStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 dark:text-red-400">
                  Delete Program (Step 1 of 2)
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 pt-2 text-muted-foreground text-sm">
                    <span className="block font-medium text-foreground">
                      Are you sure you want to delete &quot;{deletingProgram?.name}&quot;?
                    </span>
                    <span className="block text-sm text-red-700 dark:text-red-400 border-l-2 border-red-500 pl-3 bg-red-50/50 dark:bg-red-950/20 py-2 rounded">
                      <strong>WARNING:</strong> This is a permanent action. Deleting this program will automatically cascade delete all associated events, participant registrations, teams, evaluations, and scores. This cannot be undone.
                    </span>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeletingProgram(null);
                }}>Cancel</AlertDialogCancel>
                <Button
                  onClick={() => setDeleteStep(2)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Understand & Proceed
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 dark:text-red-400">
                  Confirm Permanent Deletion (Step 2 of 2)
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4 pt-2 text-muted-foreground text-sm">
                    <span className="block text-sm">
                      To confirm deletion, please type the program name exactly:
                      <strong className="block text-foreground mt-1 select-all font-mono bg-muted p-2 rounded border border-input text-center text-base">
                        {deletingProgram?.name}
                      </strong>
                    </span>
                    <div className="space-y-1.5 mt-2">
                      <Input
                        placeholder="Type program name here"
                        value={confirmNameInput}
                        onChange={(e) => setConfirmNameInput(e.target.value)}
                        className="h-10 border-red-200 dark:border-red-900 focus-visible:ring-red-500 font-medium text-center"
                        autoFocus
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteStep(1);
                  setConfirmNameInput('');
                  setDeletingProgram(null);
                }}>Cancel</AlertDialogCancel>
                <Button
                  onClick={handleDelete}
                  disabled={submitting || confirmNameInput !== deletingProgram?.name}
                  className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Deleting...' : 'Permanently Delete All Data'}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
