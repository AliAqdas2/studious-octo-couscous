import React from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Menu, X } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  Mail,
  FolderOpen,
  FileText,
  Settings,
  Activity,
  LogOut,
  ChefHat,
  Phone,
  Bot,
  SlidersHorizontal,
  UserPlus } from
'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/notifications/NotificationBell';
import GmailConnectionBanner from '@/components/gmail/GmailConnectionBanner';
import { isGmailAdminEmail } from '@/lib/gmailAdminEmails';
import {
  DEFAULT_APP_PATH,
  MY_ONBOARDING_PATH,
} from '@/lib/postLoginPath';
import {
  getNavProfile,
  isPageAllowed,
  OPS_HOME_PATH,
} from '@/lib/operationalAccess';

function SpamLeadsCounter() {
  const { data: count = 0 } = useQuery({
    queryKey: ['spam-emails-count'],
    queryFn: async () => {
      const items = await base44.entities.SpamEmail.list('-received_at', 500);
      return items.length;
    },
    staleTime: 30000
  });

  if (count === 0) return null;

  return (
    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
      {count}
    </span>
  );
}

function UnassignedCounter() {
  const { data: assignments = [] } = useQuery({
    queryKey: ['role-assignments-counter'],
    queryFn: () => base44.entities.RoleAssignment.list(),
    staleTime: 30000
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-counter'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 30000
  });

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const unassignedCount = users.filter((u) => !assignedUserIds.has(u.id)).length;

  if (unassignedCount === 0) return null;

  return (
    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
      {unassignedCount}
    </span>);

}

export default function Layout({ children, currentPageName }) {
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = React.useState(authUser);
  const [isDeactivated, setIsDeactivated] = React.useState(false);
  const [isPendingActivation, setIsPendingActivation] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const onMyOnboarding =
    location.pathname === MY_ONBOARDING_PATH ||
    location.pathname === '/MyOnboarding';

  React.useEffect(() => {
    setUser(authUser);
  }, [authUser]);

  React.useEffect(() => {
    if (!authUser) {
      base44.auth.me().then(setUser).catch(() => {});
    }
  }, [authUser]);

  const { data: userAssignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['user-assignment', user?.id],
    queryFn: async () => {
      if (!user) return null;
      if (user.role === 'admin') return { is_active: true, role: 'Admin' };
      const assignments = await base44.entities.RoleAssignment.filter({ user_id: user.id });
      return assignments[0] || null;
    },
    enabled: !!user
  });

  React.useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      setIsPendingActivation(false);
      setIsDeactivated(false);
      return;
    }

    if (userAssignment === undefined) return; // Still loading

    if (userAssignment === null) {
      setIsPendingActivation(true);
      setIsDeactivated(false);
    } else if (!userAssignment.is_active) {
      setIsDeactivated(true);
      setIsPendingActivation(false);
    } else {
      setIsDeactivated(false);
      setIsPendingActivation(false);
    }
  }, [user, userAssignment]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Wait for role before rendering CRM shell (prevents Dashboard flash)
  if (user && user.role !== 'admin' && assignmentLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-[#C84B31] rounded-full animate-spin" />
      </div>
    );
  }

  if (isPendingActivation) {
    // Import and render the activation pending page
    const ActivationPending = React.lazy(() => import('@/pages/ActivationPending'));
    return (
      <React.Suspense fallback={<div>Loading...</div>}>
        <ActivationPending />
      </React.Suspense>);

  }

  const isOnboardingUser =
    userAssignment?.role === 'Onboarding' && userAssignment?.is_active !== false;

  if (isOnboardingUser) {
    if (!onMyOnboarding) {
      return <Navigate to={MY_ONBOARDING_PATH} replace />;
    }
    return <>{children}</>;
  }

  if (onMyOnboarding) {
    return <Navigate to={DEFAULT_APP_PATH} replace />;
  }

  if (isDeactivated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Deactivated</h1>
          <p className="text-gray-600 mb-6">Your access has been deactivated. Please contact info@mangiadc.com.</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-[#C84B31] hover:bg-[#A03A23] text-white rounded-lg font-medium">

            Logout
          </button>
        </div>
      </div>);

  }

  // Role-based navigation visibility
  const isAdmin = user?.role === 'admin';
  const canManageGmail = isGmailAdminEmail(user?.email);
  const navProfile = getNavProfile(user, userAssignment);

  if (
    user &&
    currentPageName &&
    !isPageAllowed(currentPageName, user, userAssignment)
  ) {
    return <Navigate to={OPS_HOME_PATH} replace />;
  }

  const navItems =
    navProfile === 'admin'
      ? [
          { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
          { name: 'Leads', icon: Users, page: 'Leads' },
          { name: 'Events', icon: Calendar, page: 'Events' },
          { name: 'Tasks', icon: CheckSquare, page: 'Tasks' },
          { name: 'Calendar', icon: Calendar, page: 'CalendarView' },
          { name: 'Email', icon: Mail, page: 'Email' },
          { name: 'Templates', icon: FileText, page: 'EventTemplates' },
          { name: 'Activity Log', icon: Activity, page: 'ActivityLog' },
          { name: 'Settings', icon: Settings, page: 'Settings' },
        ]
      : navProfile === 'ops'
        ? [
            { name: 'Events', icon: Calendar, page: 'Events' },
            { name: 'Calendar', icon: Calendar, page: 'CalendarView' },
            { name: 'Settings', icon: Settings, page: 'Settings' },
          ]
        : [
            { name: 'My Tasks', icon: CheckSquare, page: 'Tasks' },
            ...(canManageGmail
              ? [{ name: 'Settings', icon: Settings, page: 'Settings' }]
              : []),
          ];

  const historyItems =
    navProfile === 'admin'
      ? [
          { name: 'Confirmed Events', icon: Calendar, page: 'ConfirmedEvents' },
          { name: 'Client Database', icon: Users, page: 'ClientDatabase' },
        ]
      : [];

  const adminItems = [
  { name: 'Role Assignment', icon: SlidersHorizontal, page: 'RoleAssignment' },
  { name: 'Users', icon: Users, page: 'Users' },
  { name: 'Email Automations', icon: Mail, page: 'PipelineEmailAutomations' },
  { name: 'Automated Calls', icon: Phone, page: 'AutomatedCallsDashboard' },
  { name: 'AI Logs', icon: Bot, page: 'AILogs' },
  { name: 'Spam Leads', icon: AlertCircle, page: 'SpamEmails' },
  { name: 'Task Sync Health', icon: Activity, page: 'TaskSyncAdmin' }];


  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <style>{`
        :root {
          --primary: #C84B31;
          --secondary: #E8B55F;
          --accent: #7A9D54;
          --neutral-dark: #2D3436;
          --neutral-light: #DFE6E9;
          --bg-cream: #FFF9F0;
        }
      `}</style>
      
      {/* Top Navigation Bar - fixed so it stays visible when scrolling */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-orange-100 shadow-sm">
        <div className="w-full px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>

                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
              <ChefHat className="w-6 md:w-8 h-6 md:h-8 text-[#C84B31]" />
              <h1 className="text-lg md:text-2xl font-bold text-[#C84B31]">Mangia DC</h1>
              <span className="hidden md:inline text-sm text-gray-500 font-medium">CRM & Events</span>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {user &&
              <>
                  <NotificationBell user={user} />
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-gray-700">{user.full_name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-[#C84B31]">

                    <LogOut className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Logout</span>
                  </Button>
                </>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Side Navigation + Content - pt for fixed header */}
      <div className="w-full pt-[73px]">
        <div className="flex">
          {/* Sidebar - fixed on desktop so it stays visible when scrolling */}
          <aside className={`
            fixed left-0 z-40 top-[73px] h-[calc(100vh-73px)]
            w-64 bg-white/60 backdrop-blur-sm border-r border-orange-100 p-6 overflow-y-auto
            transform transition-transform duration-200 ease-in-out
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            lg:block
          `}>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive ?
                    'bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white shadow-md' :
                    'text-gray-700 hover:bg-orange-50 hover:text-[#C84B31]'}`
                    }>

                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>);

              })}
              
              <div className="h-px bg-orange-200 my-4" />
              


              {isAdmin && historyItems.length > 0 &&
              <>
                  <div className="h-px bg-orange-200 my-4" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-2">
                    History
                  </p>
                </>
              }
              {historyItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive ?
                    'bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white shadow-md' :
                    'text-gray-700 hover:bg-orange-50 hover:text-[#C84B31]'}`
                    }>

                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>);

              })}

              {user?.role === 'admin' &&
              <>
                  <div className="h-px bg-orange-200 my-4" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-2">
                    Admin
                  </p>
                  {adminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPageName === item.page;

                  // Show unassigned counter on Role Assignment tab
                  const showUnassignedCounter = item.page === 'RoleAssignment';
                  const showSpamCounter = item.page === 'SpamEmails';

                  return (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive ?
                      'bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white shadow-md' :
                      'text-gray-700 hover:bg-orange-50 hover:text-[#C84B31]'}`
                      }>

                        <Icon className="w-5 h-5" />
                        <span className="font-medium flex-1">{item.name}</span>
                        {showUnassignedCounter && user &&
                      <UnassignedCounter />
                      }
                        {showSpamCounter && user &&
                      <SpamLeadsCounter />
                      }
                      </Link>);

                })}
                </>
              }
            </nav>
          </aside>

          {/* Overlay for mobile menu */}
          {mobileMenuOpen &&
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)} />

          }

          {/* Main Content - left margin on desktop so content doesn't sit under fixed sidebar */}
          <main className="flex-1 p-4 md:p-8 w-full min-w-0 lg:ml-64">
            <GmailConnectionBanner />
            {children}
          </main>
        </div>
      </div>
    </div>);

}