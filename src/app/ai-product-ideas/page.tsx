
'use client';

import { useState, type FormEvent, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb, Sparkles, Send, Loader2, User, Gift, ImagePlus, CornerDownLeft, XCircle, Mic, MicOff, UploadCloud, CheckCircle } from 'lucide-react'; // Added Mic, MicOff, UploadCloud, CheckCircle
import { generateProductIdeas } from '@/ai/flows/product-idea-generator';
// Update useAuth import path
import { useAuth } from '@/contexts/AuthContext';
// AIConversation type might be an issue if it was removed from User type and not defined elsewhere.
// For now, we are removing the logic that uses it.
// import type { AIConversation, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import useWebSpeech from '@/hooks/useWebSpeech'; // Import the hook
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { ProductCanvas } from '@/components/products/ProductCanvas';
import { MOCK_PRODUCTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ProductForAI } from '@/ai/flows/shopping-assistant';


interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: ProductForAI[];
}

type GeneratorMode = 'product' | 'gift';

export default function AIProductIdeasPage() {
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // updateUser is removed. user and token will be used for API calls if needed.
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>('product');

  // Image states
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // For local blob preview
  const [uploadedImageUrlForContext, setUploadedImageUrlForContext] = useState<string | null>(null); // URL from server
  const [isImageUploading, setIsImageUploading] = useState<boolean>(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chatAreaMode, setChatAreaMode] = useState<'full' | 'sidebar'>('full');
  const [canvasProducts, setCanvasProducts] = useState<ProductForAI[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    startListening,
    stopListening,
    sttError,
    finalTranscript,
    isSTTSupported,
    isSpeaking, // Will be used for TTS
    speak,      // Will be used for TTS
    cancelSpeaking, // Will be used for TTS
    ttsError,       // Will be used for TTS
    isTTSSupported, // Will be used for TTS
  } = useWebSpeech({
    onSTTResult: (transcript, isFinal) => {
      if (isFinal) {
        setDescription(prev => prev + transcript); // Append final transcript to description
      }
    },
    onSTTError: (error) => {
      toast({ title: "Voice Input Error", description: error || "An unknown error occurred.", variant: "destructive" });
    },
    onTTSEnd: () => { /* TTS finished */ },
  });


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Removed useEffect for finalTranscript, as it's handled by onSTTResult in useWebSpeech options

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedImageFile(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview); // Clean up previous blob
      setImagePreview(URL.createObjectURL(file));
      setUploadedImageUrlForContext(null); // Clear any previously uploaded server URL for context
      setImageUploadError(null);
    } else {
      setSelectedImageFile(null);
      if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setImagePreview(null); // Also clear preview if no file selected
    }
  };

  const handleRemoveSelectedImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
    }
    setSelectedImageFile(null);
    setImagePreview(null);
    setUploadedImageUrlForContext(null); // Also clear this
    setImageUploadError(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleImageUploadToServer = async () => {
    if (!selectedImageFile) {
      toast({ 
        title: "No file selected", 
        description: "Please select an image first.", 
        variant: "destructive" 
      });
      return;
    }
    setIsImageUploading(true);
    setImageUploadError(null);
    const formData = new FormData();
    formData.append('file', selectedImageFile);
    // if (user?.id) formData.append('userId', user.id.toString()); // No longer sending userId directly

    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Ensure Content-Type is not set manually for FormData, browser handles it with boundary

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        headers: headers, // Send token if available
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Upload failed: ${response.statusText}`);
      }
      setUploadedImageUrlForContext(result.imageUrl);
      toast({ title: "Image Uploaded", description: "Image ready to be used for context." });
      // Keep selectedFile and imagePreview (blob) for now, or clear them if preferred
      // setSelectedImageFile(null);
      // if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      // setImagePreview(result.imageUrl); // Or show the uploaded image URL as preview
    } catch (error: any) {
      setImageUploadError(error.message);
      toast({ title: "Image Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const currentDescription = description.trim();
    if (!currentDescription) return;

    // User message now only contains the text. Image URL is passed separately.
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: currentDescription };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setDescription('');

    // Reset image states after submit
    handleRemoveSelectedImage();


    if (generatorMode === 'gift') {
      // Simulate AI gift finding for UI demonstration
      // TODO: In future, pass uploadedImageUrlForContext to actual gift generation flow
      console.log("Simulating gift generation. Image context (if any):", uploadedImageUrlForContext);
      setTimeout(() => {
        const mockGiftResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Here are some gift ideas I found (simulated response):",
          products: MOCK_PRODUCTS.slice(0, 3) as ProductForAI[], // Take first 3 as example
        };
        setMessages(prev => [...prev, mockGiftResponse]);
        if (mockGiftResponse.products && mockGiftResponse.products.length > 0) {
          setCanvasProducts(mockGiftResponse.products);
          setChatAreaMode('sidebar');
        } else {
          setCanvasProducts([]);
           // Keep sidebar mode if already there, or switch if it was full
          setChatAreaMode(chatAreaMode === 'full' ? 'sidebar' : chatAreaMode);
        }
        setIsLoading(false);
        toast({
          title: "Gift Ideas (Simulated)",
          description: "Displaying sample gift ideas. Full AI gift finding coming soon!",
        });
      }, 1500);
      return;
    }

    // Proceed with actual product idea generation
    try {
      const result = await generateProductIdeas({
        productDescription: currentDescription,
        imageUrl: uploadedImageUrlForContext || undefined,
        generatorMode: generatorMode
      });
      const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: result.suggestions };
      setMessages(prev => [...prev, assistantMessage]);

      if (isTTSSupported && result.suggestions) { // Speak out the suggestions
        speak(result.suggestions);
      }

      setChatAreaMode('full');
      setCanvasProducts([]);

      // Removed updateUser logic for saving conversations.
      // This would require a backend API.
      // if (user) {
      //   const newConversation: AIConversation = {
      //     id: Date.now().toString(),
      //     type: 'product_idea_generator',
      //     query: currentDescription,
      //     imageUrlContext: uploadedImageUrlForContext || undefined,
      //     response: result.suggestions,
      //     timestamp: new Date().toISOString(),
      //   };
      //   const updatedUserConversations = user.aiConversations ? [...user.aiConversations] : [];
      //   updateUser({ ...user, aiConversations: [...updatedUserConversations, newConversation] });
      // }

    } catch (error) {
      console.error('Error generating product ideas:', error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: "Sorry, I couldn't generate ideas right now." };
      setMessages(prev => [...prev, errorMessage]);
      toast({ title: "Error", description: "Failed to generate product ideas.", variant: "destructive" });
      setChatAreaMode('full');
      setCanvasProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToFullChat = () => {
    setChatAreaMode('full');
    setCanvasProducts([]);
  };

  const handleVoiceInputForDescription = () => {
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
    } else {
      // Clear previous final transcript before starting new one for this specific input
      // (The hook itself doesn't clear finalTranscript automatically on start)
      // For this page, we append, so clearing isn't strictly needed unless we want overwrite behavior.
      // Let's assume append is fine for now.
      startListening('en-US');
    }
  };

  const pageDetails = {
    product: {
      icon: <Lightbulb className={cn("mx-auto h-12 w-12 text-primary", chatAreaMode === 'sidebar' ? 'sm:mx-0 sm:h-10 sm:w-10' : 'sm:h-16 sm:w-16')} />,
      title: "AI Product Idea Generator",
      description: "Share your product concept, and I'll provide innovative suggestions!",
      placeholder: "Describe your product idea... e.g., 'A smart coffee mug...'",
      buttonText: "Generate Ideas",
      messageIcon: <Lightbulb className="inline h-4 w-4 mr-1 align-middle" />,
      thinkingText: "Generating ideas...",
    },
    gift: {
      icon: <Gift className={cn("mx-auto h-12 w-12 text-primary", chatAreaMode === 'sidebar' ? 'sm:mx-0 sm:h-10 sm:w-10' : 'sm:h-16 sm:w-16')} />,
      title: "AI Gift Finder",
      description: "Describe recipient & occasion, and I'll suggest gifts!",
      placeholder: "Recipient & occasion... e.g., 'Dad, 60th birthday, loves fishing.'",
      buttonText: "Find Gifts",
      messageIcon: <Gift className="inline h-4 w-4 mr-1 align-middle" />,
      thinkingText: "Finding gift ideas...",
    }
  };

  const currentDetails = pageDetails[generatorMode];

  return (
    <div className={cn("mx-auto space-y-8 transition-all duration-300 ease-in-out", chatAreaMode === 'full' ? 'max-w-3xl' : 'max-w-full')}>
      <header className={cn("text-center space-y-2", chatAreaMode === 'sidebar' ? 'hidden sm:block sm:text-left sm:mb-4 sm:pl-4' : '')}>
         <div className={cn("flex items-center justify-center", chatAreaMode === 'sidebar' ? 'sm:justify-start' : '')}>
          {currentDetails.icon}
          <h1 className={cn("text-3xl font-headline font-bold tracking-tight sm:text-4xl ml-3", chatAreaMode === 'sidebar' ? 'sm:text-2xl' : 'sm:text-5xl')}>
            {currentDetails.title}
          </h1>
        </div>
        {chatAreaMode === 'full' && (
          <p className="text-lg text-muted-foreground">
            {currentDetails.description}
          </p>
        )}
      </header>

      <div className={cn("flex flex-col sm:flex-row gap-6", chatAreaMode === 'sidebar' ? 'h-[calc(100vh-200px)] sm:h-[calc(100vh-250px)]' : '')}>
        <Card className={cn("shadow-xl w-full transition-all duration-300 ease-in-out", chatAreaMode === 'sidebar' ? 'sm:w-1/3 lg:w-1/4 flex flex-col' : 'sm:w-full')}>
          <CardContent className="p-4 sm:p-6 space-y-6 flex flex-col flex-grow">
            <RadioGroup
                value={generatorMode}
                onValueChange={(value: string) => {
                  setGeneratorMode(value as GeneratorMode);
                  setMessages([]); // Clear messages when mode changes
                  setCanvasProducts([]);
                  setChatAreaMode('full'); // Reset to full chat on mode change
                }}
                className="flex justify-center space-x-4 mb-2"
            >
              <div className="flex items-center space-x-2">
                  <RadioGroupItem value="product" id="product-mode" />
                  <Label htmlFor="product-mode" className="text-base flex items-center gap-2 cursor-pointer">
                      <Lightbulb className="h-5 w-5" /> Product Idea
                  </Label>
              </div>
              <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gift" id="gift-mode" />
                  <Label htmlFor="gift-mode" className="text-base flex items-center gap-2 cursor-pointer">
                      <Gift className="h-5 w-5" /> Gift Idea
                  </Label>
              </div>
            </RadioGroup>
            
            <div className="space-y-4 flex-grow overflow-y-auto h-[300px] sm:h-auto p-2 sm:p-4 border rounded-md">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Sparkles size={48} className="mb-2"/>
                  <p>No messages yet. {generatorMode === 'product' ? "Share your idea!" : "Describe the recipient!"}</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-lg max-w-[85%] shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    {msg.role === 'user' && <User className="inline h-4 w-4 mr-1 align-middle" />}
                    {msg.role === 'assistant' && currentDetails.messageIcon}
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                  <div className="flex justify-start">
                      <div className="p-3 rounded-lg bg-secondary flex items-center">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" /> {currentDetails.thinkingText}
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {generatorMode === 'gift' && (
              <div className="space-y-2">
                  <Label htmlFor="image-upload" className="flex items-center gap-2 text-sm font-medium">
                    <ImagePlus className="h-5 w-5" /> (Optional) Add Image Context:
                </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageChange}
                      ref={fileInputRef}
                      className="text-sm flex-grow"
                      disabled={isImageUploading}
                    />
                    {selectedImageFile && !uploadedImageUrlForContext && (
                       <Button
                          size="sm"
                          variant="outline"
                          onClick={handleImageUploadToServer}
                          disabled={isImageUploading}
                          className="whitespace-nowrap"
                        >
                          {isImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                          <span className="ml-2">Upload</span>
                        </Button>
                    )}
                  </div>
                  {imageUploadError && <p className="text-xs text-destructive mt-1">{imageUploadError}</p>}

                  {imagePreview && !uploadedImageUrlForContext && ( // Show local blob preview before upload
                    <div className="mt-2 relative w-24 h-24 border rounded-md overflow-hidden group">
                    <img src={imagePreview} alt="Preview" className="object-cover w-full h-full" />
                     <Button 
                          variant="destructive"
                        size="icon" 
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={handleRemoveSelectedImage}
                          aria-label="Remove selected image"
                        >
                        <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                  {uploadedImageUrlForContext && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> Image uploaded and will be used for context.
                      </p>
                      <img src={uploadedImageUrlForContext} alt="Uploaded context" className="w-24 h-24 object-cover border rounded-md" />
                       <Button variant="link" size="sm" onClick={handleRemoveSelectedImage} className="text-xs p-0 h-auto">Remove image context</Button>
                    </div>
                  )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={currentDetails.placeholder}
                className="flex-grow resize-none text-base"
                rows={chatAreaMode === 'sidebar' ? 2 : 3}
                disabled={isLoading || isListening} // Disable textarea while listening
                 onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isListening) { // Don't submit if listening
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <div className="flex items-end h-full"> {/* Wrapper for buttons */}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={handleVoiceInputForDescription}
                  className={cn("px-3 py-2 text-muted-foreground hover:text-primary", isListening && "text-destructive hover:text-destructive/80")}
                  aria-label={isListening ? "Stop voice input" : "Use voice input for description"}
                  disabled={isLoading || !isSTTSupported}
                  title={!isSTTSupported ? "Voice input not supported" : (isListening ? "Stop listening" : "Start listening for description")}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !description.trim() || isListening}
                  size="lg"
                  className="px-4 py-2" // Adjusted padding for consistency if icon only changes
                >
                  {isLoading && !isListening ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  <span className="ml-2 hidden md:inline">{chatAreaMode === 'sidebar' ? 'Send' : currentDetails.buttonText}</span>
                </Button>
              </div>
            </form>
            {sttError && <p className="text-xs text-destructive mt-1">Voice input error: {sttError}</p>}
            {ttsError && <p className="text-xs text-destructive mt-1">Speech output error: {ttsError}</p>}
            {chatAreaMode === 'sidebar' && (
                <Button variant="outline" onClick={handleReturnToFullChat} className="w-full mt-2">
                  <CornerDownLeft className="mr-2 h-4 w-4" /> Back to Full Chat / New Search
                </Button>
            )}
          </CardContent>
        </Card>

        {chatAreaMode === 'sidebar' && canvasProducts.length > 0 && (
          <div className="w-full sm:w-2/3 lg:w-3/4 overflow-hidden">
            <h2 className="text-xl font-semibold mb-3 text-center sm:text-left">Recommended Gift Ideas</h2>
            <ProductCanvas products={canvasProducts} productCardContext="giftIdea" showVirtualTryOn />
          </div>
        )}
        {chatAreaMode === 'sidebar' && canvasProducts.length === 0 && !isLoading && (
            <div className="w-full sm:w-2/3 lg:w-3/4 flex flex-col items-center justify-center text-muted-foreground p-8 border rounded-lg bg-card">
                <XCircle size={64} className="mb-4"/>
                <p className="text-xl text-center">No gift ideas to display currently.</p>
                <p className="text-sm text-center mt-2">The AI might be processing, or no specific gifts were found for the (simulated) criteria.</p>
            </div>
        )}
      </div>
    </div>
  );
}
