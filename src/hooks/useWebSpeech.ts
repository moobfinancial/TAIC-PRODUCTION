'use client'; // Web Speech API is browser-only

import { useState, useEffect, useCallback, useRef } from 'react';

// Import the global type
declare const SpeechRecognition: {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
};

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

interface UseWebSpeechOptions {
  onSTTResult?: (transcript: string, isFinal: boolean) => void;
  onSTTError?: (error: any) => void;
  onSTTEnd?: () => void;
  onTTSEnd?: () => void;
  onTTSStart?: () => void;
}

interface WebSpeechControls {
  // STT
  isListening: boolean;
  startListening: (lang?: string) => void;
  stopListening: () => void;
  sttError: string | null;
  interimTranscript: string;
  finalTranscript: string;
  isSTTSupported: boolean;

  // TTS
  isSpeaking: boolean;
  speak: (text: string, lang?: string, voiceName?: string, rate?: number, pitch?: number) => void;
  cancelSpeaking: () => void;
  ttsError: string | null;
  isTTSSupported: boolean;
  availableVoices: SpeechSynthesisVoice[];
}

const useWebSpeech = (options?: UseWebSpeechOptions): WebSpeechControls => {
  // --- SpeechRecognition (STT) States ---
  const [isListening, setIsListening] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isSTTSupported, setIsSTTSupported] = useState(false);

  // --- SpeechSynthesis (TTS) States ---
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [isTTSSupported, setIsTTSSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);


  // --- Effect for checking API support and loading voices ---
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
      // Voices might load asynchronously
      speechSynthesisAPI.onvoiceschanged = loadVoices;
      return () => {
        speechSynthesisAPI.onvoiceschanged = null; // Cleanup
      };
    }
  }, []);

  // --- STT Methods ---
  const startListening = useCallback((lang: string = 'en-US') => {
    if (!isSTTSupported || isListening) return;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
        setSttError("Speech recognition is not supported in this browser.");
        return;
    }

    recognitionRef.current = new SpeechRecognitionAPI();
    const recognition = recognitionRef.current;

    if (!recognition) {
      setSttError('Speech recognition not supported in this browser');
      return;
    }

    recognition.lang = lang;
    recognition.interimResults = true; // Get results while speaking
    recognition.continuous = false; // Stop after first pause (can be true for longer dictation)

    setFinalTranscript('');
    setInterimTranscript('');
    setSttError(null);
    setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
      if (options?.onSTTResult) options.onSTTResult(final || interim, event.results[event.results.length-1].isFinal);
      if (final) {
        setFinalTranscript(prev => prev + final); // Append final results
      }
    };

    recognition.onerror = (event: any) => {
      console.error("SpeechRecognition Error:", event.error);
      setSttError(event.error || 'Unknown speech recognition error');
      if (options?.onSTTError) options.onSTTError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (options?.onSTTEnd) options.onSTTEnd();
    };

    try {
      recognition.start();
    } catch (e: any) {
      console.error("Error starting SpeechRecognition:", e);
      setSttError("Failed to start speech recognition: " + e.message);
      setIsListening(false);
    }
  }, [isSTTSupported, isListening, options]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  // --- TTS Methods ---
  const speak = useCallback((text: string, lang: string = 'en-US', voiceName?: string, rate: number = 1, pitch: number = 1) => {
    if (!isTTSSupported || isSpeaking) return;
    if (!text.trim()) {
        setTtsError("Cannot speak empty text.");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    utterance.lang = lang;
    if (voiceName) {
      const voice = availableVoices.find(v => v.name === voiceName);
      if (voice) utterance.voice = voice;
      else console.warn(`TTS Voice not found: ${voiceName}`);
    }
    utterance.rate = Math.max(0.1, Math.min(rate, 10)); // Clamp rate between 0.1 and 10
    utterance.pitch = Math.max(0, Math.min(pitch, 2)); // Clamp pitch between 0 and 2

    setTtsError(null);
    setIsSpeaking(true);
    if (options?.onTTSStart) options.onTTSStart();


    utterance.onend = () => {
      setIsSpeaking(false);
      if (options?.onTTSEnd) options.onTTSEnd();
      utteranceRef.current = null;
    };

    utterance.onerror = (event: any) => {
      console.error("SpeechSynthesis Error:", event.error);
      setTtsError(event.error || 'Unknown speech synthesis error');
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  }, [isTTSSupported, isSpeaking, availableVoices, options]);

  const cancelSpeaking = useCallback(() => {
    if (isTTSSupported && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false); // This might also be set by onend, but good to be explicit
      if (utteranceRef.current) { // Manually trigger onend if needed, as cancel might not always
        if (options?.onTTSEnd) options.onTTSEnd();
      }
      utteranceRef.current = null;
    }
  }, [isTTSSupported, isSpeaking, options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (window.speechSynthesis && isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);


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
