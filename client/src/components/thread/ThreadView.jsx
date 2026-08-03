import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ThreadView({ taskId, eventId, user, visibleToRoles }) {
  const queryClient = useQueryClient();
  const [messageBody, setMessageBody] = useState('');
  const [mentionInput, setMentionInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState([]);

  const parentId = taskId || eventId;
  const parentType = taskId ? 'task_id' : 'event_id';

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['thread-messages', parentId],
    queryFn: async () => {
      const query = taskId ? { task_id: taskId } : { event_id: eventId };
      const allMessages = await base44.entities.ThreadMessage.filter(query);
      return allMessages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    },
    enabled: !!parentId
  });

  // Fetch users for @mention autocomplete (cached globally)
  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Post message mutation
  const postMessageMutation = useMutation({
    mutationFn: async () => {
      if (!messageBody.trim() || !user) throw new Error('Message required');

      const mentionedIds = selectedMentions.map(u => u.id);
      const messageData = {
        [parentType]: parentId,
        author_id: user.id,
        author_name: user.full_name,
        body: messageBody,
        mentioned_users: mentionedIds,
        is_system_message: false
      };

      await base44.entities.ThreadMessage.create(messageData);
      return messageData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['thread-messages', parentId]);
      queryClient.invalidateQueries(['thread-messages-mentions']); // Trigger notification refresh
      setMessageBody('');
      setSelectedMentions([]);
      toast.success('Message posted');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Filter users for mention autocomplete
  const filteredMentions = mentionInput
    ? users.filter(u => u.full_name.toLowerCase().includes(mentionInput.toLowerCase()))
    : [];

  const handleMentionSelect = (mentionedUser) => {
    if (!selectedMentions.find(u => u.id === mentionedUser.id)) {
      setSelectedMentions([...selectedMentions, mentionedUser]);
      setMentionInput('');
      setShowMentions(false);
    }
  };

  const removeMention = (userId) => {
    setSelectedMentions(selectedMentions.filter(u => u.id !== userId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Thread ({messages.length})</h3>
      </div>

      {/* Messages */}
      <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
        {isLoading ? (
          <p className="text-center text-sm text-gray-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${
                msg.is_system_message
                  ? 'bg-gray-100 border border-gray-300'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-sm ${msg.is_system_message ? 'text-gray-600' : 'text-gray-900'}`}>
                    {msg.author_name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.created_date).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit'
                    })}
                  </span>
                </div>
                {msg.is_system_message && (
                  <Badge variant="secondary" className="text-xs">
                    System
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{msg.body}</p>
              {msg.mentioned_users?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {msg.mentioned_users.map((userId) => {
                    const mentionedUser = users.find(u => u.id === userId);
                    return mentionedUser ? (
                      <Badge key={userId} variant="outline" className="text-xs">
                        @{mentionedUser.full_name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Message Composer */}
      {user && (
        <div className="space-y-2">
          <Textarea
            placeholder="Type a message... (use @name to mention)"
            value={messageBody}
            onChange={(e) => {
              setMessageBody(e.target.value);
              const atIndex = e.target.value.lastIndexOf('@');
              if (atIndex !== -1) {
                const afterAt = e.target.value.substring(atIndex + 1);
                setMentionInput(afterAt);
                setShowMentions(true);
              } else {
                setShowMentions(false);
              }
            }}
            className="text-sm"
            rows={2}
          />

          {/* Mention Suggestions */}
          {showMentions && filteredMentions.length > 0 && (
            <div className="border border-gray-300 rounded-lg p-2 bg-white max-h-32 overflow-y-auto">
              {filteredMentions.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleMentionSelect(u)}
                  className="w-full text-left px-2 py-1 hover:bg-orange-50 rounded text-sm"
                >
                  @{u.full_name}
                </button>
              ))}
            </div>
          )}

          {/* Selected Mentions */}
          {selectedMentions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMentions.map((u) => (
                <Badge key={u.id} variant="outline" className="gap-1">
                  @{u.full_name}
                  <button
                    onClick={() => removeMention(u.id)}
                    className="ml-1 text-xs hover:text-red-600"
                  >
                    ✕
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Send Button */}
          <Button
            onClick={() => postMessageMutation.mutate()}
            disabled={postMessageMutation.isPending || !messageBody.trim()}
            className="w-full bg-[#C84B31] hover:bg-[#A03A23]"
          >
            {postMessageMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Post Message
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}