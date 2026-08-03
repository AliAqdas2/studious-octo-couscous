import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Calendar, DollarSign, Users, Building2, MapPin, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfirmedEvents() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    eventType: 'all',
    venue: 'all',
    clientType: 'all',
    returningClient: 'all'
  });

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['confirmed-events'],
    queryFn: async () => {
      const allEvents = await base44.entities.Event.list('-event_date');
      return allEvents.filter(e => 
        e.stage !== 'Cancelled' && e.stage !== 'Lost'
      );
    }
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const filteredEvents = events.filter(event => {
    const matchesSearch = !searchTerm || 
      event.event_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.poc_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.event_type?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filters.eventType === 'all' || event.event_type === filters.eventType;
    const matchesVenue = filters.venue === 'all' || event.venue === filters.venue;

    const client = clients.find(c => c.id === event.client_id);
    const matchesClientType = filters.clientType === 'all' || client?.client_type === filters.clientType;
    const matchesReturning = filters.returningClient === 'all' || 
      (filters.returningClient === 'yes' && client?.is_returning) ||
      (filters.returningClient === 'no' && !client?.is_returning);

    return matchesSearch && matchesType && matchesVenue && matchesClientType && matchesReturning;
  });

  const uniqueTypes = [...new Set(events.map(e => e.event_type).filter(Boolean))];
  const uniqueVenues = [...new Set(events.map(e => e.venue).filter(Boolean))];

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;

      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            event_type: { type: "string" },
            event_date: { type: "string" },
            venue: { type: "string" },
            poc_name: { type: "string" },
            poc_email: { type: "string" },
            poc_phone: { type: "string" },
            headcount: { type: "number" },
            total_cost: { type: "number" },
            stage: { type: "string" }
          }
        }
      });

      if (extractResult.status === 'error') {
        throw new Error(extractResult.details || 'Failed to extract data');
      }

      const eventsToCreate = Array.isArray(extractResult.output) 
        ? extractResult.output 
        : [extractResult.output];

      await base44.entities.Event.bulkCreate(eventsToCreate);
      return eventsToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries(['confirmed-events']);
      toast.success(`Successfully imported ${count} event(s)`);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    }
  });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Confirmed Events Archive</h1>
          <p className="text-gray-600">Searchable history of all confirmed and completed events</p>
        </div>
        {user?.role === 'admin' && (
          <div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={uploadMutation.isPending}
            />
            <label htmlFor="file-upload">
              <Button
                asChild
                disabled={uploadMutation.isPending}
                className="bg-[#7A9D54] hover:bg-[#6A8D44]"
              >
                <span className="cursor-pointer">
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import CSV/Excel
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          placeholder="Search by event name, client, venue, POC, or event type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 py-6 text-lg"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Panel */}
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Event Type</label>
              <select
                value={filters.eventType}
                onChange={(e) => setFilters({...filters, eventType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Venue</label>
              <select
                value={filters.venue}
                onChange={(e) => setFilters({...filters, venue: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Venues</option>
                {uniqueVenues.map(venue => (
                  <option key={venue} value={venue}>{venue}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Client Type</label>
              <select
                value={filters.clientType}
                onChange={(e) => setFilters({...filters, clientType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="B2B">B2B</option>
                <option value="B2C">B2C</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Returning Client</label>
              <select
                value={filters.returningClient}
                onChange={(e) => setFilters({...filters, returningClient: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <div className="lg:col-span-3 space-y-4">
          {isLoading ? (
            <p className="text-center py-12 text-gray-500">Loading events...</p>
          ) : filteredEvents.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No events found</p>
              </CardContent>
            </Card>
          ) : (
            filteredEvents.map(event => {
              const client = clients.find(c => c.id === event.client_id);
              return (
                <Link key={event.id} to={createPageUrl(`EventDetail?id=${event.id}`)}>
                  <Card className="bg-white/80 backdrop-blur-sm border-orange-100 hover:shadow-lg transition-all cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">{event.event_name}</h3>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="bg-[#7A9D54] text-white">{event.stage}</Badge>
                            {event.event_type && (
                              <Badge variant="outline">{event.event_type}</Badge>
                            )}
                            {client?.is_returning && (
                              <Badge className="bg-amber-500 text-white">Returning Client</Badge>
                            )}
                          </div>
                        </div>
                        {event.total_cost && (
                          <div className="text-right">
                            <div className="flex items-center gap-2 text-2xl font-bold text-[#C84B31]">
                              <DollarSign className="w-6 h-6" />
                              {event.total_cost.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">
                            {new Date(event.event_date).toLocaleDateString()}
                          </span>
                        </div>
                        {event.venue && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{event.venue}</span>
                          </div>
                        )}
                        {event.poc_name && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{event.poc_name}</span>
                          </div>
                        )}
                        {client?.company && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{client.company}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}