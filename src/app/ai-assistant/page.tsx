import Link from 'next/link';
import { Metadata } from 'next';
// Consider adding an Image component if you have a visual for the assistant
// import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Meet Your AI Shopping Assistant | TAIC',
  description: 'Discover how the TAIC AI Shopping Assistant can help you find products, get personalized recommendations, compare items, and enhance your shopping experience.',
};

interface Feature {
  id: number;
  title: string;
  description: string;
  icon: string; // Placeholder for icon
}

export default function AiAssistantPage() {
  const features: Feature[] = [
    {
      id: 1,
      title: 'Personalized Product Recommendations',
      description: "Tell our AI assistant what you're looking for, your preferences, or even your mood, and get tailored product suggestions just for you.",
      icon: '🎯',
    },
    {
      id: 2,
      title: 'Smart Product Search & Discovery',
      description: 'Go beyond simple keyword searches. Ask complex questions, describe features, or find items based on use-cases. Our AI understands natural language.',
      icon: '🔍',
    },
    {
      id: 3,
      title: 'Effortless Product Comparison',
      description: 'Struggling to choose between products? Ask the AI assistant to compare features, prices, and reviews side-by-side to help you make the best decision.',
      icon: '⚖️',
    },
    {
      id: 4,
      title: 'Trend Spotting & Gift Ideas',
      description: 'Not sure what to buy? Get inspired! Our AI can suggest trending products, unique gift ideas for any occasion, or help you discover items you never knew you needed.',
      icon: '💡',
    },
    {
      id: 5,
      title: 'Instant Answers & Support',
      description: 'Have quick questions about a product or our services? The AI assistant can provide instant answers and guide you to the right resources.',
      icon: '💬',
    },
    {
      id: 6,
      title: 'Seamless Shopping Journey',
      description: 'From finding the right item to adding it to your cart, our AI assistant is designed to make your shopping experience smoother and more enjoyable.',
      icon: '🛒',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-16">
        {/* Optional: Add an image/icon for the AI assistant here */}
        {/* <Image src="/images/ai-assistant-hero.png" alt="AI Shopping Assistant" width={150} height={150} className="mx-auto mb-6" /> */}
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Your Smart Shopping Companion</h1>
        <p className="text-xl text-muted-foreground">
          Let our AI Shopping Assistant revolutionize the way you discover and buy products.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {features.map((feature) => (
          <div key={feature.id} className="p-6 bg-white shadow-xl rounded-lg">
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{feature.title}</h2>
            <p className="text-gray-700 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
      
      <section className="p-8 bg-purple-50 rounded-lg text-center mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Ready to Experience Smarter Shopping?</h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          The AI Shopping Assistant is integrated directly into your browsing experience. 
          Look for the assistant icon or prompt as you shop to get started.
        </p>
        {/* This link might go to a page where the assistant is prominently featured, or a general products page */}
        <Link href="/products" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          Explore Products with AI Help
        </Link>
      </section>

      <div className="text-center">
        <p className="text-gray-600 mb-2">Want to learn more about the tech behind it?</p>
        <Link href="/about#technology" className="text-purple-600 hover:text-purple-800 font-medium">
          Our Technology &rarr;
        </Link>
      </div>
    </div>
  );
}

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
                  </div>
                </div>
              ))}
              {isLoading && (
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

        {chatAreaMode === 'sidebar' && canvasProducts.length > 0 && (
          <div className="w-full sm:w-2/3 lg:w-3/4 overflow-hidden">
            <h2 className="text-xl font-semibold mb-3 text-center sm:text-left">Product Recommendations</h2>
            <ProductCanvas products={canvasProducts} />
          </div>
        )}
         {chatAreaMode === 'sidebar' && canvasProducts.length === 0 && !isLoading && (
            <div className="w-full sm:w-2/3 lg:w-3/4 flex flex-col items-center justify-center text-muted-foreground p-8 border rounded-lg bg-card">
                <XCircle size={64} className="mb-4"/>
                <p className="text-xl text-center">No products to display for the current AI response.</p>
                <p className="text-sm text-center mt-2">The AI might be asking for clarification, couldn't find specific products, or an error occurred.</p>
            </div>
        )}
      </div>
    </div>
  );
}
