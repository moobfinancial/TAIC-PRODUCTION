import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { X, Mic, MicOff, Send, Volume2, VolumeX, Minimize, Maximize } from 'lucide-react';
import useInactivityDetector from '../../hooks/useInactivityDetector';
import useWebSpeech from '../../hooks/useWebSpeech';
import useVAD from '../../hooks/useVAD';

// Extend Window interface for VAD and remaining SitePal functions
declare global {
  interface Window {
    // SitePal functions still needed for speech control
    sayText?: (text: string, voiceId?: string | number, languageId?: number, ttsEngineId?: number) => void;
    stopSpeech?: () => void;
    setFacialExpression?: (expression: string, intensity?: number, duration?: number) => void;
    // VAD module
    vad?: any;
  }
}

// Define types for our API responses
interface Action {
  label: string;
  command?: string;
  link?: string;
}

interface AIResponse {
  speak_text: string;
  canvas_state: string;
  actions?: Action[];
}

interface Pioneer_AMA_CanvasProps {
  isOpen: boolean;
  onClose: () => void;
}

const Pioneer_AMA_Canvas: React.FC<Pioneer_AMA_CanvasProps> = ({ isOpen, onClose }) => {
  // Minimal component for testing
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">TAIC AI Assistant</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <X size={24} />
          </button>
        </div>
        <div className="text-center">
          <p>Component structure test - syntax validation</p>
        </div>
      </div>
    </div>
  );
};

export default Pioneer_AMA_Canvas;
