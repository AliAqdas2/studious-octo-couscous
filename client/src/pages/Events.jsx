import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Calendar, Users, MapPin, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import EventFormDialog from '@/components/events/EventFormDialog';
import { toast } from 'sonner';

export default function Events() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-event_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId) => {
      const event = events.find(e => e.id === eventId);
      
      // Block deletion of completed events
      if (event.stage === 'Completed') {
        throw new Error('Cannot delete completed events. Please archive instead.');
      }
      
      // Block deletion of past events
      if (new Date(event.event_date) < new Date()) {
        throw new Error('Cannot delete past events. Please contact admin to archive.');
      }
      
      // Delete all tasks linked to this event first
      const tasks = await base44.entities.Task.filter({ event_id: eventId });
      await Promise.all(tasks.map(task => base44.entities.Task.delete(task.id)));
      
      // Then delete the event
      await base44.entities.Event.delete(eventId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      toast.success('Event and associated tasks deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    }
  });

  const filteredEvents = events.filter(event =>
    event.event_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.event_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stageColors = {
    'Deposit Received': 'bg-blue-100 text-blue-800 border-blue-200',
    'Planning': 'bg-purple-100 text-purple-800 border-purple-200',
    'Run Of Show Scheduled': 'bg-violet-100 text-violet-800 border-violet-200',
    'Pre-Event Ready': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'In Progress': 'bg-red-100 text-red-800 border-red-200',
    'Post-Event': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Lost': 'bg-slate-100 text-slate-800 border-slate-200',
    'Canceled': 'bg-gray-100 text-gray-800 border-gray-200',
    // Legacy
    'Pre-Event Planning': 'bg-purple-100 text-purple-800 border-purple-200',
    'Inventory Ordering': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Staff Confirmed': 'bg-green-100 text-green-800 border-green-200',
    '72hr Final Check': 'bg-orange-100 text-orange-800 border-orange-200',
    'Event Day': 'bg-red-100 text-red-800 border-red-200',
    'Post-Event Processing': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Cancelled': 'bg-gray-100 text-gray-800 border-gray-200'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Events</h1>
          <p className="text-gray-600">Manage your event operations and workflows</p>
        </div>
{/* New events are created by converting Won leads */}
      </div>

      {/* Search */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <p className="text-center py-12 text-gray-500 col-span-2">Loading events...</p>
        ) : filteredEvents.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-orange-100 col-span-2">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No events found</p>
            </CardContent>
          </Card>
        ) : (
          filteredEvents.map((event) => (
            <Card key={event.id} className="bg-white/80 backdrop-blur-sm border-orange-100 hover:shadow-lg transition-all hover:border-[#C84B31] h-full">
              <CardContent className="p-6">
                <Link to={createPageUrl(`EventDetail?id=${event.id}`)}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {event.event_name}
                        </h3>
                        {event.event_type && (
                          <p className="text-gray-600">{event.event_type}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <Badge className={`${stageColors[event.stage]} border font-medium`}>
                          {event.stage}
                        </Badge>
                        {user?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              if (confirm('Delete this event?')) {
                                deleteMutation.mutate(event.id);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(event.event_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      {event.venue && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{event.venue}</span>
                        </div>
                      )}
                      {event.headcount && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{event.headcount} guests</span>
                        </div>
                      )}
                    </div>

                    {event.deposit_received && (
                      <div className="pt-3 border-t border-gray-200">
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Deposit Received
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showForm && (
        <EventFormDialog onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}