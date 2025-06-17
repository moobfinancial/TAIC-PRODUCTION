'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ProductCanvas } from '@/components/products/ProductCanvas';
import { ArrowLeft, Send, Mic, MicOff, Volume2, VolumeX, Sparkles, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import useWebSpeech from '@/hooks/useWebSpeech';

// Import types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: ProductForAI[];
}

interface ProductForAI {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category?: string;
  dataAiHint?: string;
}

export default function AiShoppingNowPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canvasProducts, setCanvasProducts] = useState<ProductForAI[]>([]);
  const [chatAreaMode, setChatAreaMode] = useState<'full' | 'sidebar'>('full');
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSubmitSttRef = useRef(false); // Ref to control auto-submission after STT
  
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

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Effect to handle auto-submission when finalTranscript is updated by STT
  useEffect(() => {
    if (finalTranscript && autoSubmitSttRef.current) {
      setInputValue(finalTranscript); // Set the query input with the transcript
      // Trigger handleSubmit after state update
      // Using a timeout to ensure 'inputValue' state is updated before submit
      setTimeout(() => {
        handleSendMessage();
        autoSubmitSttRef.current = false; // Reset auto-submit flag
      }, 0);
    }
  }, [finalTranscript]); // Dependency on finalTranscript

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/shopping-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Sending current message as query, and previous messages as history
        body: JSON.stringify({ query: newUserMessage.content, history: messages }), 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to get response from AI assistant, and error response was not valid JSON.'}));
        throw new Error(errorData.detail || 'Failed to get response from AI assistant');
      }

      const data = await response.json();
      console.log('AI Shopping Assistant response:', data);
      
      // Extract response type and text from the API response
      // Handle both direct response and nested result structure
      const result = data.result || data;
      const responseType = result.responseType || 'clarification';
      const responseText = result.responseText || result.ai_response || 'I processed your request.';
      
      // Process products if they exist in the response
      const fetchedProducts: ProductForAI[] = (result.products || []).map((p: any) => ({
        id: p.id?.toString() || '',
        name: p.name || '',
        description: p.description || '',
        price: typeof p.price === 'string' ? parseFloat(p.price) : (p.price || 0),
        imageUrl: p.image_url || p.imageUrl || '',
        category: p.category || '',
        dataAiHint: p.data_ai_hint || p.dataAiHint || '',
      }));

      // Create the AI response message
      const newAiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        products: fetchedProducts.length > 0 ? fetchedProducts : undefined,
      };
      setMessages((prevMessages) => [...prevMessages, newAiMessage]);

      // Update canvas products and chat area mode based on response type
      if (responseType === 'products' && fetchedProducts.length > 0) {
        setCanvasProducts(fetchedProducts);
        setChatAreaMode('sidebar');
      } else if (responseType === 'no_results') {
        // Show empty canvas with "no results" message
        setCanvasProducts([]);
        setChatAreaMode('sidebar');
      } else {
        // For clarification or error responses, keep chat in full mode
        // but don't clear canvas products if they exist from previous searches
        if (chatAreaMode === 'full') {
          setCanvasProducts([]);
        }
      }

    } catch (error: any) {
      console.error('Error fetching AI response:', error);
      const errorAiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prevMessages) => [...prevMessages, errorAiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle product click in chat messages
  const handleProductClick = (product: ProductForAI) => {
    // Update canvas products and switch to sidebar mode
    setCanvasProducts([product]);
    setChatAreaMode('sidebar');
  };

  // Function to switch back to full chat mode
  const handleBackToFullChat = () => {
    setChatAreaMode('full');
    // We don't clear canvasProducts here to allow toggling back to see products
  };

  // Handle voice input button click
  const handleVoiceInputClick = () => {
    if (!isSTTSupported) {
      toast({ title: "Voice Input Not Supported", description: "Your browser does not support speech recognition.", variant: "destructive" });
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
        toast({ title: "Text-to-Speech Not Supported", description: "Your browser does not support speech synthesis.", variant: "destructive" });
      }
    }
  };

  // Render product references in chat messages
  const renderMessageContent = (msg: ChatMessage) => {
    if (!msg.products || msg.products.length === 0) {
      return <p>{msg.content}</p>;
    }

    // Simple parsing to identify product references
    const parts = msg.content.split(/\[(.*?)\]/g);
    
    return (
      <div>
        {parts.map((part, index) => {
          // Check if this part matches a product name
          const matchedProduct = msg.products?.find(p => 
            p.name.toLowerCase().includes(part.toLowerCase()) || 
            part.toLowerCase().includes(p.name.toLowerCase())
          );
          
          if (matchedProduct) {
            return (
              <button 
                key={index}
                onClick={() => handleProductClick(matchedProduct)}
                className="text-blue-600 hover:underline font-medium"
              >
                {part}
              </button>
            );
          }
          
          return <span key={index}>{part}</span>;
        })}
        
        {msg.products && msg.products.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.products.map(product => (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition-colors"
              >
                View {product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-var(--header-height,4rem))] bg-slate-50 p-4">
      {/* Dynamic Chat Interface - Full width or Sidebar based on chatAreaMode */}
      <div 
        className={cn("flex flex-col bg-white rounded-lg shadow-lg h-full transition-all duration-300 ease-in-out", 
          chatAreaMode === 'full' ? 'w-full max-w-3xl mx-auto' : 'w-full md:w-1/3 lg:w-1/4 min-w-[300px] max-w-[420px]'
        )}
      >
        <div className={cn("p-4 border-b", chatAreaMode === 'sidebar' ? 'flex justify-between items-center' : 'text-center')}>
          <div className={cn("flex items-center", chatAreaMode === 'sidebar' ? '' : 'justify-center')}>
            <Sparkles className={cn("h-6 w-6 text-primary", chatAreaMode === 'sidebar' ? 'mr-2' : 'mx-2')} />
            <h2 className={cn("font-headline font-bold tracking-tight", 
              chatAreaMode === 'sidebar' ? 'text-xl' : 'text-2xl sm:text-3xl'
            )}>AI Shopping Assistant</h2>
          </div>
          {chatAreaMode === 'sidebar' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToFullChat}
              className="flex items-center gap-1 text-xs"
            >
              <ArrowLeft className="h-4 w-4" /> Full Chat
            </Button>
          )}
        </div>
        {chatAreaMode === 'full' && (
          <p className="text-center text-muted-foreground mt-2 px-4">
            Describe what you&apos;re looking for, and I&apos;ll suggest some products!
          </p>
        )}
        <div className="flex-grow p-4 space-y-4 overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Ask me about products you're looking for!</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex items-start gap-2", 
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
              )}
              <div
                className={cn("max-w-xs lg:max-w-md px-4 py-3 rounded-lg shadow", 
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted/50 border border-muted'
                )}
              >
                {msg.role === 'assistant' ? renderMessageContent(msg) : msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start items-start gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg shadow bg-muted/50 border border-muted">
                <span className="italic">AI is thinking...</span>
              </div>
            </div>
          )}
          
          {/* Invisible div for scrolling to the end of messages */}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
              placeholder="Ask about products..."
              className="flex-grow p-2 border rounded-md focus:ring-primary focus:border-primary"
              disabled={isLoading || isListening}
            />
            {/* Microphone button for voice input */}
            <Button
              onClick={handleVoiceInputClick}
              disabled={isLoading || !isSTTSupported}
              variant="outline"
              className={cn(
                "px-3 py-2 transition-colors",
                isListening && "bg-red-100 text-red-600 border-red-300 hover:bg-red-200"
              )}
              title={isSTTSupported ? (isListening ? "Stop listening" : "Start voice input") : "Voice input not supported"}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            {/* Text-to-speech toggle button */}
            <Button
              onClick={handleToggleTTSForLastMessage}
              disabled={isLoading || !isTTSSupported || messages.filter(m => m.role === 'assistant').length === 0}
              variant="outline"
              className={cn(
                "px-3 py-2",
                isSpeaking && "bg-blue-100 text-blue-600 border-blue-300 hover:bg-blue-200"
              )}
              title={isTTSSupported ? (isSpeaking ? "Stop speaking" : "Listen to last response") : "Text-to-speech not supported"}
            >
              {isSpeaking ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            {/* Send button */}
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || isListening}
              className="px-4 py-2"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Product Canvas - Only visible in sidebar mode */}
      {chatAreaMode === 'sidebar' && (
        <div className="hidden md:block flex-1 ml-4 bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center">
              <Sparkles className="h-5 w-5 text-primary mr-2" />
              <h2 className="text-xl font-headline font-semibold">Product Recommendations</h2>
            </div>
          </div>
          <div className="h-[calc(100%-4rem)] p-4">
            {canvasProducts.length > 0 ? (
              <ProductCanvas products={canvasProducts.map(p => ({ ...p, category: p.category || 'Uncategorized', dataAiHint: p.dataAiHint || '' }))} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No products found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
