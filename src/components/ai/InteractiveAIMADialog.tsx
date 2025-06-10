"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface InteractiveAIMADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InteractiveAIMADialog: React.FC<InteractiveAIMADialogProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Interactive AI AMA</DialogTitle>
          <DialogDescription>
            Ask your questions and get answers from our AI assistant. You can speak your questions or type them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow grid grid-rows-[2fr_1fr] md:grid-rows-1 md:grid-cols-[2fr_1fr] gap-4 py-4 overflow-hidden">
          {/* Left side: Avatar Video + Transcript */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="bg-muted rounded-lg h-[60%] md:h-full flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground">AI Avatar Video Area</p>
            </div>
            <div className="border rounded-lg h-[40%] md:h-[calc(40%-1rem)] p-4 overflow-y-auto">
              <p className="text-sm text-muted-foreground">Transcript Area</p>
              {/* Placeholder for transcript messages */}
              <div className="space-y-2 mt-2">
                <p className="text-xs bg-primary/10 p-2 rounded-md"><strong>You:</strong> Hello AI!</p>
                <p className="text-xs bg-secondary p-2 rounded-md"><strong>AI:</strong> Hello! How can I help you today?</p>
              </div>
            </div>
          </div>

          {/* Right side: Navigation Options */}
          <div className="border rounded-lg p-4 flex flex-col gap-2 items-center justify-start overflow-y-auto">
            <p className="text-sm font-semibold mb-2">Navigation Options</p>
            <Button variant="outline" className="w-full">Learn About TAIC Coin</Button>
            <Button variant="outline" className="w-full">Pioneer Program Info</Button>
            <Button variant="outline" className="w-full">How to Buy/Sell</Button>
            <Button variant="outline" className="w-full">Roadmap Questions</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
