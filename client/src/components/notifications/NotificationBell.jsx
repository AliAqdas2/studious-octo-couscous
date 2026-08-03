import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { toast } from 'sonner';

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all thread messages where user is mentioned (optimized with filter)
  const { data: allMessages = [] } = useQuery({
    queryKey: ['thread-messages-mentions', user?.id],
    queryFn: async () => {
      const messages = await base44.entities.ThreadMessage.list('-created_date', 100);
      return messages.filter(msg => 
        msg.mentioned_users && msg.mentioned_users.includes(user.id)
      );
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch read mentions for this user
  const { data: readMentions = [] } = useQuery({
    queryKey: ['mention-reads', user?.id],
    queryFn: () => base44.entities.MentionRead.filter({ user_id: user.id }),
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Get unique task IDs from messages
  const taskIds = React.useMemo(() => 
    [...new Set(allMessages.map(m => m.task_id).filter(Boolean))], 
    [allMessages]
  );

  // Fetch only needed tasks (use global tasks cache)
  const { data: allTasksData = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const tasks = React.useMemo(() => 
    allTasksData.filter(t => taskIds.includes(t.id)),
    [allTasksData, taskIds]
  );

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId) => {
      const message = allMessages.find(m => m.id === messageId);
      if (!message) return;
      
      // Check if already marked as read
      const alreadyRead = readMentions.find(r => r.message_id === messageId);
      if (alreadyRead) return;
      
      return base44.entities.MentionRead.create({
        user_id: user.id,
        message_id: messageId,
        task_id: message.task_id,
        read_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mention-reads', user?.id]);
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadMessages = allMessages.filter(msg => 
        !readMentions.find(r => r.message_id === msg.id)
      );
      
      const promises = unreadMessages.map(msg => 
        base44.entities.MentionRead.create({
          user_id: user.id,
          message_id: msg.id,
          task_id: msg.task_id,
          read_at: new Date().toISOString()
        })
      );
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mention-reads', user?.id]);
      toast.success('All mentions marked as read');
    }
  });

  const readMessageIds = new Set(readMentions.map(r => r.message_id));
  const unreadMessages = allMessages.filter(msg => !readMessageIds.has(msg.id));
  const unreadCount = unreadMessages.length;

  const getTaskTitle = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.title || 'Unknown Task';
  };

  const handleNotificationClick = (message) => {
    markAsReadMutation.mutate(message.id);
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0" align="end">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Mentions</h3>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {unreadMessages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No new mentions</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {unreadMessages.map((message) => (
                <Link
                  key={message.id}
                  to={createPageUrl('EventDetail') + `?id=${message.event_id}`}
                  onClick={() => handleNotificationClick(message)}
                  className="block p-4 hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#C84B31] mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {message.author_name} mentioned you
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        in <span className="font-medium">{getTaskTitle(message.task_id)}</span>
                      </p>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {message.body}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(message.created_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}