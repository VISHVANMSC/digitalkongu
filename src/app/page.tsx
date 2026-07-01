'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Trophy,
  Upload,
  LogOut,
  Shield,
  Menu,
  X,
  FolderKanban,
  CalendarDays,
  ClipboardCheck,
  Sun,
  Moon,
  Eye,
  ChevronRight,
  Zap,
  FilePenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/authStore';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { ProgramManager } from '@/components/admin/program-manager';
import { EventManager } from '@/components/admin/event-manager';
import { UserManager } from '@/components/admin/user-manager';
import { CoordinatorDashboard } from '@/components/coordinator/coordinator-dashboard';
import { ParticipantManager } from '@/components/coordinator/participant-manager';
import { Leaderboard } from '@/components/coordinator/leaderboard';
import { BulkUpload } from '@/components/coordinator/bulk-upload';
import { EvaluatorDashboard } from '@/components/evaluator/evaluator-dashboard';
import { EvaluationForm } from '@/components/evaluator/evaluation-form';
import { EvaluationHistory } from '@/components/evaluator/evaluation-history';
import { EvaluationDrafts } from '@/components/evaluator/evaluation-drafts';
import { toast } from 'sonner';

type AdminTab = 'dashboard' | 'programs' | 'events' | 'users' | 'leaderboard';
type CoordinatorTab = 'dashboard' | 'participants' | 'leaderboard' | 'bulk-upload';
type EvaluatorTab = 'dashboard' | 'evaluate' | 'drafts' | 'history' | 'leaderboard';

const adminTabs: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'programs', label: 'Programs', icon: FolderKanban },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
];

const coordinatorTabs: { id: CoordinatorTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'bulk-upload', label: 'Bulk Upload', icon: Upload },
];

const evaluatorTabs: { id: EvaluatorTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'evaluate', label: 'Evaluate', icon: ClipboardCheck },
  { id: 'drafts', label: 'Drafts', icon: FilePenLine },
  { id: 'history', label: 'History', icon: Eye },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
];

// Custom hook to handle theme with hydration safety
function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const initialized = useRef(false);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  // Apply theme to DOM whenever isDark changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('eventforge-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Read persisted theme once on mount using a subscription pattern
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const stored = localStorage.getItem('eventforge-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = stored ? stored === 'dark' : prefersDark;
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => { setIsDark(dark); });
    }
  }, []);

  return { isDark, toggleTheme };
}

function LoginPage() {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        login(data.data.accessToken, data.data.user);
        toast.success(`Welcome back, ${data.data.user.name}!`);
      } else {
        toast.error(data.error || 'Login failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'Admin', email: 'admin@eventforge.com', password: 'admin123', color: 'from-emerald-500 to-teal-600' },
    { role: 'Coordinator', email: 'coordinator@eventforge.com', password: 'coord123', color: 'from-amber-500 to-orange-600' },
    { role: 'Evaluator', email: 'evaluator@eventforge.com', password: 'eval123', color: 'from-violet-500 to-purple-600' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">EventForge</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Left: Branding */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="hidden lg:block space-y-6"
          >
            <div className="space-y-4">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0">
                Event Management Platform
              </Badge>
              <h1 className="text-4xl font-bold leading-tight tracking-tight">
                Manage Events.
                <br />
                <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                  Evaluate Performances.
                </span>
                <br />
                Crown Champions.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                A comprehensive platform for managing programs, events, participants, 
                and evaluations with real-time leaderboards and analytics.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: FolderKanban, label: 'Programs' },
                { icon: CalendarDays, label: 'Events' },
                { icon: Users, label: 'Participants' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <item.icon className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Login Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="shadow-xl border-0 shadow-gray-200/50 dark:shadow-gray-900/50">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter your credentials to access your portal
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11"
                      autoComplete="current-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Signing in...
                      </div>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Demo Accounts</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.role}
                      onClick={() => {
                        setEmail(account.email);
                        setPassword(account.password);
                      }}
                      className="flex items-center justify-between rounded-lg border p-3 text-left transition-all hover:bg-muted/50 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${account.color}`}>
                          <span className="text-xs font-bold text-white">
                            {account.role[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{account.role}</p>
                          <p className="text-xs text-muted-foreground">{account.email}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-xs text-muted-foreground">
          EventForge &copy; {new Date().getFullYear()} — Enterprise Event Management Platform
        </p>
      </footer>
    </div>
  );
}

function AppShell() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [coordinatorTab, setCoordinatorTab] = useState<CoordinatorTab>('dashboard');
  const [evaluatorTab, setEvaluatorTab] = useState<EvaluatorTab>('dashboard');
  const [draftToEdit, setDraftToEdit] = useState<any>(null);

  useEffect(() => {
    const handleEditEvaluation = (e: Event) => {
      const customEvent = e as CustomEvent;
      setDraftToEdit(customEvent.detail);
      setEvaluatorTab('evaluate');
    };
    window.addEventListener('edit-evaluation', handleEditEvaluation);
    return () => {
      window.removeEventListener('edit-evaluation', handleEditEvaluation);
    };
  }, []);

  const role = user?.role || 'ADMIN';

  const tabs = role === 'ADMIN' ? adminTabs
    : role === 'COORDINATOR' ? coordinatorTabs
    : evaluatorTabs;

  const activeTab = role === 'ADMIN' ? adminTab
    : role === 'COORDINATOR' ? coordinatorTab
    : evaluatorTab;

  const setActiveTab = (tab: string) => {
    if (role === 'ADMIN') setAdminTab(tab as AdminTab);
    else if (role === 'COORDINATOR') setCoordinatorTab(tab as CoordinatorTab);
    else setEvaluatorTab(tab as EvaluatorTab);
    setSidebarOpen(false);
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'from-emerald-500 to-teal-600',
    COORDINATOR: 'from-amber-500 to-orange-600',
    EVALUATOR: 'from-violet-500 to-purple-600',
  };

  const roleBadgeColors: Record<string, string> = {
    ADMIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    COORDINATOR: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    EVALUATOR: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
  };

  const renderContent = () => {
    if (role === 'ADMIN') {
      switch (adminTab) {
        case 'dashboard': return <AdminDashboard />;
        case 'programs': return <ProgramManager />;
        case 'events': return <EventManager />;
        case 'users': return <UserManager />;
        case 'leaderboard': return <Leaderboard />;
      }
    } else if (role === 'COORDINATOR') {
      switch (coordinatorTab) {
        case 'dashboard': return <CoordinatorDashboard />;
        case 'participants': return <ParticipantManager />;
        case 'leaderboard': return <Leaderboard />;
        case 'bulk-upload': return <BulkUpload />;
      }
    } else {
      switch (evaluatorTab) {
        case 'dashboard': return <EvaluatorDashboard />;
        case 'evaluate': return (
          <EvaluationForm
            initialDraftToEdit={draftToEdit}
            onClearDraftToEdit={() => setDraftToEdit(null)}
          />
        );
        case 'drafts': return (
          <EvaluationDrafts
            onEditDraft={(draft) => {
              setDraftToEdit(draft);
              setEvaluatorTab('evaluate');
            }}
          />
        );
        case 'history': return <EvaluationHistory />;
        case 'leaderboard': return <Leaderboard />;
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md dark:bg-gray-900/80">
        <div className="flex h-14 items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${roleColors[role]} shadow-lg`}>
              <Zap className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">EventForge</h1>
            <Badge className={`border-0 text-xs ${roleBadgeColors[role]}`}>
              {role}
            </Badge>
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full h-8 w-8"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {isAuthenticated && user && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${roleColors[role]} text-white text-xs font-bold`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r bg-white pt-14 transition-transform duration-200 dark:bg-gray-900 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-3">
            <div className="mb-3 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${roleColors[role]} text-white`}>
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{role} Portal</p>
                </div>
              </div>
            </div>
          </div>
          <nav className="space-y-1 px-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-600"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Backdrop for mobile sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-20 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-7xl p-4 sm:p-6"
          >
            {renderContent()}
          </motion.div>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white/50 dark:bg-gray-950/50">
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            EventForge — Enterprise Event Management Platform &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}

function AuthInterceptor() {
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : '';
        if (url.includes('/api/') && !url.includes('/api/auth/login')) {
          const state = useAuthStore.getState();
          if (state.isAuthenticated) {
            state.logout();
            toast.error('Session expired. Please sign in again.');
          }
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  return null;
}

export default function Home() {
  const { isAuthenticated, _hydrated } = useAuthStore();

  // Wait for Zustand persist to rehydrate from localStorage before rendering
  // to avoid hydration mismatch between server and client
  if (!_hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading EventForge...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthInterceptor />
      {!isAuthenticated ? <LoginPage /> : <AppShell />}
    </>
  );
}
