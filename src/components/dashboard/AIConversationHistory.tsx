'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Bot, User, Lightbulb, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { AIConversation } from '@/lib/types';

export function AIConversationHistory() {
  const { user } = useAuth();

  const shoppingAssistantConvos = user?.aiConversations.filter(c => c.type === 'shopping_assistant').slice().reverse() || [];
  const productIdeaConvos = user?.aiConversations.filter(c => c.type === 'product_idea_generator').slice().reverse() || [];

  const renderConversations = (conversations: AIConversation[], type: 'shopping' | 'product') => {
    if (conversations.length === 0) {
      return (
        <div className="text-center py-12">
          {type === 'shopping' ? <Sparkles className="mx-auto h-16 w-16 text-muted-foreground mb-4" /> : <Lightbulb className="mx-auto h-16 w-16 text-muted-foreground mb-4" />}
          <p className="text-muted-foreground text-lg">No conversations yet for this AI tool.</p>
        </div>
      );
    }
    return (
      <ScrollArea className="h-[350px] space-y-4 p-1">
        {conversations.map(convo => (
          <div key={convo.id} className="mb-4 p-4 border rounded-lg bg-muted/30 shadow-sm">
            <p className="text-xs text-muted-foreground mb-2">
              {new Date(convo.timestamp).toLocaleString()}
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <User className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" /> 
                <p className="font-medium bg-background p-2 rounded-md shadow-sm">{convo.query}</p>
              </div>
              <div className="flex items-start gap-2">
                {type === 'shopping' ? <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" /> : <Lightbulb className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />}
                <p className="text-sm bg-background p-2 rounded-md shadow-sm whitespace-pre-wrap">{convo.response}</p>
              </div>
            </div>
          </div>
        ))}
      </ScrollArea>
    );
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl font-headline">AI Conversation History</CardTitle>
        </div>
        <CardDescription>Your interactions with our AI tools.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="shopping_assistant">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="shopping_assistant" className="text-base">
                <Sparkles className="mr-2 h-4 w-4"/> Shopping Assistant
            </TabsTrigger>
            <TabsTrigger value="product_idea_generator" className="text-base">
                <Lightbulb className="mr-2 h-4 w-4"/> Product Ideas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="shopping_assistant">
            {renderConversations(shoppingAssistantConvos, 'shopping')}
          </TabsContent>
          <TabsContent value="product_idea_generator">
            {renderConversations(productIdeaConvos, 'product')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
