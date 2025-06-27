import { useState, useRef, useCallback, useEffect } from 'react';
import * as vad from '@ricky0123/vad-web';

interface VADHandlers {
  onFrameProcessed: (probability: number) => void;
}

const useVAD = () => {
  const [isListening, setIsListening] = useState(false);
  const [vadError, setVadError] = useState<string | null>(null);
  const vadRef = useRef<vad.MicVAD | null>(null);
  const handlersRef = useRef<VADHandlers | null>(null);

  const initVAD = useCallback(async () => {
    if (vadRef.current) return;

    console.log('[VAD] Initializing Silero VAD and acquiring microphone...');
    try {
            const myVad = await vad.MicVAD.new({
        positiveSpeechThreshold: 0.3, // Lower threshold for more sensitivity
        negativeSpeechThreshold: 0.15, // Must be between 0 and positiveSpeechThreshold
        onFrameProcessed: (probabilities) => {
          handlersRef.current?.onFrameProcessed?.(probabilities.isSpeech);
        },
        redemptionFrames: 5, // Reduced from 10 for faster response
        additionalAudioConstraints: {
          echoCancellation: true,
          noiseSuppression: true,
        } as any
      });
      vadRef.current = myVad;
      console.log('[VAD] VAD initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize VAD:', error);
      setVadError('VAD initialization failed. Please check microphone permissions and refresh.');
    }
  }, []);

  const start = useCallback(() => {
    if (vadRef.current) {
      console.log('[VAD] Starting VAD processing.');
      vadRef.current.start();
      setIsListening(true);
    } else {
      console.warn('[VAD] Start called before VAD was initialized.');
    }
  }, []);

  const stop = useCallback(() => {
    if (vadRef.current) {
      console.log('[VAD] Pausing VAD processing.');
      vadRef.current.pause();
      setIsListening(false);
    } 
  }, []);

  const attachEventHandlers = useCallback((handlers: VADHandlers) => {
    handlersRef.current = handlers;
    console.log('[VAD] Event handlers attached.');
  }, []);

  // Effect to clean up VAD on unmount
  useEffect(() => {
    return () => {
      if (vadRef.current) {
        console.log('[VAD] Destroying VAD instance.');
        vadRef.current.destroy();
        vadRef.current = null;
      }
    };
  }, []);

  return { isListening, vadError, initVAD, start, stop, attachEventHandlers };
};

export default useVAD;
