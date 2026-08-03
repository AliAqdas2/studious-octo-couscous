import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Users, Star, DollarSign, Calendar, TrendingUp, Upload, Loader2, Trash2, UserPlus, Mail, Phone, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientDatabase() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-lifetime_revenue')
  });

  const filteredClients = clients.filter(client =>
    !searchTerm ||
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: clients.length,
    vip: clients.filter(c => c.is_vip).length,
    returning: clients.filter(c => c.is_returning).length,
    totalRevenue: clients.reduce((sum, c) => sum + (c.lifetime_revenue || 0), 0)
  };

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;

      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            company: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            client_type: { type: "string" },
            total_events: { type: "number" },
            lifetime_revenue: { type: "number" }
          }
        }
      });

      if (extractResult.status === 'error') {
        throw new Error(extractResult.details || 'Failed to extract data');
      }

      const clientsToCreate = Array.isArray(extractResult.output) 
        ? extractResult.output 
        : [extractResult.output];

      await base44.entities.Client.bulkCreate(clientsToCreate);
      return clientsToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries(['clients']);
      toast.success(`Successfully imported ${count} client(s)`);
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

  const deleteMutation = useMutation({
    mutationFn: (clientId) => base44.entities.Client.delete(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries(['clients']);
      toast.success('Client deleted successfully');
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    }
  });

  const handleDelete = (e, clientId) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      deleteMutation.mutate(clientId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Client Intelligence Database</h1>
          <p className="text-gray-600">Centralized client history and revenue tracking</p>
        </div>
        {user?.role === 'admin' && (
          <div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="client-file-upload"
              disabled={uploadMutation.isPending}
            />
            <label htmlFor="client-file-upload">
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

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Total Clients</p>
                <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <Users className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700 font-medium">VIP Clients</p>
                <p className="text-3xl font-bold text-amber-900">{stats.vip}</p>
              </div>
              <Star className="w-10 h-10 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Returning</p>
                <p className="text-3xl font-bold text-green-900">{stats.returning}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">Total Revenue</p>
                <p className="text-3xl font-bold text-purple-900">
                  ${(stats.totalRevenue / 1000).toFixed(0)}k
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          placeholder="Search by name, company, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 py-6 text-lg"
        />
      </div>

      {/* Client List */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <p className="text-center py-12 text-gray-500">Loading clients...</p>
        ) : filteredClients.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No clients found</p>
            </CardContent>
          </Card>
        ) : (
          filteredClients.map(client => (
            <Link key={client.id} to={createPageUrl(`ClientProfile?id=${client.id}`)}>
              <Card className="bg-white/80 backdrop-blur-sm border-orange-100 hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{client.name}</h3>
                        {client.is_vip && (
                          <Badge className="bg-amber-500 text-white">
                            <Star className="w-3 h-3 mr-1" />
                            VIP
                          </Badge>
                        )}
                        {client.is_returning && (
                          <Badge className="bg-green-600 text-white">Returning</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {client.company && <p className="font-medium">{client.company}</p>}
                        <p>{client.email}</p>
                        {client.phone && <p>{client.phone}</p>}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <Badge variant="outline">{client.client_type}</Badge>
                        </div>

                        {Array.isArray(client.additional_contacts) && client.additional_contacts.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-orange-100">
                            <p className="text-xs font-semibold text-[#C84B31] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <UserPlus className="w-3 h-3" />
                              Key Contacts ({client.additional_contacts.length})
                            </p>
                            <div className="space-y-2">
                              {client.additional_contacts.map((c, i) => (
                                <div key={i} className="bg-orange-50/40 border border-orange-100 rounded-md px-3 py-2">
                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                    <p className="font-semibold text-gray-900 text-sm">
                                      {c.name || <span className="italic text-gray-400">Unnamed</span>}
                                    </p>
                                    {c.role && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-600 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                                        <Briefcase className="w-2.5 h-2.5" />
                                        {c.role}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600 mt-0.5">
                                    {c.email && (
                                      <span className="flex items-center gap-1 min-w-0">
                                        <Mail className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{c.email}</span>
                                      </span>
                                    )}
                                    {c.phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {c.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      <div>
                        <p className="text-sm text-gray-500">Lifetime Revenue</p>
                        <p className="text-2xl font-bold text-[#C84B31]">
                          ${(client.lifetime_revenue || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Events</p>
                          <p className="font-bold text-gray-900">{client.total_events || 0}</p>
                        </div>
                        {client.last_event_date && (
                          <div>
                            <p className="text-gray-500">Last Event</p>
                            <p className="font-medium text-gray-900">
                              {new Date(client.last_event_date).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(e, client.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-2"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}