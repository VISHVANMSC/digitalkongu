'use client';

import { useCallback, useEffect, useState } from 'react';
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

export function BulkUpload() {
  const token = useAuthStore((s) => s.token);
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

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
          if (data.success) setEvents(data.data);
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
    if (!selectedFile || !selectedEventId) {
      toast.error('Please select an event and file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('eventId', selectedEventId);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const res = await fetch('/api/bulk-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();

      if (data.success) {
        setUploadResult(data.data);
        toast.success(
          `Upload complete: ${data.data.successCount} records imported, ${data.data.errorCount} errors`
        );
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed. Please try again.');
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
            </div>
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

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Uploading...</span>
                    <span className="font-medium text-emerald-600">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

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
    </div>
  );
}
