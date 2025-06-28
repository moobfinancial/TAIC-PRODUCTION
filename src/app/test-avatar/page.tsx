"use client";

import { useState } from 'react';
import Pioneer_AMA_Canvas from '@/components/interactive-ai/Pioneer_AMA_Canvas';
import { Button } from '@/components/ui/button';

export default function TestAvatarPage() {
  const [isCanvasOpen, setIsCanvasOpen] = useState(true);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Avatar Test Page</h1>
      <p className="mb-4">The canvas should be open by default.</p>
      <Button onClick={() => setIsCanvasOpen(true)} disabled={isCanvasOpen}>
        Open Canvas
      </Button>
      <Pioneer_AMA_Canvas 
        isOpen={isCanvasOpen} 
        onClose={() => setIsCanvasOpen(false)} 
      />
    </div>
  );
}
