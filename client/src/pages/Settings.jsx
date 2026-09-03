import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Link2, Unlink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  GMAIL_DISCONNECT_PHRASE,
  isGmailAdminEmail,
} from '@/lib/gmailAdminEmails';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SettingsVenuesPanel from '@/components/settings/SettingsVenuesPanel';
import SettingsInventoryCatalogPanel from '@/components/settings/SettingsInventoryCatalogPanel';
import SettingsInstructorsPanel from '@/components/settings/SettingsInstructorsPanel';
import SettingsEateriesPanel from '@/components/settings/SettingsEateriesPanel';
import {
  canAccessOpsSettings,
  isOpsRole,
  isSystemAdmin,
} from '@/lib/operationalAccess';

function formatTs(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function GmailSettingsSection({ user }) {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = React.useState(false);
  const [disconnectOpen, setDisconnectOpen] = React.useState(false);
  const [confirmPhrase, setConfirmPhrase] = React.useState('');
  const [disconnecting, setDisconnecting] = React.useState(false);

  const { data: status, isLoading, isError, refetch } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => base44.gmail.getStatus(),
    enabled: !!user,
    staleTime: 15000,
    retry: 1,
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await base44.gmail.getOAuthUrl();
      if (!url) throw new Error('No OAuth URL returned');
      window.location.assign(url);
    } catch (err) {
      toast.error(
        err?.body?.error || err?.message || 'Failed to start Gmail connection'
      );
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirmPhrase !== GMAIL_DISCONNECT_PHRASE) {
      toast.error(`Type "${GMAIL_DISCONNECT_PHRASE}" exactly`);
      return;
    }
    setDisconnecting(true);
    try {
      await base44.gmail.disconnect({ confirmPhrase });
      toast.success('Gmail disconnected');
      setDisconnectOpen(false);
      setConfirmPhrase('');
      await queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      await refetch();
    } catch (err) {
      toast.error(
        err?.body?.error || err?.message || 'Failed to disconnect Gmail'
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = Boolean(status?.connected);
  const watchExpiry = formatTs(status?.watchExpiration);
  const watchRegistered = formatTs(status?.watchRegisteredAt);

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#2D3436]">
            <Mail className="w-5 h-5 text-[#C84B31]" />
            Email connection
          </CardTitle>
          <CardDescription>
            Connect or disconnect the shared mailbox. After connecting, inbox
            push watch is registered automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading status…
            </div>
          )}

          {isError && (
            <p className="text-sm text-red-600">
              Could not load Gmail status. Try refreshing the page.
            </p>
          )}

          {!isLoading && !isError && (
            <>
              <div className="rounded-lg border border-orange-100 bg-[#FFF9F0] p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {connected ? (
                    <CheckCircle2 className="w-5 h-5 text-[#7A9D54]" />
                  ) : (
                    <Unlink className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="font-medium text-gray-800">
                    {connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {connected && status?.email && (
                  <p className="text-sm text-gray-700 pl-7">
                    Mailbox: <span className="font-medium">{status.email}</span>
                  </p>
                )}
                {connected && (
                  <div className="text-sm text-gray-600 pl-7 space-y-1">
                    <p>
                      Inbox watch:{' '}
                      {watchExpiry
                        ? `active until ${watchExpiry} (ET)`
                        : 'not registered yet'}
                    </p>
                    {watchRegistered && (
                      <p className="text-xs text-gray-500">
                        Last registered: {watchRegistered} (ET)
                      </p>
                    )}
                    {status?.lastConnectionError && (
                      <p className="text-xs text-red-600">
                        Last error: {status.lastConnectionError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {!connected ? (
                  <Button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="bg-[#C84B31] hover:bg-[#A03A23] text-white"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Connect email
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setConfirmPhrase('');
                      setDisconnectOpen(true);
                    }}
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect email
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Gmail?</DialogTitle>
            <DialogDescription>
              This stops send, sync, and inbox intake until you reconnect.
              Type{' '}
              <span className="font-mono font-semibold">
                {GMAIL_DISCONNECT_PHRASE}
              </span>{' '}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="disconnect-phrase">Confirmation phrase</Label>
            <Input
              id="disconnect-phrase"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={GMAIL_DISCONNECT_PHRASE}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisconnectOpen(false)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
              disabled={
                disconnecting || confirmPhrase !== GMAIL_DISCONNECT_PHRASE
              }
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = isSystemAdmin(user);
  const canManageGmail = isGmailAdminEmail(user?.email);

  const { data: assignment } = useQuery({
    queryKey: ['user-assignment', user?.id],
    queryFn: async () => {
      if (!user) return null;
      if (user.role === 'admin') return { is_active: true, role: 'Admin' };
      const assignments = await base44.entities.RoleAssignment.filter({
        user_id: user.id,
      });
      return assignments[0] || null;
    },
    enabled: !!user,
  });

  const isOps = isOpsRole(assignment);
  const canOpenSettings =
    canAccessOpsSettings(user, assignment) || canManageGmail;

  if (!user || !canOpenSettings) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">
            You do not have access to Settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-[#C84B31] mb-2">
          Settings
        </h1>
        <p className="text-gray-600">
          {isOps && !isAdmin
            ? 'House venues, instructors, eateries, and inventory catalog for event ops.'
            : 'Manage house venues, instructors, eateries, inventory catalog, and shared Gmail (when authorized).'}
        </p>
      </div>

      {(isAdmin || isOps) && (
        <>
          <SettingsVenuesPanel />
          <SettingsInventoryCatalogPanel />
          <SettingsInstructorsPanel />
          <SettingsEateriesPanel />
        </>
      )}

      {canManageGmail && <GmailSettingsSection user={user} />}
    </div>
  );
}
