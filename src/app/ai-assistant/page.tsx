
'use client';

import { useState, type FormEvent, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Sparkles, Send, Loader2, User, XCircle, CornerDownLeft, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
// getProductRecommendations and related types are removed as we use FastAPI proxy
// import { getProductRecommendations, type ProductForAI, type GetProductRecommendationsOutput } from '@/ai/flows/shopping-assistant';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import useWebSpeech from '@/hooks/useWebSpeech';
import { ProductCanvas } from '@/components/products/ProductCanvas'; // This component might need an update for AiSuggestedProduct
import { cn } from '@/lib/utils';
import type { ChatMessage, AiSuggestedProduct, ProductForAI } from '@/lib/types'; // Updated import
import Image from 'next/image'; // Import for displaying product images
// import Link from 'next/link'; // Import if using Links for products

export default function AIAssistantPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // Use updated ChatMessage type
  const { user, token, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const {
    isListening,
    startListening,
    stopListening,
    sttError,
    finalTranscript,
    isSTTSupported,
    isSpeaking,
    speak,
    cancelSpeaking,
    ttsError,
    isTTSSupported,
  } = useWebSpeech({
    onSTTResult: (transcript, isFinal) => {
      if (isFinal) {
        // Automatically set query and submit when STT provides a final result
        // This will be handled in an effect listening to finalTranscript
      }
    },
    onSTTError: (error) => {
      toast({ title: "Voice Input Error", description: error || "An unknown error occurred.", variant: "destructive" });
    },
    onTTSEnd: () => {
      // console.log("TTS Finished");
    },
    onTTSStart: () => {
      // console.log("TTS Started");
    }
  });

  const [chatAreaMode, setChatAreaMode] = useState<'full' | 'sidebar'>('full');
  // canvasProducts will now hold AiSuggestedProduct if the canvas is updated,
  // or we might need an adapter if ProductCanvas expects ProductForAI.
  // For now, let's assume ProductCanvas can take AiSuggestedProduct or we adapt here.
  const [canvasProducts, setCanvasProducts] = useState<AiSuggestedProduct[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSubmitSttRef = useRef(false); // Ref to control auto-submission after STT

  const saveConversation = async (queryText: string, responseText: string, imageUrlContext?: string) => {
    if (!isAuthenticated || !token) {
      // Not logged in, or token not available, so don't attempt to save.
      return;
    }

    try {
      const response = await fetch('/api/user/ai-conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'shopping_assistant',
          query: queryText,
          response: responseText,
          imageUrlContext: imageUrlContext || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Catch if error response isn't valid JSON
        console.error('Failed to save shopping_assistant conversation:', response.status, errorData);
        // Optional: Toast a silent error or log to an error tracking service
      } else {
        console.log('Shopping_assistant conversation saved successfully.');
        // const savedConversation = await response.json(); // if needed
      }
    } catch (error) {
      console.error('Error saving shopping_assistant conversation:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Effect to handle auto-submission when finalTranscript is updated by STT
  useEffect(() => {
    if (finalTranscript && autoSubmitSttRef.current) {
      setQuery(finalTranscript); // Set the query input with the transcript
      // Trigger handleSubmit after state update
      // Using a timeout to ensure 'query' state is updated before submit
      setTimeout(() => {
        handleSubmit();
        autoSubmitSttRef.current = false; // Reset auto-submit flag
      }, 0);
    }
  }, [finalTranscript]); // Dependency on finalTranscript

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const currentQuery = query.trim();
    if (!currentQuery) return;

    if (!isAuthenticated || !token) {
      toast({ title: "Authentication Required", description: "Please log in to use the AI Assistant.", variant: "destructive" });
      return;
    }

    // Prepare history for API (send last N messages, excluding current query)
    const conversationHistoryForApi = messages
      .slice(-10) // Example: Take last 10 messages
      .map(m => ({ role: m.role, content: m.content }));

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: currentQuery };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setQuery('');
    setCanvasProducts([]); // Clear previous products

    try {
      const response = await fetch('/api/ai/shopping-assistant/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query: currentQuery, conversation_history: conversationHistoryForApi }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse AI response." }));
        const detail = errorData.details ? JSON.stringify(errorData.details) : errorData.error;
        throw new Error(detail || `AI service failed with status ${response.status}`);
      }
      
      const result = await response.json(); // FastAPI response: { reply: string, suggested_products?: AiSuggestedProduct[] }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.reply || "I'm not sure how to respond to that.",
        suggestedProducts: result.suggested_products || [], // Use new field
        // products: result.suggested_products ? result.suggested_products.map(p => ({...p, id: String(p.id), price: String(p.price) })) : [], // Adapter if ProductCanvas needs ProductForAI
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (result.reply && isTTSSupported) {
        speak(result.reply);
      }

      // Use assistantMessage.suggestedProducts for ProductCanvas
      if (assistantMessage.suggestedProducts && assistantMessage.suggestedProducts.length > 0) {
        // Assuming ProductCanvas is updated or can handle AiSuggestedProduct[]
        // If ProductCanvas strictly needs ProductForAI[], an adapter function would be needed here.
        // For now, directly pass AiSuggestedProduct[] assuming compatibility or future update of ProductCanvas.
        setCanvasProducts(assistantMessage.suggestedProducts);
        setChatAreaMode('sidebar');
      } else {
        if (chatAreaMode === 'full') {
            setCanvasProducts([]);
        } else if (chatAreaMode === 'sidebar' && (!assistantMessage.suggestedProducts || assistantMessage.suggestedProducts.length === 0)) {
            setCanvasProducts([]);
        }
      }
      
      await saveConversation(currentQuery, assistantMessage.content);

    } catch (error: any) {
      console.error('Error calling AI Assistant proxy:', error);
      const errorResponseMessage = error.message || "Sorry, I couldn't connect to the AI assistant right now.";
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${errorResponseMessage}`,
        // No responseType in ChatMessage, error is handled by content
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({ title: "Error", description: errorResponseMessage, variant: "destructive" });
      setChatAreaMode('full'); // Revert to full chat on error
      setCanvasProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToFullChat = () => {
    setChatAreaMode('full');
    setCanvasProducts([]);
  };

  const handleVoiceInputClick = () => {
    if (!isSTTSupported) {
      toast({ 
        title: "Voice Input Not Supported", 
        description: "Your browser does not support speech recognition.", 
        variant: "destructive" 
      });
      return;
    }
    if (isListening) {
      stopListening();
      autoSubmitSttRef.current = false; // Prevent auto-submit if stopped manually
    } else {
      autoSubmitSttRef.current = true; // Set flag to auto-submit when result is final
      startListening('en-US');
    }
  };

  // Button to toggle TTS for the last assistant message
  const handleToggleTTSForLastMessage = () => {
    if (isSpeaking) {
      cancelSpeaking();
    } else {
      const lastAssistantMessage = messages.filter(msg => msg.role === 'assistant').pop();
      if (lastAssistantMessage && lastAssistantMessage.content && isTTSSupported) {
        speak(lastAssistantMessage.content);
      } else if (!isTTSSupported) {
        toast({ 
          title: "Text-to-Speech Not Supported", 
          description: "Your browser does not support speech synthesis.", 
          variant: "destructive" 
        });
      }
    }
  };


  return (
    <div className={cn("mx-auto space-y-8 transition-all duration-300 ease-in-out", chatAreaMode === 'full' ? 'max-w-3xl' : 'max-w-full')}>
      <header className={cn("text-center space-y-2", chatAreaMode === 'sidebar' ? 'hidden sm:block sm:text-left sm:mb-4 sm:pl-4' : '')}>
        <div className={cn("flex items-center justify-center", chatAreaMode === 'sidebar' ? 'sm:justify-start' : '')}>
          <Sparkles className={cn("mx-auto h-12 w-12 text-primary", chatAreaMode === 'sidebar' ? 'sm:mx-0 sm:h-10 sm:w-10' : 'sm:h-16 sm:w-16')} />
          <h1 className={cn("text-3xl font-headline font-bold tracking-tight sm:text-4xl ml-3", chatAreaMode === 'sidebar' ? 'sm:text-2xl' : 'sm:text-5xl')}>
            AI Shopping Assistant
          </h1>
        </div>
        {chatAreaMode === 'full' && (
          <p className="text-lg text-muted-foreground">
            Describe what you&apos;re looking for, and I&apos;ll suggest some products!
          </p>
        )}
      </header>

      <div className={cn("flex flex-col sm:flex-row gap-6", chatAreaMode === 'sidebar' ? 'h-[calc(100vh-200px)] sm:h-[calc(100vh-250px)]' : '')}>
        <Card className={cn("shadow-xl w-full transition-all duration-300 ease-in-out", chatAreaMode === 'sidebar' ? 'sm:w-1/3 lg:w-1/4 flex flex-col' : 'sm:w-full')}>
          <CardContent className="p-4 sm:p-6 space-y-4 flex flex-col flex-grow">
            <div className="space-y-4 flex-grow overflow-y-auto h-[300px] sm:h-auto p-2 sm:p-4 border rounded-md">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Bot size={48} className="mb-2"/>
                  <p>No messages yet. Ask me something!</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-lg max-w-[85%] shadow-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    {msg.role === 'user' && <User className="inline h-4 w-4 mr-2 align-middle" />}
                    {msg.role === 'assistant' && <Bot className="inline h-4 w-4 mr-2 align-middle" />}
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                    {/* Display Suggested Products */}
                    {msg.role === 'assistant' && msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <h4 className="text-sm font-semibold mb-2 text-foreground/90">Suggested Products:</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.suggestedProducts.map((product: AiSuggestedProduct) => (
                            <div key={product.id} className="border p-2 rounded-md bg-card/80 text-xs text-card-foreground">
                              {product.image_url && (
                                <div className="w-full h-20 relative mb-1 rounded overflow-hidden">
                                  <Image
                                    src={product.image_url}
                                    alt={product.name}
                                    layout="fill"
                                    objectFit="cover"
                                    className="rounded"
                                  />
                                </div>
                              )}
                              <p className="font-semibold truncate text-foreground" title={product.name}>{product.name}</p>
                              <p>Price: ${product.price.toFixed(2)}</p>
                              {product.category_name && <p className="text-muted-foreground truncate">Category: {product.category_name}</p>}
                              {/*
                                To make it a link, we need to know if product.id (number, from cj_products.platform_product_id)
                                can be used directly in storefront URLs like /products/[id].
                                The main Product type has id: string. This needs careful consideration.
                                For now, just display info.
                                Example Link (if ID strategy is confirmed):
                                <Link href={`/products/${product.id}`} className="text-blue-600 hover:underline">View Details</Link>
                              */}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && !isListening && ( // Show thinking loader only if not listening for STT
                  <div className="flex justify-start">
                      <div className="p-3 rounded-lg bg-secondary flex items-center">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Thinking...
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={chatAreaMode === 'sidebar' ? "Refine your search..." : "e.g., 'eco-friendly kitchen items'"}
                className="flex-grow resize-none text-base"
                rows={chatAreaMode === 'sidebar' ? 2 : 3}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                type="button" 
                onClick={handleVoiceInputClick} 
                  className={cn("self-end h-full px-3 py-2 text-muted-foreground hover:text-primary", isListening && "text-destructive hover:text-destructive/80")}
                  aria-label={isListening ? "Stop voice input" : "Use voice input"}
                  disabled={isLoading || !isSTTSupported}
                  title={!isSTTSupported ? "Voice input not supported" : (isListening ? "Stop listening" : "Start listening")}
              >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button type="submit" disabled={isLoading || !query.trim()} size="lg" className="self-end h-full px-4 py-2">
                  {isLoading && !isListening ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                <span className="ml-2 hidden md:inline">{chatAreaMode === 'sidebar' ? 'Send' : 'Ask AI'}</span>
              </Button>
            </form>
             {chatAreaMode === 'sidebar' && (
                <Button variant="outline" onClick={handleReturnToFullChat} className="w-full mt-2">
                  <CornerDownLeft className="mr-2 h-4 w-4" /> Back to Full Chat / New Search
                </Button>
              )}
          </CardContent>
        </Card>

        {/* ProductCanvas might need to be adapted or replaced if its product type is different */}
        {chatAreaMode === 'sidebar' && canvasProducts.length > 0 && (
          <div className="w-full sm:w-2/3 lg:w-3/4 overflow-hidden">
            <h2 className="text-xl font-semibold mb-3 text-center sm:text-left">Product Visualizations</h2>
             {/*
              WARNING: ProductCanvas expects `products: ProductForAI[]`.
              We are passing `canvasProducts` which is now `AiSuggestedProduct[]`.
              This will likely cause type errors or rendering issues in ProductCanvas.
              This needs to be addressed either by:
              1. Updating ProductCanvas to accept AiSuggestedProduct[].
              2. Creating an adapter function here to convert AiSuggestedProduct[] to ProductForAI[].
              For this subtask, we are focusing on AIAssistantPage and type definitions.
              The line below will pass the new type.
            */}
            <ProductCanvas products={canvasProducts as any} /> {/* Cast to any to bypass type error for now */}
          </div>
        )}
         {chatAreaMode === 'sidebar' && canvasProducts.length === 0 && !isLoading && (
            <div className="w-full sm:w-2/3 lg:w-3/4 flex flex-col items-center justify-center text-muted-foreground p-8 border rounded-lg bg-card">
                <XCircle size={64} className="mb-4"/>
                <p className="text-xl text-center">No products to display for the current AI response.</p>
                <p className="text-sm text-center mt-2">The AI might be asking for clarification, or no specific products were found for your query.</p>
            </div>
        )}
      </div>
    </div>
  );
}
