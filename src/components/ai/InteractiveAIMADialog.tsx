"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send } from 'lucide-react';
import useWebSpeech from '@/hooks/useWebSpeech'; // Import the hook

interface Message {
  sender: 'You' | 'AI';
  text: string;
}

interface InteractiveAIMADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InteractiveAIMADialog: React.FC<InteractiveAIMADialogProps> = ({ open, onOpenChange }) => {
  const { 
    finalTranscript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    sttError 
  } = useWebSpeech();
  const [messages, setMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (finalTranscript) {
      handleSendMessage(finalTranscript, 'You');
    }
  }, [finalTranscript]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = (text: string, sender: 'You' | 'AI') => {
    if (!text.trim()) return;
    const newMessage: Message = { sender, text };
    setMessages(prev => [...prev, newMessage]);

    if (sender === 'You') {
      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = { sender: 'AI', text: `I received your message: "${text}". I am still under development.` };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
      setTypedMessage("");
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Interactive AI AMA</DialogTitle>
          <DialogDescription>
            Ask your questions and get answers from our AI assistant. You can speak your questions or type them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow grid grid-rows-[2fr_1fr] md:grid-rows-1 md:grid-cols-[2fr_1fr] gap-4 py-4 overflow-hidden">
          {/* Left side: Avatar Video + Transcript */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="bg-muted rounded-lg h-[50%] md:h-full flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground">AI Avatar Video Area</p>
            </div>
            <div className="border rounded-lg h-[50%] md:h-[calc(50%-1rem)] p-4 flex flex-col">
              <p className="text-sm text-muted-foreground mb-2">Transcript</p>
              <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                {messages.map((msg, index) => (
                  <p key={index} className={`text-xs p-2 rounded-md ${msg.sender === 'You' ? 'bg-primary/10' : 'bg-secondary'}`}>
                    <strong>{msg.sender}:</strong> {msg.text}
                  </p>
                ))}
                {isListening && interimTranscript && (
                  <p className="text-xs p-2 rounded-md bg-muted-foreground/10 italic">
                    <strong>You:</strong> {interimTranscript}
                  </p>
                )}
                 <div ref={transcriptEndRef} />
              </div>
              {sttError && <p className="text-xs text-destructive mt-2">Error: {sttError}</p>}
            </div>
          </div>

          {/* Right side: Navigation Options */}
          <div className="border rounded-lg p-4 flex flex-col gap-2 items-center justify-start overflow-y-auto">
            <p className="text-sm font-semibold mb-2">Quick Questions</p>
            <Button variant="outline" className="w-full" onClick={() => handleSendMessage('Tell me about TAIC Coin', 'You')}>Learn About TAIC Coin</Button>
            <Button variant="outline" className="w-full" onClick={() => handleSendMessage('What is the Pioneer Program?', 'You')}>Pioneer Program Info</Button>
            <Button variant="outline" className="w-full" onClick={() => handleSendMessage('How do I buy or sell products?', 'You')}>How to Buy/Sell</Button>
            <Button variant="outline" className="w-full" onClick={() => handleSendMessage('What is on the roadmap?', 'You')}>Roadmap Questions</Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center pt-4 border-t">
            <div className="flex items-center w-full gap-2">
                <Button variant="outline" size="icon" onClick={handleMicClick} className={isListening ? 'bg-red-500/20' : ''}>
                    {isListening ? <MicOff className="h-5 w-5"/> : <Mic className="h-5 w-5"/>}
                </Button>
                <Input 
                    placeholder="Or type your message..." 
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(typedMessage, 'You')}
                    className="flex-grow"
                />
                <Button size="icon" onClick={() => handleSendMessage(typedMessage, 'You')}>
                    <Send className="h-5 w-5"/>
                </Button>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-4 sm:mt-0">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
