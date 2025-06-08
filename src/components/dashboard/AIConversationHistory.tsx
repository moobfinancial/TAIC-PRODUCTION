'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Updated import
import type { AIConversation } from '@/lib/types'; // Assuming AIConversation type is still relevant

export function AIConversationHistory() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth(); // Updated to use new AuthContext values
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      if (authLoading) {
        setIsLoadingConversations(true);
        return;
      }
      if (isAuthenticated && token) {
        setIsLoadingConversations(true);
        setError(null);
        try {
          const response = await fetch('/api/user/ai-conversations', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: "Failed to parse error from server."}));
            throw new Error(errData.error || `Failed to fetch conversations: ${response.statusText}`);
          }
          const data: AIConversation[] = await response.json();
          setConversations(data || []); // API returns an array directly
        } catch (err: any) {
          setError(err.message || 'Could not load AI conversations.');
          setConversations([]);
        } finally {
          setIsLoadingConversations(false);
        }
      } else if (!isAuthenticated && !authLoading) {
        setConversations([]);
        setIsLoadingConversations(false);
        setError(null); // Not an error, just not logged in
      }
    };
    fetchConversations();
  }, [isAuthenticated, token, authLoading]);

  if (authLoading || isLoadingConversations) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl font-headline">AI Chat History</CardTitle>
          </div>
          <CardDescription>Review your past interactions with AI assistants.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Loader2 className="mx-auto h-16 w-16 text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground text-lg">Loading AI conversations...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
          <p className="text-destructive text-lg">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
     return (
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center gap-4">
                <MessageSquare className="h-8 w-8 text-primary" />
                <CardTitle className="text-2xl font-headline">AI Chat History</CardTitle>
            </div>
          <CardDescription>Review your past interactions with AI assistants.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">Please log in to view your AI chat history.</p>
        </CardContent>
      </Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center gap-4">
                <MessageSquare className="h-8 w-8 text-primary" />
                <CardTitle className="text-2xl font-headline">AI Chat History</CardTitle>
            </div>
          <CardDescription>Review your past interactions with AI assistants.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">You have no AI conversations yet.</p>
          <p className="text-sm text-muted-foreground mt-2">Use the AI Shopping Assistant or Product Idea Generator to start!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl font-headline">AI Chat History</CardTitle>
        </div>
        <CardDescription>Review your past interactions with AI assistants.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Accordion type="single" collapsible className="w-full">
            {conversations.slice().reverse().map((convo) => (
              <AccordionItem value={convo.id} key={convo.id} className="border-b">
                <AccordionTrigger className="hover:no-underline text-left">
                  <div className="flex justify-between w-full pr-4">
                    <div>
                      <p className="font-medium capitalize">{convo.type.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-xs sm:max-w-md" title={convo.query}>
                        Query: {convo.query}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground self-start pt-1 whitespace-nowrap">
                        {new Date(convo.timestamp).toLocaleDateString()} - {new Date(convo.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-muted/20 p-4 rounded-md space-y-3">
                  <div className="font-semibold text-sm">Your Query:</div>
                  <p className="text-sm bg-background p-2 rounded">{convo.query}</p>
                  {convo.imageUrlContext && (
                    <div className="my-2">
                      <p className="font-semibold text-sm mb-1">Image Context:</p>
                      <img src={convo.imageUrlContext} alt="Query context" className="max-w-xs rounded-md border" />
                    </div>
                  )}
                  <div className="font-semibold text-sm pt-2">AI Response:</div>
                  <p className="text-sm bg-background p-2 rounded whitespace-pre-wrap">{convo.response}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
