import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isGmailAdminEmail } from '@/lib/gmailAdminEmails';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const GmailConnectionBanner = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connecting, setConnecting] = React.useState(false);
  const canConnect = isGmailAdminEmail(user?.email);

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => base44.gmail.getStatus(),
    enabled: !!user,
    staleTime: 30000,
    retry: 1,
  });

  React.useEffect(() => {
    if (searchParams.get('gmail') !== 'connected') return;

    const email = searchParams.get('email');
    queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    toast.success(
      email
        ? `Gmail connected as ${email}`
        : 'Gmail connected successfully'
    );

    const next = new URLSearchParams(searchParams);
    next.delete('gmail');
    next.delete('email');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, queryClient]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await base44.gmail.getOAuthUrl();
      if (!url) {
        throw new Error('No OAuth URL returned');
      }
      window.location.assign(url);
    } catch (err) {
      const message =
        err?.body?.error ||
        err?.message ||
        'Failed to start Gmail connection';
      toast.error(message);
      setConnecting(false);
    }
  };

  if (!user || isLoading || isError || status?.connected) {
    return null;
  }

  return (
    <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
      <Mail className="h-4 w-4" />
      <AlertTitle>Gmail is not connected</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {canConnect ? (
            <>
              Connect the shared CRM mailbox to send and sync email, and to run
              inbox → lead intake. You can also manage this in{' '}
              <Link
                to={createPageUrl('Settings')}
                className="underline font-medium"
              >
                Settings
              </Link>
              .
            </>
          ) : (
            <>
              The shared CRM mailbox is disconnected. Ask an authorized admin
              (aa03095276332@gmail.com or info@mangiadc.com) to reconnect it in
              Settings.
            </>
          )}
        </span>
        {canConnect && (
          <Button
            type="button"
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
            className="shrink-0 bg-[#C84B31] hover:bg-[#A03A23] text-white"
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default GmailConnectionBanner;
