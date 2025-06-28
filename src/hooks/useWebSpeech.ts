'use client'; // Web Speech API is browser-only

import { useState, useEffect, useCallback, useRef } from 'react';

// Interface declarations for SpeechRecognition events
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionEvent extends Event {
  results: any;
  resultIndex: number;
}

// Simple declarations for SpeechRecognition API
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

// Options for the hook
export interface UseWebSpeechOptions {
  onSTTResult?: (transcript: string, isFinal: boolean) => void;
  onSTTError?: (error: any) => void;
  onSTTStart?: () => void;
  onSTTEnd?: () => void;
  onTTSEnd?: () => void;
  onTTSStart?: () => void;
  autoRestartOnNoSpeech?: boolean;
}

// Controls returned by the hook
export interface WebSpeechControls {
  isListening: boolean;
  startListening: (lang?: string) => void;
  stopListening: () => void;
  sttError: string | null;
  interimTranscript: string;
  finalTranscript: string;
  isSTTSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string, lang?: string, voiceName?: string, rate?: number, pitch?: number) => void;
  cancelSpeaking: () => void;
  ttsError: string | null;
  isTTSSupported: boolean;
  availableVoices: SpeechSynthesisVoice[];
}

// The hook implementation
const useWebSpeech = (options: UseWebSpeechOptions = {}): WebSpeechControls => {
  // State variables
  const [isListening, setIsListening] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isSTTSupported, setIsSTTSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [isTTSSupported, setIsTTSSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs for stability and to avoid stale closures
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const userStoppedRef = useRef(false);
  const optionsRef = useRef(options);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Update options ref whenever options prop changes
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    // Support Detection
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSTTSupported(!!SpeechRecognitionAPI);

    const speechSynthesisAPI = window.speechSynthesis;
    setIsTTSSupported(!!speechSynthesisAPI);

    if (speechSynthesisAPI) {
      const loadVoices = () => {
        const voices = speechSynthesisAPI.getVoices();
        if (voices.length > 0) {
          setAvailableVoices(voices);
        }
      };
      loadVoices();
      speechSynthesisAPI.onvoiceschanged = loadVoices;
    }

    // STT Engine Initialization (only once)
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      const recognition = recognitionRef.current;
      
      if (recognition) {
        recognition.continuous = false;
        recognition.interimResults = true;

      // Event Handlers
      recognition.addEventListener('start', () => {
        console.log('%c[STT] 🎤 Speech recognition STARTED!', 'color: #22c55e; font-weight: bold; font-size: 14px;');
        setIsListening(true);
        isListeningRef.current = true;
        userStoppedRef.current = false;
        setSttError(null);
        setInterimTranscript('');
        if (optionsRef.current.onSTTStart) {
          console.log('%c[STT] Calling onSTTStart callback...', 'color: #22c55e;');
          optionsRef.current.onSTTStart();
        }
      });

      recognition.addEventListener('end', () => {
        console.log('%c[STT] 🔇 Speech recognition ENDED!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
        console.log('%c[STT] userStoppedRef.current:', userStoppedRef.current, 'autoRestartOnNoSpeech:', optionsRef.current.autoRestartOnNoSpeech);
        setIsListening(false);
        isListeningRef.current = false;
        if (optionsRef.current.onSTTEnd) optionsRef.current.onSTTEnd();

        // Auto-restart logic
        if (optionsRef.current.autoRestartOnNoSpeech && !userStoppedRef.current) {
          console.log('%c[STT] 🔄 Auto-restarting recognition in 100ms...', 'color: #3b82f6; font-weight: bold;');
          setTimeout(() => {
            if (!isListeningRef.current && !userStoppedRef.current) {
              console.log('%c[STT] 🔄 Executing auto-restart...', 'color: #3b82f6;');
              recognition.start();
            } else {
              console.log('%c[STT] ⏸️ Auto-restart cancelled - isListening:', isListeningRef.current, 'userStopped:', userStoppedRef.current);
            }
          }, 100);
        }
      });

      recognition.addEventListener('error', (event: Event) => {
        const errorEvent = event as SpeechRecognitionErrorEvent;
        console.error('%c[STT] ❌ Speech recognition ERROR!', 'color: #ef4444; font-weight: bold; font-size: 14px;', errorEvent.error);
        let errorMessage = errorEvent.error;
        if (errorEvent.error === 'no-speech') {
          errorMessage = 'No speech was detected.';
        } else if (errorEvent.error === 'audio-capture') {
          errorMessage = 'Microphone not available. Check connection and permissions.';
        } else if (errorEvent.error === 'not-allowed') {
          errorMessage = 'Microphone permission denied. Please enable it in browser settings.';
        } else if (errorEvent.error === 'network') {
          console.warn('%c[STT] 🌐 Network error - speech service unavailable', 'color: #f59e0b; font-weight: bold;');
          console.log('%c[STT] 💡 This is usually temporary. Check internet connection or try again later.', 'color: #f59e0b;');
          errorMessage = 'Network error: Speech recognition service unavailable. Please check your internet connection and try again.';
        } else if (errorEvent.error === 'service-not-allowed') {
          errorMessage = 'Speech recognition service not allowed or unavailable.';
        }
        setSttError(errorMessage);
        setIsListening(false);
        isListeningRef.current = false;
        if (optionsRef.current.onSTTError) {
          console.log('%c[STT] 🚀 Calling onSTTError callback...', 'color: #ef4444;');
          optionsRef.current.onSTTError(errorMessage);
        }
      });

      recognition.addEventListener('result', (event: Event) => {
        console.log('%c[STT] 📝 Speech recognition RESULT received!', 'color: #8b5cf6; font-weight: bold; font-size: 14px;');
        const resultEvent = event as unknown as SpeechRecognitionEvent;
        let interim = '';
        let final = '';

        const results = resultEvent.results;
        for (let i = resultEvent.resultIndex; i < (results as any).length; ++i) {
          const result = results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        
        setInterimTranscript(interim);
        if (final) {
          setFinalTranscript(prev => prev + final);
        }

        if (optionsRef.current.onSTTResult) {
          const transcript = final || interim;
          const isFinal = !!final;
          console.log(`%c[STT] 📝 Transcript: "${transcript}" (Final: ${isFinal})`, 'color: #8b5cf6; font-weight: bold;');
          console.log('%c[STT] 🚀 Calling onSTTResult callback...', 'color: #8b5cf6;');
          optionsRef.current.onSTTResult(transcript, isFinal);
        } else {
          console.log('%c[STT] ⚠️ No onSTTResult callback provided', 'color: #f59e0b;');
        }
      });
      }
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (speechSynthesisAPI) {
        speechSynthesisAPI.cancel();
        speechSynthesisAPI.onvoiceschanged = null;
      }
    };
  }, []);

  // Stable Control Functions
  const startListening = useCallback((lang: string = 'en-US') => {
    console.log('%c[STT] 🚀 startListening() called', 'color: #22c55e; font-weight: bold; font-size: 14px;');
    console.log('%c[STT] Current state - isListeningRef.current:', isListeningRef.current, 'recognitionRef.current:', !!recognitionRef.current);
    
    // Check if speech recognition is available
    if (!recognitionRef.current) {
      console.error('%c[STT] ❌ Speech recognition not initialized', 'color: #ef4444; font-weight: bold;');
      console.error('%c[STT] 🔍 Checking browser support...', 'color: #ef4444;');
      console.error('%c[STT] window.SpeechRecognition:', !!window.SpeechRecognition, 'window.webkitSpeechRecognition:', !!window.webkitSpeechRecognition);
      return;
    }

    if (isListeningRef.current) {
      console.log('%c[STT] ⚠️ Already listening, ignoring start request', 'color: #f59e0b; font-weight: bold;');
      return;
    }

    // Check microphone permissions
    console.log('%c[STT] 🔍 Checking microphone permissions...', 'color: #22c55e;');
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then(result => {
        console.log('%c[STT] 🎤 Microphone permission status:', result.state, 'color: #22c55e;');
      })
      .catch(err => {
        console.log('%c[STT] ⚠️ Could not check microphone permissions:', err, 'color: #f59e0b;');
      });

    try {
      console.log('%c[STT] 🎤 Starting speech recognition...', 'color: #22c55e; font-weight: bold;');
      console.log('%c[STT] 🔧 Recognition settings - lang:', lang, 'continuous:', recognitionRef.current.continuous, 'interimResults:', recognitionRef.current.interimResults);
      userStoppedRef.current = false;
      recognitionRef.current.lang = lang;
      
      // Add a timeout to detect if onstart never fires
      const startTimeout = setTimeout(() => {
        if (!isListeningRef.current) {
          console.error('%c[STT] ⏰ TIMEOUT: Speech recognition start event never fired after 2 seconds!', 'color: #ef4444; font-weight: bold;');
          console.error('%c[STT] 🔍 This usually indicates a permission or browser support issue.', 'color: #ef4444;');
          console.log('%c[STT] 🔄 Attempting to stop and reset recognition...', 'color: #f59e0b;');
          
          // Attempt recovery by stopping and resetting
          try {
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
          } catch (e) {
            console.log('%c[STT] Recovery stop failed:', 'color: #f59e0b;', e);
          }
          
          // Reset state
          isListeningRef.current = false;
          
          // Call error handler if available
          if (options?.onSTTError) {
            options.onSTTError({ error: 'timeout', message: 'Speech recognition failed to start' });
          }
        }
      }, 2000);
      
      recognitionRef.current.start();
      console.log('%c[STT] ✅ recognition.start() called successfully', 'color: #22c55e;');
      
      // Note: timeout will be cleared by the 'start' event listener in useEffect
      
    } catch (error) {
      console.error('%c[STT] ❌ Error starting recognition:', 'color: #ef4444; font-weight: bold;', error);
      console.error('%c[STT] 🔍 Error details:', error);
    }
  }, []);

  const stopListening = useCallback(() => {
    console.log('%c[STT] 🛑 stopListening() called', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
    console.log('%c[STT] Current state - isListeningRef.current:', isListeningRef.current, 'recognitionRef.current:', !!recognitionRef.current);
    
    if (!recognitionRef.current) {
      console.error('%c[STT] ❌ Speech recognition not initialized', 'color: #ef4444; font-weight: bold;');
      return;
    }

    if (!isListeningRef.current) {
      console.log('%c[STT] ⚠️ Not currently listening, ignoring stop request', 'color: #f59e0b; font-weight: bold;');
      return;
    }

    try {
      console.log('%c[STT] 🔇 Stopping speech recognition...', 'color: #3b82f6; font-weight: bold;');
      userStoppedRef.current = true;
      recognitionRef.current.stop();
      console.log('%c[STT] ✅ recognition.stop() called successfully', 'color: #3b82f6;');
    } catch (error) {
      console.error('%c[STT] ❌ Error stopping recognition:', 'color: #ef4444; font-weight: bold;', error);
    }
  }, []);

  const speak = useCallback((text: string, lang: string = 'en-US', voiceName?: string, rate: number = 1, pitch: number = 1) => {
    if (!isTTSSupported) return;
    const speechSynthesisAPI = window.speechSynthesis;
    if (speechSynthesisAPI.speaking) {
      speechSynthesisAPI.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    if (voiceName) {
      const voice = availableVoices.find((v: SpeechSynthesisVoice) => v.name === voiceName);
      if (voice) utterance.voice = voice;
      else console.warn(`Voice '${voiceName}' not found. Using default.`);
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (optionsRef.current.onTTSStart) optionsRef.current.onTTSStart();
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      if (optionsRef.current.onTTSEnd) optionsRef.current.onTTSEnd();
    };
    utterance.onerror = (event) => {
      console.error('[useWebSpeech] TTS Error:', event.error);
      setTtsError(event.error);
      setIsSpeaking(false);
    };
    speechSynthesisAPI.speak(utterance);
  }, [isTTSSupported, availableVoices]);

  const cancelSpeaking = useCallback(() => {
    if (isTTSSupported) {
      window.speechSynthesis.cancel();
    }
  }, [isTTSSupported]);

  // Return public interface
  return {
    isListening,
    startListening,
    stopListening,
    sttError,
    interimTranscript,
    finalTranscript,
    isSTTSupported,
    isSpeaking,
    speak,
    cancelSpeaking,
    ttsError,
    isTTSSupported,
    availableVoices,
  };
};

export default useWebSpeech;
