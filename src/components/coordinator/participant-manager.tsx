'use client';

import { useCallback, useEffect, useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  User,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  X,
  Upload,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

// Types
interface AssignedEvent {
  id: string;
  name: string;
  eventType: 'TEAM' | 'INDIVIDUAL';
}

interface Participant {
  id: string;
  name: string;
  registerNumber: string | null;
  department: string | null;
  college: string | null;
  contactNumber: string | null;
  email: string | null;
  teamId: string | null;
  team: { id: string; name: string } | null;
  event: { id: string; name: string; eventType: string };
}

interface Team {
  id: string;
  name: string;
  college: string | null;
  eventId: string;
  event: { id: string; name: string; eventType: string };
  _count: { members: number; evaluations: number };
  members?: Participant[];
}

interface MemberFormData {
  name: string;
  registerNumber: string;
  department: string;
  college: string;
  contactNumber: string;
  email: string;
}

const emptyMember: MemberFormData = {
  name: '',
  registerNumber: '',
  department: '',
  college: '',
  contactNumber: '',
  email: '',
};

export function ParticipantManager({ defaultEventId }: { defaultEventId?: string }) {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const hasEditRights = currentUser?.role === 'ADMIN' || currentUser?.canEdit === true;

  // State
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId || '');

  useEffect(() => {
    if (defaultEventId) {
      setSelectedEventId(defaultEventId);
    }
  }, [defaultEventId]);

  const [panels, setPanels] = useState<any[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');

  const loadPanels = useCallback(async () => {
    if (!selectedEventId || !token) {
      setPanels([]);
      setSelectedPanelId('');
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
          if (data.data.length > 0 && !data.data.some((p: any) => p.id === selectedPanelId)) {
            setSelectedPanelId(data.data[0].id);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedEventId, token, selectedPanelId]);

  useEffect(() => {
    loadPanels();
  }, [selectedEventId]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Record<string, Participant[]>>({});
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  // Dialog state
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [editParticipantOpen, setEditParticipantOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewTeamOpen, setViewTeamOpen] = useState(false);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  // Form state
  const [teamForm, setTeamForm] = useState({ name: '', college: '' });
  const [teamMembersForm, setTeamMembersForm] = useState<MemberFormData[]>([{ ...emptyMember }]);
  const [participantForm, setParticipantForm] = useState({
    name: '',
    registerNumber: '',
    department: '',
    college: '',
    contactNumber: '',
    email: '',
  });

  // Edit targets
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [deletingItem, setDeletingItem] = useState<{
    type: 'team' | 'participant' | 'bulk-teams' | 'bulk-participants';
    id: string;
    name: string;
  } | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const isTeamEvent = selectedEvent?.eventType === 'TEAM';

  // Fetch events on mount
  useEffect(() => {
    async function fetchEvents() {
      if (!token) return;
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
    fetchEvents();
  }, [token]);

  const fetchEventData = useCallback(async () => {
    if (!selectedEventId || !token) return;
    setDataLoading(true);
    try {
      const panelParam = selectedPanelId ? `&panelId=${selectedPanelId}` : '';
      if (isTeamEvent) {
        const [teamsRes, partsRes] = await Promise.all([
          fetch(`/api/teams?eventId=${selectedEventId}${panelParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/participants?eventId=${selectedEventId}${panelParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (teamsRes.ok && partsRes.ok) {
          const teamsData = await teamsRes.json();
          const partsData = await partsRes.json();
          if (teamsData.success) setTeams(teamsData.data);
          if (partsData.success) {
            setParticipants(partsData.data);
            const mapping: Record<string, Participant[]> = {};
            partsData.data.forEach((p: Participant) => {
              if (p.teamId) {
                if (!mapping[p.teamId]) mapping[p.teamId] = [];
                mapping[p.teamId].push(p);
              }
            });
            setTeamMembers(mapping);
          }
        }
      } else {
        const res = await fetch(`/api/participants?eventId=${selectedEventId}${panelParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) setParticipants(data.data);
        }
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setDataLoading(false);
    }
  }, [selectedEventId, selectedPanelId, token, isTeamEvent]);

  // Fetch participants/teams when event or panel changes
  useEffect(() => {
    if (!selectedEventId || !token) return;
    setSelectedTeamIds([]);
    setSelectedParticipantIds([]);
    fetchEventData();
  }, [selectedEventId, selectedPanelId, token, fetchEventData]);

  // Reset selections when viewMode changes
  useEffect(() => {
    setSelectedTeamIds([]);
    setSelectedParticipantIds([]);
  }, [viewMode]);

  const fetchTeamMembers = async (teamId: string) => {
    if (!token || teamMembers[teamId]) return;
    try {
      const panelParam = selectedPanelId ? `&panelId=${selectedPanelId}` : '';
      const res = await fetch(`/api/participants?eventId=${selectedEventId}${panelParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const members = data.data.filter((p: Participant) => p.teamId === teamId);
          setTeamMembers((prev) => ({ ...prev, [teamId]: members }));
        }
      }
    } catch {
      // silent
    }
  };

  const toggleTeamExpand = (teamId: string) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null);
    } else {
      setExpandedTeamId(teamId);
      fetchTeamMembers(teamId);
    }
  };

  // Team CRUD
  const handleAddTeam = async () => {
    if (!token || !selectedEventId || !teamForm.name) {
      toast.error('Team name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId: selectedEventId,
          name: teamForm.name,
          college: teamForm.college || null,
          panelId: selectedPanelId || null,
          members: teamMembersForm
            .filter((m) => m.name.trim())
            .map((m) => ({
              name: m.name,
              registerNumber: m.registerNumber || null,
              department: m.department || null,
              college: m.college || teamForm.college || null,
              contactNumber: m.contactNumber || null,
              email: m.email || null,
            })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Team created successfully');
        setAddTeamOpen(false);
        resetTeamForm();
        fetchEventData();
      } else {
        toast.error(data.error || 'Failed to create team');
      }
    } catch {
      toast.error('Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTeam = async () => {
    if (!token || !editingTeam || !teamForm.name) {
      toast.error('Team name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: teamForm.name,
          college: teamForm.college || null,
          members: teamMembersForm
            .filter((m) => m.name.trim())
            .map((m) => ({
              name: m.name,
              registerNumber: m.registerNumber || null,
              department: m.department || null,
              college: m.college || teamForm.college || null,
              contactNumber: m.contactNumber || null,
              email: m.email || null,
            })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Team updated successfully');
        setEditTeamOpen(false);
        setEditingTeam(null);
        resetTeamForm();
        fetchEventData();
        setTeamMembers({});
      } else {
        toast.error(data.error || 'Failed to update team');
      }
    } catch {
      toast.error('Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!token || !deletingItem) return;
    setSaving(true);
    try {
      if (deletingItem.type === 'bulk-teams') {
        const res = await fetch('/api/teams', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids: selectedTeamIds }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Selected teams deleted successfully');
          setSelectedTeamIds([]);
          setDeleteDialogOpen(false);
          setDeletingItem(null);
          fetchEventData();
          setTeamMembers({});
        } else {
          toast.error(data.error || 'Failed to delete selected teams');
        }
      } else if (deletingItem.type === 'bulk-participants') {
        const res = await fetch('/api/participants', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids: selectedParticipantIds }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Selected participants deleted successfully');
          setSelectedParticipantIds([]);
          setDeleteDialogOpen(false);
          setDeletingItem(null);
          fetchEventData();
        } else {
          toast.error(data.error || 'Failed to delete selected participants');
        }
      } else {
        const endpoint =
          deletingItem.type === 'team'
            ? `/api/teams/${deletingItem.id}`
            : `/api/participants/${deletingItem.id}`;
        const res = await fetch(endpoint, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          toast.success(
            `${deletingItem.type === 'team' ? 'Team' : 'Participant'} deleted successfully`
          );
          if (deletingItem.type === 'team') {
            setSelectedTeamIds(selectedTeamIds.filter((id) => id !== deletingItem.id));
          } else {
            setSelectedParticipantIds(selectedParticipantIds.filter((id) => id !== deletingItem.id));
          }
          setDeleteDialogOpen(false);
          setDeletingItem(null);
          fetchEventData();
          setTeamMembers({});
        } else {
          toast.error(data.error || 'Failed to delete');
        }
      }
    } catch {
      toast.error('Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  // Participant CRUD
  const handleAddParticipant = async () => {
    if (!token || !selectedEventId || !participantForm.name) {
      toast.error('Participant name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId: selectedEventId,
          ...participantForm,
          panelId: selectedPanelId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Participant added successfully');
        setAddParticipantOpen(false);
        resetParticipantForm();
        fetchEventData();
      } else {
        toast.error(data.error || 'Failed to add participant');
      }
    } catch {
      toast.error('Failed to add participant');
    } finally {
      setSaving(false);
    }
  };

  const handleEditParticipant = async () => {
    if (!token || !editingParticipant || !participantForm.name) {
      toast.error('Participant name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/participants/${editingParticipant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(participantForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Participant updated successfully');
        setEditParticipantOpen(false);
        setEditingParticipant(null);
        resetParticipantForm();
        fetchEventData();
      } else {
        toast.error(data.error || 'Failed to update participant');
      }
    } catch {
      toast.error('Failed to update participant');
    } finally {
      setSaving(false);
    }
  };

  // Form helpers
  const resetTeamForm = () => {
    setTeamForm({ name: '', college: '' });
    setTeamMembersForm([{ ...emptyMember }]);
  };

  const resetParticipantForm = () => {
    setParticipantForm({
      name: '',
      registerNumber: '',
      department: '',
      college: '',
      contactNumber: '',
      email: '',
    });
  };

  const openViewTeam = async (team: Team) => {
    setViewingTeam(team);
    setViewTeamOpen(true);
    
    // Fetch members if not already loaded
    if (!teamMembers[team.id]) {
      try {
        const res = await fetch(`/api/participants?eventId=${selectedEventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const members = data.data.filter((p: Participant) => p.teamId === team.id);
            setTeamMembers((prev) => ({ ...prev, [team.id]: members }));
          }
        }
      } catch {
        // silent
      }
    }
  };

  const openEditTeam = async (team: Team) => {
    setEditingTeam(team);
    setTeamForm({ name: team.name, college: team.college || '' });
    
    let members = teamMembers[team.id];
    if (!members) {
      try {
        const res = await fetch(`/api/participants?eventId=${selectedEventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            members = data.data.filter((p: Participant) => p.teamId === team.id);
            setTeamMembers((prev) => ({ ...prev, [team.id]: members }));
          }
        }
      } catch {
        // silent
      }
    }
    
    if (members && members.length > 0) {
      setTeamMembersForm(
        members.map((m) => ({
          name: m.name,
          registerNumber: m.registerNumber || '',
          department: m.department || '',
          college: m.college || '',
          contactNumber: m.contactNumber || '',
          email: m.email || '',
        }))
      );
    } else {
      setTeamMembersForm([{ ...emptyMember }]);
    }
    setEditTeamOpen(true);
  };

  const openEditParticipant = (p: Participant) => {
    setEditingParticipant(p);
    setParticipantForm({
      name: p.name,
      registerNumber: p.registerNumber || '',
      department: p.department || '',
      college: p.college || '',
      contactNumber: p.contactNumber || '',
      email: p.email || '',
    });
    setEditParticipantOpen(true);
  };

  const addMemberField = () => {
    setTeamMembersForm([...teamMembersForm, { ...emptyMember }]);
  };

  const removeMemberField = (index: number) => {
    setTeamMembersForm(teamMembersForm.filter((_, i) => i !== index));
  };

  const updateMemberField = (index: number, field: keyof MemberFormData, value: string) => {
    const updated = [...teamMembersForm];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembersForm(updated);
  };

  // Filtered data
  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.college || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (teamMembers[t.id] || []).some((m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.college || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.team?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Event Selector & Actions */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Participant Manager</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {events.length > 1 ? (
                <Select
                  value={selectedEventId}
                  onValueChange={(v) => {
                    setSelectedEventId(v);
                    setSearchQuery('');
                    setExpandedTeamId(null);
                    setTeamMembers({});
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select event..." />
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

              {selectedEventId && panels.length > 1 && (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedPanelId}
                    onValueChange={(v) => {
                      setSelectedPanelId(v);
                      setSearchQuery('');
                      setExpandedTeamId(null);
                      setTeamMembers({});
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select panel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {panels.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedEventId && panels.length === 1 && (
                <Badge variant="outline" className="text-sm font-semibold px-3 py-1.5 bg-muted/40">
                  {panels[0].name}
                </Badge>
              )}
              {selectedEventId && hasEditRights && (
                <div className="flex items-center gap-2">
                  {((viewMode === 'grouped' && selectedTeamIds.length > 0) ||
                    (viewMode === 'flat' && selectedParticipantIds.length > 0) ||
                    (!isTeamEvent && selectedParticipantIds.length > 0)) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeletingItem({
                          type: viewMode === 'grouped' ? 'bulk-teams' : 'bulk-participants',
                          id: '',
                          name: viewMode === 'grouped'
                            ? `${selectedTeamIds.length} selected teams`
                            : `${selectedParticipantIds.length} selected participants`,
                        });
                        setDeleteDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Selected ({viewMode === 'grouped' ? selectedTeamIds.length : selectedParticipantIds.length})
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      if (isTeamEvent) {
                        resetTeamForm();
                        setAddTeamOpen(true);
                      } else {
                        resetParticipantForm();
                        setAddParticipantOpen(true);
                      }
                    }}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add {isTeamEvent ? 'Team' : 'Participant'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        {selectedEventId && (
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={
                    isTeamEvent
                      ? viewMode === 'grouped'
                        ? 'Search teams (by name, college, or members)...'
                        : 'Search participants (by name, team, college)...'
                      : 'Search participants...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isTeamEvent && (
                  <div className="flex rounded-lg border p-0.5 bg-muted">
                    <Button
                      variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grouped')}
                      className={`h-7 px-3 text-xs ${viewMode === 'grouped' ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-600' : ''}`}
                    >
                      <Users className="mr-1.5 h-3.5 w-3.5" />
                      Grouped by Team
                    </Button>
                    <Button
                      variant={viewMode === 'flat' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('flat')}
                      className={`h-7 px-3 text-xs ${viewMode === 'flat' ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-600' : ''}`}
                    >
                      <User className="mr-1.5 h-3.5 w-3.5" />
                      All Participants
                    </Button>
                  </div>
                )}
                <Badge variant="outline" className="h-8 shrink-0">
                  {isTeamEvent ? (
                    <>
                      <Users className="mr-1 h-3 w-3" /> Team Event
                    </>
                  ) : (
                    <>
                      <User className="mr-1 h-3 w-3" /> Individual Event
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Data Table */}
      {selectedEventId && (
        <Card className="shadow-md">
          <CardContent className="p-0">
            {dataLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </div>
            ) : isTeamEvent ? (
              viewMode === 'grouped' ? (
                // Team View (Grouped)
                filteredTeams.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {searchQuery ? 'No teams match your search' : 'No teams registered yet'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        {hasEditRights && (
                          <TableHead className="w-8">
                            <Checkbox
                              checked={
                                filteredTeams.length > 0 &&
                                filteredTeams.every((t) => selectedTeamIds.includes(t.id))
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedTeamIds(filteredTeams.map((t) => t.id));
                                } else {
                                  setSelectedTeamIds([]);
                                }
                              }}
                            />
                          </TableHead>
                        )}
                        <TableHead>Team Name</TableHead>
                        <TableHead>College</TableHead>
                        <TableHead className="text-center">Members</TableHead>
                        <TableHead className="text-center">Evaluations</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeams.map((team) => (
                        <Fragment key={team.id}>
                          <TableRow key={team.id} className="group">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleTeamExpand(team.id)}
                              >
                                {expandedTeamId === team.id ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            {hasEditRights && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedTeamIds.includes(team.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedTeamIds([...selectedTeamIds, team.id]);
                                    } else {
                                      setSelectedTeamIds(selectedTeamIds.filter((id) => id !== team.id));
                                    }
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium">{team.name}</TableCell>
                            <TableCell>{team.college || '-'}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{team._count.members}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{team._count.evaluations}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => openViewTeam(team)}
                                  title="View Team Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {hasEditRights && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => openEditTeam(team)}
                                      title="Edit Team"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => {
                                        setDeletingItem({
                                          type: 'team',
                                          id: team.id,
                                          name: team.name,
                                        });
                                        setDeleteDialogOpen(true);
                                      }}
                                      title="Delete Team"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expanded Members */}
                          <AnimatePresence>
                            {expandedTeamId === team.id && (
                              <motion.tr
                                key={`members-${team.id}`}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="border-0"
                              >
                                <TableCell colSpan={7} className="bg-muted/30 p-0">
                                  <div className="px-12 py-3">
                                    {teamMembers[team.id] ? (
                                      teamMembers[team.id].length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                          No members found
                                        </p>
                                      ) : (
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Name</TableHead>
                                              <TableHead>Team Name</TableHead>
                                              <TableHead>Department</TableHead>
                                              <TableHead>Contact</TableHead>
                                              <TableHead>Email</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {teamMembers[team.id].map((member) => (
                                              <TableRow key={member.id}>
                                                <TableCell className="text-xs font-medium">
                                                  {member.name}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-medium">
                                                  {team.name}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                  {member.department || '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                  {member.contactNumber || '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                  {member.email || '-'}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      )
                                    ) : (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Loading members...
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : (
                // Flat View (All Participants)
                filteredParticipants.length === 0 ? (
                  <div className="py-12 text-center">
                    <User className="mx-auto h-12 w-12 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {searchQuery ? 'No participants match your search' : 'No participants registered yet'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {hasEditRights && (
                            <TableHead className="w-8">
                              <Checkbox
                                checked={
                                  filteredParticipants.length > 0 &&
                                  filteredParticipants.every((p) => selectedParticipantIds.includes(p.id))
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedParticipantIds(filteredParticipants.map((p) => p.id));
                                  } else {
                                    setSelectedParticipantIds([]);
                                  }
                                }}
                              />
                            </TableHead>
                          )}
                          <TableHead>Name</TableHead>
                          <TableHead>Team Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>College</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredParticipants.map((p) => (
                          <TableRow key={p.id} className="group">
                            {hasEditRights && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedParticipantIds.includes(p.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedParticipantIds([...selectedParticipantIds, p.id]);
                                    } else {
                                      setSelectedParticipantIds(selectedParticipantIds.filter((id) => id !== p.id));
                                    }
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                              {p.team?.name || '-'}
                            </TableCell>
                            <TableCell>{p.department || '-'}</TableCell>
                            <TableCell>{p.college || '-'}</TableCell>
                            <TableCell>{p.contactNumber || '-'}</TableCell>
                            <TableCell>{p.email || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                {hasEditRights && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => openEditParticipant(p)}
                                      title="Edit Participant"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => {
                                        setDeletingItem({
                                          type: 'participant',
                                          id: p.id,
                                          name: p.name,
                                        });
                                        setDeleteDialogOpen(true);
                                      }}
                                      title="Delete Participant"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )
            ) : // Individual View
            filteredParticipants.length === 0 ? (
              <div className="py-12 text-center">
                <User className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery ? 'No participants match your search' : 'No participants registered yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {hasEditRights && (
                        <TableHead className="w-8">
                          <Checkbox
                            checked={
                              filteredParticipants.length > 0 &&
                              filteredParticipants.every((p) => selectedParticipantIds.includes(p.id))
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedParticipantIds(filteredParticipants.map((p) => p.id));
                              } else {
                                setSelectedParticipantIds([]);
                              }
                            }}
                          />
                        </TableHead>
                      )}
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>College</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.map((p) => (
                      <TableRow key={p.id} className="group">
                        {hasEditRights && (
                          <TableCell>
                            <Checkbox
                              checked={selectedParticipantIds.includes(p.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedParticipantIds([...selectedParticipantIds, p.id]);
                                } else {
                                  setSelectedParticipantIds(selectedParticipantIds.filter((id) => id !== p.id));
                                }
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.department || '-'}</TableCell>
                        <TableCell>{p.college || '-'}</TableCell>
                        <TableCell>{p.contactNumber || '-'}</TableCell>
                        <TableCell>{p.email || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditParticipant(p)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeletingItem({
                                  type: 'participant',
                                  id: p.id,
                                  name: p.name,
                                });
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No event selected */}
      {!selectedEventId && !loading && (
        <Card className="shadow-md">
          <CardContent className="py-12 text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Select an event to manage participants
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add Team Dialog */}
      <Dialog open={addTeamOpen} onOpenChange={setAddTeamOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Team</DialogTitle>
            <DialogDescription>Create a team and add members</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Team Name *</Label>
                <Input
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="Enter team name"
                />
              </div>
              <div className="space-y-2">
                <Label>College</Label>
                <Input
                  value={teamForm.college}
                  onChange={(e) => setTeamForm({ ...teamForm, college: e.target.value })}
                  placeholder="Enter college"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Members</Label>
                <Button variant="outline" size="sm" onClick={addMemberField} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Member
                </Button>
              </div>
              {teamMembersForm.map((member, index) => (
                <div
                  key={index}
                  className="rounded-lg border bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Member {index + 1}
                    </span>
                    {teamMembersForm.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => removeMemberField(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Name *"
                      value={member.name}
                      onChange={(e) => updateMemberField(index, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Department"
                      value={member.department}
                      onChange={(e) => updateMemberField(index, 'department', e.target.value)}
                    />
                    <Input
                      placeholder="College"
                      value={member.college}
                      onChange={(e) => updateMemberField(index, 'college', e.target.value)}
                    />
                    <Input
                      placeholder="Contact Number"
                      value={member.contactNumber}
                      onChange={(e) =>
                        updateMemberField(index, 'contactNumber', e.target.value)
                      }
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={member.email}
                      onChange={(e) => updateMemberField(index, 'email', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTeamOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTeam}
              disabled={saving || !teamForm.name}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={editTeamOpen} onOpenChange={setEditTeamOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update team details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Team Name *</Label>
                <Input
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>College</Label>
                <Input
                  value={teamForm.college}
                  onChange={(e) => setTeamForm({ ...teamForm, college: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Members (will replace existing)</Label>
                <Button variant="outline" size="sm" onClick={addMemberField} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Member
                </Button>
              </div>
              {teamMembersForm.map((member, index) => (
                <div
                  key={index}
                  className="rounded-lg border bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Member {index + 1}
                    </span>
                    {teamMembersForm.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => removeMemberField(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Name *"
                      value={member.name}
                      onChange={(e) => updateMemberField(index, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Department"
                      value={member.department}
                      onChange={(e) => updateMemberField(index, 'department', e.target.value)}
                    />
                    <Input
                      placeholder="College"
                      value={member.college}
                      onChange={(e) => updateMemberField(index, 'college', e.target.value)}
                    />
                    <Input
                      placeholder="Contact Number"
                      value={member.contactNumber}
                      onChange={(e) =>
                        updateMemberField(index, 'contactNumber', e.target.value)
                      }
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={member.email}
                      onChange={(e) => updateMemberField(index, 'email', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTeamOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditTeam}
              disabled={saving || !teamForm.name}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Update Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Participant Dialog */}
      <Dialog open={addParticipantOpen} onOpenChange={setAddParticipantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Participant</DialogTitle>
            <DialogDescription>Register a new participant</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={participantForm.name}
                onChange={(e) =>
                  setParticipantForm({ ...participantForm, name: e.target.value })
                }
                placeholder="Participant name"
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={participantForm.department}
                onChange={(e) =>
                  setParticipantForm({
                    ...participantForm,
                    department: e.target.value,
                  })
                }
                placeholder="Department"
              />
            </div>
            <div className="space-y-2">
              <Label>College</Label>
              <Input
                value={participantForm.college}
                onChange={(e) =>
                  setParticipantForm({
                    ...participantForm,
                    college: e.target.value,
                  })
                }
                placeholder="College"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Number</Label>
              <Input
                value={participantForm.contactNumber}
                onChange={(e) =>
                  setParticipantForm({
                    ...participantForm,
                    contactNumber: e.target.value,
                  })
                }
                placeholder="Contact number"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={participantForm.email}
                onChange={(e) =>
                  setParticipantForm({ ...participantForm, email: e.target.value })
                }
                placeholder="Email address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddParticipantOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddParticipant}
              disabled={saving || !participantForm.name}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Add Participant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Participant Dialog */}
      <Dialog open={editParticipantOpen} onOpenChange={setEditParticipantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Participant</DialogTitle>
            <DialogDescription>Update participant details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={participantForm.name}
                onChange={(e) =>
                  setParticipantForm({ ...participantForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={participantForm.department}
                onChange={(e) =>
                  setParticipantForm({
                    ...participantForm,
                    department: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>College</Label>
              <Input
                value={participantForm.college}
                onChange={(e) =>
                  setParticipantForm({
                    ...participantForm,
                    college: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Number</Label>
              <Input
                value={participantForm.contactNumber}
                onChange={(e) =>
                  setParticipantForm({
                    ...participantForm,
                    contactNumber: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={participantForm.email}
                onChange={(e) =>
                  setParticipantForm({ ...participantForm, email: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditParticipantOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditParticipant}
              disabled={saving || !participantForm.name}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Update Participant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Team Details Dialog */}
      <Dialog open={viewTeamOpen} onOpenChange={setViewTeamOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Users className="size-5 text-emerald-600" />
              Team Details — {viewingTeam?.name}
            </DialogTitle>
            <DialogDescription>
              Registered college: <span className="font-semibold text-foreground">{viewingTeam?.college || '—'}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <h4 className="font-bold text-sm text-foreground">Team Members</h4>
            {viewingTeam && teamMembers[viewingTeam.id] ? (
              teamMembers[viewingTeam.id].length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No members found</p>
              ) : (
                <div className="space-y-3">
                  {teamMembers[viewingTeam.id].map((member) => (
                    <div key={member.id} className="p-3 border rounded-xl bg-muted/20 space-y-1 text-sm">
                      <div className="font-semibold text-foreground">{member.name}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <div><span className="font-semibold text-foreground">Reg No:</span> {member.registerNumber || '—'}</div>
                        <div><span className="font-semibold text-foreground">Dept:</span> {member.department || '—'}</div>
                        <div className="col-span-2"><span className="font-semibold text-foreground">Email:</span> {member.email || '—'}</div>
                        <div className="col-span-2"><span className="font-semibold text-foreground">Contact:</span> {member.contactNumber || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members...
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setViewTeamOpen(false)} className="bg-emerald-600 hover:bg-emerald-700">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {
                deletingItem?.type === 'bulk-teams'
                  ? 'Selected Teams'
                  : deletingItem?.type === 'bulk-participants'
                  ? 'Selected Participants'
                  : deletingItem?.type === 'team'
                  ? 'Team'
                  : 'Participant'
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingItem?.name}&quot;?
              {(deletingItem?.type === 'team' || deletingItem?.type === 'bulk-teams') &&
                ' This will also delete all associated team members and their evaluations.'}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
