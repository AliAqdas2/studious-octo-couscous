import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Star, TrendingUp, Calendar, DollarSign, Mail, 
  Building2, Phone, Award, Shirt, Linkedin, Users
} from 'lucide-react';
import { toast } from 'sonner';
import AdditionalContactsList from '@/components/leads/AdditionalContactsList';

export default function ClientProfile() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('id');

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const clients = await base44.entities.Client.filter({ id: clientId });
      return clients[0];
    },
    enabled: !!clientId
  });

  const { data: events = [] } = useQuery({
    queryKey: ['client-events', clientId],
    queryFn: () => base44.entities.Event.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const toggleVipMutation = useMutation({
    mutationFn: () => base44.entities.Client.update(clientId, {
      is_vip: !client.is_vip
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['client', clientId]);
      toast.success(client.is_vip ? 'VIP status removed' : 'Marked as VIP');
    }
  });

  const toggleFieldMutation = useMutation({
    mutationFn: (field) => base44.entities.Client.update(clientId, {
      [field]: !client[field]
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['client', clientId]);
    }
  });

  if (isLoading || !client) {
    return <div className="text-center py-12">Loading client...</div>;
  }

  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.event_date) - new Date(a.event_date)
  );

  const completedEvents = events.filter(e => e.stage === 'Completed');
  const cancelledEvents = events.filter(e => e.stage === 'Cancelled');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-[#C84B31]">{client.name}</h1>
            {client.is_vip && (
              <Badge className="bg-amber-500 text-white text-lg px-3 py-1">
                <Star className="w-4 h-4 mr-1" />
                VIP
              </Badge>
            )}
            {client.is_returning && (
              <Badge className="bg-green-600 text-white text-lg px-3 py-1">
                Returning Client
              </Badge>
            )}
          </div>
          {client.company && <p className="text-xl text-gray-600">{client.company}</p>}
        </div>
        <Button
          onClick={() => toggleVipMutation.mutate()}
          variant={client.is_vip ? "outline" : "default"}
          className={client.is_vip ? "" : "bg-amber-500 hover:bg-amber-600"}
        >
          <Star className="w-4 h-4 mr-2" />
          {client.is_vip ? 'Remove VIP' : 'Mark as VIP'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Panel */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardHeader>
              <CardTitle>Client Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Total Events</p>
                <p className="text-3xl font-bold text-[#C84B31]">{client.total_events || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Lifetime Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(client.lifetime_revenue || 0).toLocaleString()}
                </p>
              </div>
              {client.average_event_value > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Avg Event Value</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${Math.round(client.average_event_value).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Contact Info</span>
                <span className="text-xs font-medium text-[#C84B31] bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">Primary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{client.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <Badge variant="outline">{client.client_type}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#C84B31]" />
                  Key Contacts
                </span>
                <span className="text-xs font-normal text-gray-500">
                  {Array.isArray(client.additional_contacts) ? client.additional_contacts.length : 0}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdditionalContactsList contacts={client.additional_contacts || []} />
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
            <CardHeader>
              <CardTitle>Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => toggleFieldMutation.mutate('newsletter_subscribed')}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-orange-50 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">Newsletter</span>
                </div>
                <Badge variant={client.newsletter_subscribed ? "default" : "outline"}>
                  {client.newsletter_subscribed ? 'Subscribed' : 'Not Subscribed'}
                </Badge>
              </button>

              <button
                onClick={() => toggleFieldMutation.mutate('linkedin_connected')}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-orange-50 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4" />
                  <span className="text-sm">LinkedIn</span>
                </div>
                <Badge variant={client.linkedin_connected ? "default" : "outline"}>
                  {client.linkedin_connected ? 'Connected' : 'Not Connected'}
                </Badge>
              </button>

              <button
                onClick={() => toggleFieldMutation.mutate('tshirt_sent')}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-orange-50 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4" />
                  <span className="text-sm">T-Shirt</span>
                </div>
                <Badge variant={client.tshirt_sent ? "default" : "outline"}>
                  {client.tshirt_sent ? 'Sent' : 'Not Sent'}
                </Badge>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Events Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
            <CardHeader>
              <CardTitle>Events Timeline ({completedEvents.length} Completed)</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedEvents.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No events yet</p>
              ) : (
                <div className="space-y-4">
                  {sortedEvents.map(event => (
                    <Link key={event.id} to={createPageUrl(`EventDetail?id=${event.id}`)}>
                      <div className="p-4 border border-gray-200 rounded-lg hover:bg-orange-50 transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900">{event.event_name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={
                                event.stage === 'Completed' ? 'bg-green-600' :
                                event.stage === 'Cancelled' ? 'bg-red-600' :
                                'bg-blue-600'
                              }>
                                {event.stage}
                              </Badge>
                              {event.event_type && (
                                <Badge variant="outline">{event.event_type}</Badge>
                              )}
                              {event.satisfaction_rating && (
                                <Badge className="bg-amber-500 text-white">
                                  <Award className="w-3 h-3 mr-1" />
                                  {event.satisfaction_rating}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {event.total_cost && (
                            <p className="text-xl font-bold text-[#C84B31]">
                              ${event.total_cost.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(event.event_date).toLocaleDateString()}
                          </div>
                          {event.venue && <span>• {event.venue}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lost Intelligence */}
          {cancelledEvents.length > 0 && (
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-red-900">Cancelled Events History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cancelledEvents.map(event => (
                    <div key={event.id} className="p-3 bg-white rounded-lg border border-red-200">
                      <p className="font-medium text-gray-900">{event.event_name}</p>
                      {event.cancellation_reason && (
                        <p className="text-sm text-gray-600 mt-1">
                          Reason: {event.cancellation_reason}
                        </p>
                      )}
                      {event.went_to_competitor && (
                        <p className="text-sm text-red-700 mt-1">
                          Went to: {event.went_to_competitor}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {event.budget_issue && (
                          <Badge variant="outline" className="text-xs">Budget Issue</Badge>
                        )}
                        {event.timing_issue && (
                          <Badge variant="outline" className="text-xs">Timing Issue</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}