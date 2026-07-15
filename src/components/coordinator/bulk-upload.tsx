'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface AssignedEvent {
  id: string;
  name: string;
  eventType: 'TEAM' | 'INDIVIDUAL';
}

interface UploadResult {
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

export function BulkUpload({ defaultEventId }: { defaultEventId?: string }) {
  const token = useAuthStore((s) => s.token);
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId || '');
  const [loading, setLoading] = useState(true);

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
      console.error('Failed to load panels', e);
    }
  }, [selectedEventId, token, selectedPanelId]);

  useEffect(() => {
    loadPanels();
  }, [selectedEventId]);


  useEffect(() => {
    if (defaultEventId) {
      setSelectedEventId(defaultEventId);
    }
  }, [defaultEventId]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'confirm-cancel' | 'cancelling' | 'cancelled' | 'success' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const createdTeamIds = useRef<string[]>([]);
  const createdParticipantIds = useRef<string[]>([]);
  const isCancelledRef = useRef<boolean>(false);

  // Disable page closing/reloading and block focus transitions during upload
  useEffect(() => {
    if (uploadState !== 'uploading' && uploadState !== 'confirm-cancel' && uploadState !== 'cancelling') return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [uploadState]);

  const performCleanup = async () => {
    try {
      await fetch('/api/bulk-upload/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamIds: createdTeamIds.current,
          participantIds: createdParticipantIds.current,
        }),
      });
    } catch (e) {
      console.error('Cleanup failed:', e);
    }
  };

  const handleCancelClick = () => {
    setUploadState('confirm-cancel');
  };

  const handleContinueUpload = () => {
    setUploadState('uploading');
  };

  const handleConfirmCancel = async () => {
    setUploadState('cancelling');
    isCancelledRef.current = true;
    setCurrentStatus('Cancelling upload and cleaning up database...');
    await performCleanup();
    setUploadState('cancelled');
    toast.info('Upload cancelled successfully');
  };

  const handleCloseModal = () => {
    setUploadState('idle');
    setUploading(false);
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadResult(null);
  };

  const handleRetryUpload = () => {
    handleUpload();
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

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

  const validateAndSetFile = (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const validExtensions = ['.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
    toast.success(`File "${file.name}" selected`);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedEventId || !selectedPanelId) {
      toast.error('Please select an event, panel, and file');
      return;
    }

    setUploading(true);
    setCurrentStatus('Checking event status...');

    try {
      const checkRes = await fetch(`/api/events/${selectedEventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.success && checkData.data) {
          const count = checkData.data._count;
          const isTeam = selectedEvent?.eventType === 'TEAM';
          const hasExisting = isTeam ? count.teams > 0 : count.participants > 0;
          if (hasExisting) {
            setShowConfirmModal(true);
            setUploading(false);
            setCurrentStatus('');
            return;
          }
        }
      }
    } catch (e) {
      console.error('Failed to check existing data:', e);
    }

    executeUpload('append');
  };

  const executeUpload = async (mode: 'replace' | 'append') => {
    setUploadState('uploading');
    setUploading(true);
    setUploadProgress(0);
    setCurrentStatus('Reading file...');
    setTimeRemaining('');
    setUploadResult(null);

    createdTeamIds.current = [];
    createdParticipantIds.current = [];
    isCancelledRef.current = false;

    try {
      if (mode === 'replace') {
        setCurrentStatus('Deleting existing event data...');
        const clearRes = await fetch('/api/bulk-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            eventId: selectedEventId,
            action: 'clear',
          }),
        });
        if (!clearRes.ok) {
          const errorData = await clearRes.json();
          throw new Error(errorData.error || 'Failed to clear existing event data');
        }
      }

      const arrayBuffer = await selectedFile!.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        toast.error('Excel file is empty');
        setUploadState('failed');
        setErrorMsg('Excel file is empty.');
        setUploading(false);
        return;
      }

      // Group/prepare items based on eventType
      let itemsToProcess: any[] = [];
      const isTeam = selectedEvent?.eventType === 'TEAM';

      if (isTeam) {
        // Pre-process rows for merged cells
        let lastTeamName = '';
        const rowsCopy = JSON.parse(JSON.stringify(rows));
        for (let i = 0; i < rowsCopy.length; i++) {
          const tName = rowsCopy[i]['Team Name']?.toString().trim();
          if (tName) {
            lastTeamName = tName;
          } else if (lastTeamName) {
            rowsCopy[i]['Team Name'] = lastTeamName;
          }
        }
        lastTeamName = '';
        for (let i = rowsCopy.length - 1; i >= 0; i--) {
          const tName = rowsCopy[i]['Team Name']?.toString().trim();
          if (tName) {
            lastTeamName = tName;
          } else if (lastTeamName) {
            rowsCopy[i]['Team Name'] = lastTeamName;
          }
        }

        const teamMap = new Map<string, any[]>();
        for (let i = 0; i < rowsCopy.length; i++) {
          const row = rowsCopy[i];
          const teamName = row['Team Name']?.toString().trim();
          const memberName = (row['Name'] || row['Participant Name'] || row['Member Name'])?.toString().trim();

          if (!teamName || !memberName) continue;

          if (!teamMap.has(teamName)) {
            teamMap.set(teamName, []);
          }

          teamMap.get(teamName)!.push({
            name: memberName,
            registerNumber: row['Register Number']?.toString().trim() || null,
            department: row['Department']?.toString().trim() || null,
            college: row['College']?.toString().trim() || null,
            contactNumber: row['Contact Number']?.toString().trim() || null,
            email: row['Email']?.toString().trim() || null,
          });
        }

        for (const [teamName, members] of teamMap) {
          itemsToProcess.push({
            name: teamName,
            members,
          });
        }
      } else {
        // Individual event format
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const participantName = (row['Name'] || row['Participant Name'] || row['Member Name'])?.toString().trim();
          if (!participantName) continue;

          itemsToProcess.push({
            name: participantName,
            registerNumber: row['Register Number']?.toString().trim() || null,
            department: row['Department']?.toString().trim() || null,
            college: row['College']?.toString().trim() || null,
            contactNumber: row['Contact Number']?.toString().trim() || null,
            email: row['Email']?.toString().trim() || null,
          });
        }
      }

      if (itemsToProcess.length === 0) {
        toast.error('No valid participants or teams found in file');
        setUploadState('failed');
        setErrorMsg('No valid participants or teams found in file.');
        setUploading(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errorsList: { row: number; message: string }[] = [];

      for (let i = 0; i < itemsToProcess.length; i++) {
        if (isCancelledRef.current) {
          break;
        }

        const item = itemsToProcess[i];
        setCurrentStatus(`Uploading "${item.name}" (${i + 1}/${itemsToProcess.length})...`);
        
        try {
          const res = await fetch('/api/bulk-upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              eventId: selectedEventId,
              type: isTeam ? 'TEAM' : 'INDIVIDUAL',
              item,
              panelId: selectedPanelId || undefined,
            }),
          });

          const resData = await res.json();
          if (res.ok && resData.success) {
            successCount += isTeam ? item.members.length : 1;
            
            // Record created IDs for rollback tracking
            if (resData.data?.createdTeamId) {
              createdTeamIds.current.push(resData.data.createdTeamId);
            }
            if (resData.data?.createdParticipantIds) {
              createdParticipantIds.current.push(...resData.data.createdParticipantIds);
            }

            setCurrentStatus(resData.data?.statusMsg || `Success: ${item.name}`);
          } else {
            errorCount += isTeam ? item.members.length : 1;
            errorsList.push({
              row: i + 2,
              message: resData.error || `Failed to process ${item.name}`,
            });
            throw new Error(resData.error || `Failed to process ${item.name}`);
          }
        } catch (e) {
          if (isCancelledRef.current) break;
          
          // Cleanup database on error to prevent partial records
          setCurrentStatus('Error encountered! Rolling back database...');
          await performCleanup();

          setErrorMsg(e instanceof Error ? e.message : 'Upload failed due to database or network error.');
          setUploadState('failed');
          setUploading(false);
          return;
        }

        // Calculate progress
        const progress = Math.round(((i + 1) / itemsToProcess.length) * 100);
        setUploadProgress(progress);
      }

      if (isCancelledRef.current) {
        return;
      }

      setUploadState('success');
      setUploadResult({
        successCount,
        errorCount,
        errors: errorsList,
      });

    } catch (error) {
      console.error(error);
      toast.error('An error occurred while parsing the file');
      setUploadState('failed');
      setErrorMsg('An error occurred while parsing the file.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = (type: 'team' | 'individual') => {
    let csvContent: string;
    let filename: string;

    if (type === 'team') {
      csvContent =
        'Team Name,Name,Department,College,Contact Number,Email\nTeam tech,John Doe,AIDS,ABC College,9876543210,abc@gmail.com\nTeam tech,Jane Smith,CSE,ABC College,9876543211,efg@gmail.com\nTeam tech,Bob Wilson,CSD,XYZ College,9876543212,hij@gmail.com';
      filename = 'team_template.csv';
    } else {
      csvContent =
        'Name,Department,College,Contact Number,Email\nJohn Doe,CS,ABC College,9876543210,john@example.com\nJane Smith,EC,XYZ College,9876543211,jane@example.com';
      filename = 'individual_template.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setUploadProgress(0);
  };

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
      {/* Event Selector & Templates */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Bulk Upload</CardTitle>
          <CardDescription>Upload participants or teams via Excel file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Event</label>
              {events.length > 1 ? (
                <Select value={selectedEventId} onValueChange={(v) => { setSelectedEventId(v); resetUpload(); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose an event..." />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}{' '}
                        <Badge variant="outline" className="ml-1 text-xs">
                          {event.eventType}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : selectedEvent ? (
                <div className="p-3 border rounded-lg bg-muted/40 font-semibold flex items-center gap-2">
                  <span>{selectedEvent.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedEvent.eventType}
                  </Badge>
                </div>
              ) : (
                <div className="p-3 border rounded-lg bg-muted/40 text-muted-foreground text-sm italic">
                  No event available
                </div>
              )}
            </div>

            {selectedEventId && panels.length > 1 && (
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Select Panel *</label>
                  <Select value={selectedPanelId} onValueChange={setSelectedPanelId}>
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
              </div>
            )}
            {selectedEventId && panels.length === 1 && (
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Panel</label>
                <div className="h-9 px-3 border rounded-md bg-muted/40 flex items-center text-sm font-semibold">
                  {panels[0].name}
                </div>
              </div>
            )}
          </div>

          {selectedEvent && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => handleDownloadTemplate('team')}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Team Template
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownloadTemplate('individual')}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Individual Template
              </Button>
            </div>
          )}

          {selectedEvent && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  This event uses <strong>{selectedEvent.eventType}</strong> format. Please use the{' '}
                  <strong>{selectedEvent.eventType === 'TEAM' ? 'Team' : 'Individual'}</strong>{' '}
                  template for bulk upload.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Upload Zone */}
      {selectedEventId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Upload File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                  dragOver
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : selectedFile
                      ? 'border-emerald-300 bg-emerald-50/30 dark:border-emerald-700 dark:bg-emerald-950/10'
                      : 'border-muted-foreground/25 hover:border-emerald-400'
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={uploading}
                />
                <AnimatePresence mode="wait">
                  {selectedFile ? (
                    <motion.div
                      key="selected"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-2"
                    >
                      <FileSpreadsheet className="mx-auto h-10 w-10 text-emerald-600" />
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-2"
                    >
                      <Upload className="mx-auto h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm font-medium">
                        Drag & drop your Excel file here
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse (.xlsx, .xls)
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>



              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
                {selectedFile && !uploading && (
                  <Button variant="outline" onClick={resetUpload}>
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Upload Results */}
      <AnimatePresence>
        {uploadResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Upload Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {uploadResult.successCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Records Imported</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {uploadResult.errorCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Errors</p>
                    </div>
                  </div>
                </div>

                {uploadResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Error Details</h4>
                    <div className="max-h-48 overflow-y-auto rounded-lg border">
                      <style jsx>{`
                        div::-webkit-scrollbar { width: 6px; }
                        div::-webkit-scrollbar-track { background: transparent; }
                        div::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
                      `}</style>
                      <div className="divide-y">
                        {uploadResult.errors.map((err, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 p-2.5 text-xs"
                          >
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                            <span>
                              {err.row > 0 && (
                                <span className="font-medium">Row {err.row}: </span>
                              )}
                              {err.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Upload Progress Modal Popup */}
      {uploadState !== 'idle' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground p-6 rounded-xl shadow-2xl max-w-md w-full border border-muted space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            {uploadState === 'uploading' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600 shrink-0" />
                  <h3 className="text-lg font-bold">Uploading your file...</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Please wait a few minutes while your file is being uploaded and processed.
                </p>
                
                {/* Progress Indicator */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-emerald-600">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  {currentStatus && (
                    <p className="text-xs text-muted-foreground italic truncate">
                      {currentStatus}
                    </p>
                  )}
                </div>

                {/* Warning message */}
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>⚠️ Important</span>
                  </div>
                  <ul className="text-xs text-amber-700 dark:text-amber-400/90 list-disc pl-4 space-y-1">
                    <li>Do not refresh or close this page while the upload is in progress.</li>
                    <li>Interrupting the upload may result in incomplete or corrupted data.</li>
                    <li>Please wait until the upload is completed successfully.</li>
                    <li>During the upload, access to the rest of the portal is temporarily disabled to protect data integrity.</li>
                  </ul>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleCancelClick} className="text-destructive hover:bg-destructive/10">
                    Cancel Upload
                  </Button>
                </div>
              </div>
            )}

            {uploadState === 'confirm-cancel' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-destructive">Cancel Upload?</h3>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to cancel this upload?
                </p>
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-xs space-y-1.5 text-red-800 dark:text-red-400">
                  <p className="font-bold">Cancelling the upload will:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Stop the upload immediately.</li>
                    <li>Remove any partially uploaded data.</li>
                    <li>Delete any temporary files or incomplete records created during this upload.</li>
                    <li>Prevent incomplete or corrupted data from being saved.</li>
                  </ul>
                  <p className="font-bold mt-1">This action cannot be undone.</p>
                </div>
                <div className="flex justify-end gap-2.5 pt-2">
                  <Button variant="outline" size="sm" onClick={handleContinueUpload}>
                    Continue Upload
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleConfirmCancel}>
                    Yes, Cancel Upload
                  </Button>
                </div>
              </div>
            )}

            {uploadState === 'cancelling' && (
              <div className="space-y-4 text-center py-6">
                <Loader2 className="h-10 w-10 animate-spin text-destructive mx-auto" />
                <h3 className="text-lg font-bold">Cancelling upload...</h3>
                <p className="text-sm text-muted-foreground">
                  Cleaning up temporary data and rolling back database changes. Please wait...
                </p>
              </div>
            )}

            {uploadState === 'cancelled' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-amber-600">
                  <AlertCircle className="h-6 w-6 shrink-0" />
                  <h3 className="text-lg font-bold text-foreground">Upload Cancelled</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your upload has been cancelled successfully.
                </p>
                <p className="text-sm text-muted-foreground font-semibold">
                  Any partially uploaded files and temporary data have been removed.
                </p>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleCloseModal} className="bg-emerald-600 hover:bg-emerald-700">
                    Close
                  </Button>
                </div>
              </div>
            )}

            {uploadState === 'success' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                  <h3 className="text-lg font-bold text-foreground">Upload Completed</h3>
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  Your file has been uploaded and processed successfully.
                </p>
                {uploadResult && (
                  <div className="p-3 bg-muted/30 border rounded-lg text-xs space-y-1">
                    <p><strong>Total Teams/Participants:</strong> {uploadResult.successCount}</p>
                    <p><strong>Errors encountered:</strong> {uploadResult.errorCount}</p>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <Button onClick={handleCloseModal} className="bg-emerald-600 hover:bg-emerald-700">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {uploadState === 'failed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-destructive">
                  <XCircle className="h-6 w-6 shrink-0" />
                  <h3 className="text-lg font-bold text-foreground">Upload Failed</h3>
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  Something went wrong while uploading your file.
                </p>
                {errorMsg && (
                  <p className="p-2.5 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20 font-medium">
                    {errorMsg}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  All temporary data and partial database records have been rolled back and cleaned up.
                </p>
                <div className="flex justify-end gap-2.5 pt-2">
                  <Button variant="outline" onClick={handleCloseModal}>
                    Close
                  </Button>
                  <Button onClick={handleRetryUpload} className="bg-emerald-600 hover:bg-emerald-700">
                    Retry Upload
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Data Warning Dialog */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Existing Data Detected
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-muted-foreground leading-relaxed">
              This event already has registered {selectedEvent?.eventType === 'TEAM' ? 'teams' : 'participants'}.
              Choose how you would like to proceed with the upload:
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <button
              onClick={() => {
                setShowConfirmModal(false);
                executeUpload('replace');
              }}
              className="flex flex-col text-left p-3.5 rounded-xl border border-muted hover:border-red-500 hover:bg-red-50/10 transition-all duration-200 group bg-card"
            >
              <span className="font-bold text-foreground group-hover:text-red-600 transition-colors text-sm">
                Replace Existing
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Deletes all existing {selectedEvent?.eventType === 'TEAM' ? 'teams' : 'participants'} and their evaluations/scores for this event, and uploads the new data.
              </span>
            </button>
            <button
              onClick={() => {
                setShowConfirmModal(false);
                executeUpload('append');
              }}
              className="flex flex-col text-left p-3.5 rounded-xl border border-muted hover:border-emerald-500 hover:bg-emerald-50/10 transition-all duration-200 group bg-card"
            >
              <span className="font-bold text-foreground group-hover:text-emerald-600 transition-colors text-sm">
                Append
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Keeps the existing records and adds the new ones alongside them.
              </span>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="w-full sm:w-auto">
              Cancel Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
