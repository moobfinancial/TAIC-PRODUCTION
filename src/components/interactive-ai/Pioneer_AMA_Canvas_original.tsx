import React, { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { useSitePalScript } from '../../hooks/useSitePalScript';
import { X, Mic, MicOff, Send, Volume2, VolumeX, Minimize, Maximize } from 'lucide-react';
import { SitePal } from 'sitepal-react-v2'; // Official SitePal React package with named import
import useInactivityDetector from '../../hooks/useInactivityDetector';
import useWebSpeech from '../../hooks/useWebSpeech';
import useVAD from '../../hooks/useVAD';
import { SITEPAL_CONFIG } from '../../config/sitepalConfig';

// Extend Window interface for VAD and remaining SitePal functions
declare global {
  interface Window {
    // SitePal functions still needed for speech control
    sayText?: (text: string, voiceId?: string | number, languageId?: number, ttsEngineId?: number) => void;
    stopSpeech?: () => void;
    setFacialExpression?: (expression: string, intensity?: number, duration?: number) => void;
    // VAD module
    vad?: any;
    vh_sceneLoaded?: (slideIndex: number, portal: any) => void;
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
  // --- State Machine Definition ---
  type State = {
    status: 'INITIALIZING' | 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';
    errorMessage: string | null;
    loadingMessage: string | null;
    aiResponseText: string;
    avatarMessages: string[];
    actions: Action[];
    userInput: string;
    threadId: string | null;
    isMuted: boolean;
    isAvatarReady: boolean;
    isGreetingSpoken: boolean;
    isCopilotMode: boolean;
    hasOfferedProactiveHelp: boolean;
    isInitialized: boolean;
    isInitializing: boolean;
    isStreaming: boolean; // New: Track if we're currently receiving a streaming response
  };

  type ActionType =
    | { type: 'INITIALIZE_SUCCESS' }
    | { type: 'SET_INITIALIZING'; payload: boolean }
    | { type: 'SET_INITIALIZED'; payload: boolean }
    | { type: 'START_LISTENING' }
    | { type: 'STOP_LISTENING' }
    | { type: 'USER_INPUT_FINAL'; payload: string }
    | { type: 'START_PROCESSING' }
    | { type: 'STOP_PROCESSING' }
    | { type: 'AI_RESPONSE_START' }
    | { type: 'AI_RESPONSE_STREAMING'; payload: string }
    | { type: 'AI_RESPONSE_COMPLETE'; payload: string }
    | { type: 'AI_RESPONSE_STREAMING_START' } // Legacy: Start streaming response
    | { type: 'AI_RESPONSE_STREAMING_CHUNK'; payload: string } // Legacy: Receive streaming chunk
    | { type: 'AI_RESPONSE_SUCCESS'; payload: AIResponse }
    | { type: 'START_SPEAKING'; payload: string }
    | { type: 'FINISH_SPEAKING' }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'RESET' }
    | { type: 'TOGGLE_MUTE' }
    | { type: 'TOGGLE_COPILOT_MODE' }
    | { type: 'SET_AVATAR_MESSAGES'; payload: string[] }
    | { type: 'SET_USER_INPUT'; payload: string }
    | { type: 'SET_THREAD_ID'; payload: string }
    | { type: 'SET_GREETING_SPOKEN'; payload: boolean }
    | { type: 'SET_OFFERED_HELP'; payload: boolean };

  const initialState: State = {
    status: 'INITIALIZING',
    errorMessage: null,
    loadingMessage: 'Initializing AI Assistant...',
    aiResponseText: 'Initializing AI Assistant...',
    avatarMessages: [],
    actions: [],
    userInput: '',
    threadId: null,
    isMuted: false,
    isAvatarReady: false,
    isGreetingSpoken: false,
    isCopilotMode: false,
    hasOfferedProactiveHelp: false,
    isInitialized: false,
    isInitializing: false,
    isStreaming: false, // New: Track if we're currently receiving a streaming response
  };

  const reducer = (state: State, action: ActionType): State => {
    switch (action.type) {
      case 'INITIALIZE_SUCCESS':
        return { ...state, status: 'IDLE', loadingMessage: null, isInitialized: true, isInitializing: false };
      case 'SET_INITIALIZING':
        return { ...state, isInitializing: action.payload };
      case 'SET_INITIALIZED':
        return { ...state, isInitialized: action.payload };
      case 'START_LISTENING':
        return { ...state, status: 'LISTENING', userInput: '' };
      case 'STOP_LISTENING':
        return { ...state, status: 'IDLE' };
      case 'USER_INPUT_FINAL':
        return { ...state, userInput: action.payload, avatarMessages: [...state.avatarMessages, `You: ${action.payload}`] };
      case 'START_PROCESSING':
        return { ...state, status: 'PROCESSING' };
      case 'AI_RESPONSE_STREAMING_START':
          // Add a placeholder for the AI's message
          return {
              ...state,
              status: 'SPEAKING',
              isStreaming: true,
              avatarMessages: [...state.avatarMessages, 'AI: '],
              aiResponseText: '',
          };
      case 'AI_RESPONSE_STREAMING_CHUNK': {
          const newMessages = [...state.avatarMessages];
          // Always update the very last message in the array
          newMessages[newMessages.length - 1] = `AI: ${action.payload}`;
          return {
              ...state,
              aiResponseText: action.payload,
              avatarMessages: newMessages,
          };
      }
      case 'AI_RESPONSE_SUCCESS':
        return { 
          ...state, 
          status: 'SPEAKING', 
          isStreaming: false,
          aiResponseText: action.payload.speak_text, 
          actions: action.payload.actions || [], 
          // Ensure we have the final message in the avatar messages
          avatarMessages: [
            ...state.avatarMessages.filter(msg => !msg.startsWith('AI: ')),
            `AI: ${action.payload.speak_text}`
          ]
        };
      case 'START_SPEAKING':
        return { ...state, status: 'SPEAKING', aiResponseText: action.payload };
      case 'FINISH_SPEAKING':
        return { ...state, status: 'IDLE', isStreaming: false };
      case 'SET_ERROR':
        return { ...state, status: 'ERROR', errorMessage: action.payload, isInitializing: false, isStreaming: false };
      case 'RESET':
        return { ...initialState, isMuted: state.isMuted }; // Persist mute state on reset
      case 'TOGGLE_MUTE':
        return { ...state, isMuted: !state.isMuted };
      case 'TOGGLE_COPILOT_MODE':
        return { ...state, isCopilotMode: !state.isCopilotMode };
      case 'SET_AVATAR_MESSAGES':
        return { ...state, avatarMessages: action.payload };
      case 'SET_THREAD_ID':
        return { ...state, threadId: action.payload };
      case 'SET_GREETING_SPOKEN':
        return { ...state, isGreetingSpoken: action.payload };
      case 'SET_OFFERED_HELP':
        return { ...state, hasOfferedProactiveHelp: action.payload };
      case 'SET_USER_INPUT':
        return { ...state, userInput: action.payload };
      default:
        return state;
    }
  };

  const [state, dispatch] = React.useReducer(reducer, initialState);

  // --- Refs ---
  const isAvatarSpeaking = useRef(false);
  const didBargeInRef = useRef(false);
  const isAvatarStartingSpeechRef = useRef(false);
  const speechEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for speech duration
  const initializedRef = useRef(false); // Guard against double initialization
  const vadRef = useRef<any>(null);
  const sentenceQueue = useRef<string[]>([]); // New ref for the speech queue

  // --- Animation Handlers ---
  const playListeningAnimation = useCallback(() => {
    if (window.setFacialExpression) {
      console.log("%c[Animation] Playing 'Thinking' animation.", "color: purple;");
      window.setFacialExpression('Thinking', 1.0, -1);
    }
  }, []);

  const playIdleAnimation = useCallback(() => {
    if (window.setFacialExpression) {
      console.log("%c[Animation] Setting animation to 'None' (Idle).", "color: purple;");
      window.setFacialExpression('None');
    }
  }, []);

  // --- VAD Control Functions ---
  const startVAD = useCallback(() => {
    if (!vadRef.current) {
      console.log('[VAD] Start called before VAD was initialized.');
      return;
    }
    vadRef.current.start();
    console.log('[VAD] Started');  
  }, []);

  const stopVAD = useCallback(() => {
    if (!vadRef.current) {
      console.log('[VAD] Stop called before VAD was initialized.');
      return;
    }
    vadRef.current.stop();
    console.log('[VAD] Stopped');
  }, []);

  const initVAD = useCallback(async () => {
    if (vadRef.current) {
      console.log('[VAD] VAD already initialized');
      return vadRef.current;
    }
    
    // Check if window.vad is defined
    if (typeof window.vad !== 'undefined') {
      vadRef.current = window.vad;
      console.log('[VAD] Initialized from window.vad');
      return vadRef.current;
    } else {
      console.error('[VAD] window.vad is not defined');
      return null;
    }
  }, []);
  
  // Initialize the startListening function
  const startListening = useCallback(() => {
    if (state.status === 'LISTENING') return;
    
    console.log('[Speech] Starting listening...');
    dispatch({ type: 'START_LISTENING' });
    
    if (vadRef.current) {
      startVAD();
    }
  }, [state.status, startVAD, dispatch]);
  

  
  const stopListening = useCallback(() => {
    if (state.status !== 'LISTENING') return;
    
    console.log('[Speech] Stopping listening...');
    dispatch({ type: 'STOP_LISTENING' });
    
    if (vadRef.current) {
      stopVAD();
    }
  }, [state.status, stopVAD, dispatch]);
  
  // Process command function - moved before handleSceneLoad to fix declaration order
  const processCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    
    dispatch({ type: 'START_PROCESSING' });
    dispatch({ type: 'SET_USER_INPUT', payload: command });
    
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: command,
          threadId: state.threadId,
          conversationHistory: state.avatarMessages
        })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      let fullResponse = '';
      dispatch({ type: 'AI_RESPONSE_STREAMING_START' });
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        fullResponse += chunk;
        dispatch({ type: 'AI_RESPONSE_STREAMING_CHUNK', payload: chunk });
      }
      
      dispatch({ type: 'AI_RESPONSE_COMPLETE', payload: fullResponse });
      
      // Trigger avatar speech
      if (fullResponse.trim()) {
        safeSayText(fullResponse);
      }
      
    } catch (error) {
      console.error('Error processing command:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' });
    }
  }, [state.threadId, state.avatarMessages, dispatch]);

  // SitePal component callback for when the scene is fully loaded
  const handleSceneLoad = useCallback((slideIndex: number, portal: any) => {
    console.log('%c[SitePal] handleSceneLoad: Scene is fully loaded and ready.', 'color: green; font-weight: bold;', { slideIndex, portal });
    
    // Set the avatar as ready
    dispatch({ type: 'SET_INITIALIZED', payload: true });
    
    // Only trigger greeting if we haven't done so yet
    if (!state.isGreetingSpoken) {
      console.log('[SitePal] Triggering initial greeting');
      // Short delay to ensure all SitePal resources are fully initialized
      setTimeout(() => {
        processCommand("A user has just arrived. Please greet them.");
        dispatch({ type: 'SET_GREETING_SPOKEN', payload: true });
      }, 500);
    }
  }, [processCommand, dispatch, state.isGreetingSpoken]);

  // Function to safely call sayText with error handling
  const safeSayText = useCallback((text: string) => {
    if (!window.sayText || typeof window.sayText !== 'function') {
      console.error('[SitePal] sayText function not available');
      return false;
    }
    try {
      window.sayText(text);
      return true;
    } catch (error) {
      console.error('[SitePal] Error calling sayText:', error);
      return false;
    }
  }, []);

  // Safe wrapper for SitePal stopSpeech API
  const safeStopSpeech = useCallback(() => {
    if (!window.stopSpeech || typeof window.stopSpeech !== 'function') {
      console.error('[SitePal] stopSpeech function not available');
      return false;
    }
    try {
      window.stopSpeech();
      return true;
    } catch (error) {
      console.error('[SitePal] Error calling stopSpeech:', error);
      return false;
    }
  }, []);
  
  // Function to speak text and then start listening
  const speakAndListen = useCallback((text: string) => {
    if (safeSayText(text)) {
      isAvatarSpeaking.current = true;
      // Set a timeout to start listening after speech ends
      // This is a fallback in case the speech end event doesn't fire
      const timeoutMs = text.length * 80; // Rough estimate: 80ms per character
      speechTimeoutRef.current = setTimeout(() => {
        if (isAvatarSpeaking.current) {
          console.log('[Speech] Timeout reached, starting to listen');
          isAvatarSpeaking.current = false;
          startListening();
          dispatch({ type: 'START_LISTENING' });
        }
      }, timeoutMs);
    } else {
      // If speech fails, go straight to listening
      startListening();
      dispatch({ type: 'START_LISTENING' });
    }
  }, [safeSayText, startListening, dispatch]);

  // SitePal speech event handlers
  const handleSitePalSpeechStart = useCallback(() => {
    console.log("%c[SitePal] Speech started - Avatar is speaking.", "color: blue;");
    
    // Update state to reflect avatar is speaking
    isAvatarSpeaking.current = true;
    dispatch({ type: 'START_SPEAKING', payload: state.aiResponseText });

    // Clear any existing timeouts
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }

    // Calculate speech duration based on word count
    const wordCount = state.aiResponseText.split(/\s+/).length;
    const estimatedDuration = 4000 + (wordCount * 150);
    
    console.log(`[SitePal] Estimated speech duration: ${estimatedDuration}ms`);

    // Safety net in case speech end event doesn't fire
    const forceSpeechEnd = () => {
      console.log("%c[SafetyNet] Speech timeout triggered. Forcing speech end state.", "color: red; font-weight: bold;");
      isAvatarSpeaking.current = false;
      dispatch({ type: 'FINISH_SPEAKING' });
      
      // Clear the flag
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
        speechEndTimeoutRef.current = null;
      }
    };

    // Set the timeout
    speechEndTimeoutRef.current = setTimeout(forceSpeechEnd, estimatedDuration);

    // Set a flag to handle speech start animation
    isAvatarStartingSpeechRef.current = true;
    const animationTimeout = setTimeout(() => {
      isAvatarStartingSpeechRef.current = false;
    }, 500);
    
    // Cleanup function for the component unmount
    return () => {
      clearTimeout(animationTimeout);
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
        speechEndTimeoutRef.current = null;
      }
    };
  }, [state.aiResponseText, dispatch]);

  const speakNextSentence = useCallback(() => {
    // If user barged in, clear the queue
    if (didBargeInRef.current) {
      console.log('[Speech] Barge-in detected, clearing speech queue');
      sentenceQueue.current = [];
      isAvatarSpeaking.current = false;
      dispatch({ type: 'FINISH_SPEAKING' });
      return;
    }

    // If there are sentences in the queue, speak the next one
    if (sentenceQueue.current.length > 0) {
      const sentence = sentenceQueue.current.shift();
      console.log('[Speech] Speaking next sentence from queue:', sentence?.substring(0, 50) + '...');
      
      if (sentence) {
        try {
          isAvatarSpeaking.current = true;
          
          // Speak the sentence using our safe wrapper
          console.log('[Speech] Calling safeSayText with sentence:', sentence.substring(0, 50) + '...');
          safeSayText(sentence);
          
          // Update the UI to show speaking state
          dispatch({ type: 'START_SPEAKING', payload: sentence });
          
        } catch (error) {
          console.error('[Speech] Error in speakNextSentence:', error);
          // If there's an error, move to the next sentence
          setTimeout(speakNextSentence, 0);
        }
      } else {
        console.warn('[Speech] No sentence to speak or sayText not available');
        // If we can't speak, move to the next sentence
        setTimeout(speakNextSentence, 0);
      }
    } else {
      // No more sentences in the queue
      console.log('[Speech] Speech queue empty, finishing speaking');
      isAvatarSpeaking.current = false;
      dispatch({ type: 'FINISH_SPEAKING' });
    }
  }, [dispatch, safeSayText]);

  const handleSitePalSpeechEnd = useCallback(() => {
    if (speechEndTimeoutRef.current) clearTimeout(speechEndTimeoutRef.current);
    speakNextSentence(); // This creates the event-driven loop
  }, [speakNextSentence]);

  // --- Core VAD Logic ---
  const handleSpeechProbability = useCallback((isSpeech: boolean) => {
    // If the user starts speaking while the avatar is talking, barge-in.
    if (isSpeech && isAvatarSpeaking.current) {
      console.log('%c[VAD] Barge-in detected!', 'color: red; font-weight: bold;');
      didBargeInRef.current = true; // Set the barge-in flag
      safeStopSpeech();
      // The vh_speechEnded callback will fire, see the barge-in flag, and clear the queue.
      // We can now safely transition to listening.
      dispatch({ type: 'START_LISTENING' });
      return;
    }

    // If speech is detected and we are idle, transition to listening.
    if (isSpeech && state.status === 'IDLE') {
        dispatch({ type: 'START_LISTENING' });
    }
  }, [state.status, dispatch]);

  // --- Core Functions ---
  // All core functions are defined earlier, no need to redefine them here

  // SitePal event handlers are now passed directly to the SitePal component as props
  
  // Initialize the avatar and VAD
  useEffect(() => {
    // Guard against double initialization in React Strict Mode
    if (initializedRef.current) {
      console.log('[Init] Already initialized, skipping...');
      return;
    }
    
    // Load VAD module
    const loadVADModule = async () => {
      try {
        // Dynamic import of VAD module
        const vadModule = await import('@ricky0123/vad-web');
        console.log('[VAD] Module imported successfully');
        return vadModule;
      } catch (error) {
        console.error('[VAD] Failed to import VAD module:', error);
        throw new Error('Failed to load voice detection module');
      }
    };
    
    // Initialize VAD with proper configuration
    const onSpeechEnd = () => {
      console.log('[VAD] Speech ended');
      handleSpeechProbability(false);
    };
    
    // Set redemption frames for VAD
    const redemptionFrames = 5;
    
    // Configure audio constraints
    const additionalAudioConstraints = {
      echoCancellation: true,
      noiseSuppression: true
    } as any;
    
    // Create and initialize VAD
    const createVAD = async () => {
      try {
        const vadModule = await loadVADModule();
        const myVad = await vadModule.default.MicVAD.new({
          onSpeechStart: () => {
            console.log('[VAD] Speech detected');
            handleSpeechProbability(true);
          },
          onSpeechEnd,
          redemptionFrames,
          additionalAudioConstraints
        });
        
        // Assign to window.vad for global access
        window.vad = myVad;
        vadRef.current = myVad;
        console.log('[VAD] Module loaded and initialized');
        return myVad;
      } catch (err) {
        const error = err as Error;
        console.error('[VAD] Failed to load VAD module:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize voice detection. Please check microphone permissions.' });
        throw error;
      }
    };
    
    // Execute VAD initialization
    const initializeVAD = async () => {
      try {
        await createVAD();
        console.log('[Init] VAD initialization complete.');
        // Set the initialized flag
        initializedRef.current = true;
        
        // Note: SitePal initialization is handled by the component itself
        dispatch({ type: 'SET_INITIALIZING', payload: false });
      } catch (error) {
        const err = error as Error;
        console.error('[Init] VAD initialization failed:', err);
        dispatch({ type: 'SET_ERROR', payload: err.message });
        dispatch({ type: 'SET_INITIALIZING', payload: false });
      }
    };

    // Start VAD initialization
    initializeVAD();
  }, [dispatch]);

  // Toggle between full and minimized mode
  const toggleCopilotMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_COPILOT_MODE' });
  }, [dispatch]);

  // Offer proactive help after initialization
  const offerProactiveHelp = useCallback(() => {
    if (state.isInitialized && state.status !== 'PROCESSING' && !state.hasOfferedProactiveHelp) {
      dispatch({ type: 'SET_OFFERED_HELP', payload: true });
      
      // Use a random proactive help message
      const proactiveMessages = [
        "Can I help you find something?",
        "Looking for anything specific today?",
        "How can I assist with your shopping?"
      ];
      const randomMessage = proactiveMessages[Math.floor(Math.random() * proactiveMessages.length)];
      
      dispatch({ type: 'START_SPEAKING', payload: randomMessage });
      // Use the speakNextSentence function which is properly defined
      sentenceQueue.current = [randomMessage];
      speakNextSentence();
    }
  }, [state, dispatch, speakNextSentence]);

  // Note: Avatar resizing is now handled by the SitePal component props
  // No manual DOM manipulation needed

  // Setup the inactivity detector.
  useInactivityDetector(offerProactiveHelp, 30000); // 30-second timeout

  // --- Conditional Rendering ---
  // Early return after all hooks are declared to comply with React Hooks Rules
  if (!isOpen) {
    return null;
  }

  // --- Render ---

  return (
    <div className={`fixed z-[100] transition-all duration-300 ${state.isCopilotMode ? 'bottom-4 right-4' : 'inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 sm:p-6 md:p-8'}`}>
      <div className={`bg-background-light dark:bg-background-dark rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${state.isCopilotMode ? 'w-80 h-auto' : 'w-full max-w-4xl h-[90vh] max-h-[700px]'}`}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">TAIC AI Assistant</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => dispatch({ type: 'TOGGLE_COPILOT_MODE' })} aria-label={state.isCopilotMode ? 'Maximize' : 'Minimize'} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              {state.isCopilotMode ? <Maximize size={20} /> : <Minimize size={20} />}
            </button>
            <button onClick={onClose} aria-label="Close AI Assistant" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-grow overflow-y-auto ${state.isCopilotMode ? 'p-2' : 'p-4'}`}>
          <div className={`flex gap-4 ${state.isCopilotMode ? 'flex-col' : 'flex-col md:flex-row'}`}>
            {/* Left Panel: SitePal Avatar */}
            <div className={`flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 p-4 rounded-md ${state.isCopilotMode ? 'w-full' : 'w-full md:w-1/3'}`}>
              {/* SitePal Avatar Component */}
              <div 
                style={{
                  width: state.isCopilotMode ? SITEPAL_CONFIG.DIMENSIONS.COPILOT_WIDTH : SITEPAL_CONFIG.DIMENSIONS.DEFAULT_WIDTH,
                  height: state.isCopilotMode ? SITEPAL_CONFIG.DIMENSIONS.COPILOT_HEIGHT : SITEPAL_CONFIG.DIMENSIONS.DEFAULT_HEIGHT,
                  transition: 'width 0.3s, height 0.3s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div
                  className="flex flex-col items-center justify-center w-full h-full"
                  style={{
                    minHeight: state.isCopilotMode ? SITEPAL_CONFIG.DIMENSIONS.COPILOT_HEIGHT : SITEPAL_CONFIG.DIMENSIONS.DEFAULT_HEIGHT,
                    minWidth: state.isCopilotMode ? SITEPAL_CONFIG.DIMENSIONS.COPILOT_WIDTH : SITEPAL_CONFIG.DIMENSIONS.DEFAULT_WIDTH,
                  }}
                >
                {/* Use the SitePal script hook to manage script loading */}
                {(() => {
                  const { isScriptLoaded, error: scriptError } = useSitePalScript();
                  
                  if (scriptError) {
                    return (
                      <div className="text-red-500 p-4 text-center">
                        <p className="font-bold">Error loading avatar:</p>
                        <p>{scriptError}</p>
                      </div>
                    );
                  }
                  
                  if (!isScriptLoaded) {
                    return (
                      <div className="text-center p-4">
                        <p className="text-text-secondary">Loading Avatar Resources...</p>
                        <div className="mt-2 w-8 h-8 border-4 border-t-primary rounded-full animate-spin mx-auto"></div>
                      </div>
                    );
                  }
                  
                  return (
                    <SitePal
                      embed={String(process.env.NEXT_PUBLIC_SITEPAL_SCENE_ID || SITEPAL_CONFIG.AVATAR_PARAMS.SCENE_ID)}
                      loadSceneByID={[
                        String(process.env.NEXT_PUBLIC_SITEPAL_SCENE_ID || SITEPAL_CONFIG.AVATAR_PARAMS.SCENE_ID),
                        `${process.env.NEXT_PUBLIC_SITEPAL_CHARACTER_ID || SITEPAL_CONFIG.AVATAR_PARAMS.CHARACTER_ID},0,0`
                      ]}
                      onSceneLoad={handleSceneLoad}
                      onSpeechStart={handleSitePalSpeechStart}
                      onSpeechEnd={handleSitePalSpeechEnd}
                      width={state.isCopilotMode ? SITEPAL_CONFIG.DIMENSIONS.COPILOT_WIDTH : SITEPAL_CONFIG.DIMENSIONS.DEFAULT_WIDTH}
                      height={state.isCopilotMode ? SITEPAL_CONFIG.DIMENSIONS.COPILOT_HEIGHT : SITEPAL_CONFIG.DIMENSIONS.DEFAULT_HEIGHT}
                    />
                  );
                })()}
              </div>
              {state.status === 'INITIALIZING' && (
                <div className="mt-4 text-center">
                  <p className="text-text-secondary dark:text-text-secondary-dark">{state.loadingMessage}</p>
                </div>
              )}
              {state.status === 'ERROR' && (
                <div className="mt-4 text-center">
                  <p className="text-red-500">{state.errorMessage}</p>
                </div>
              )}
            </div>

            {/* Right Panel: Chat and Actions */}
            <div className={`flex-col bg-gray-50 dark:bg-gray-900 p-4 rounded-md ${state.isCopilotMode ? 'hidden' : 'flex w-full md:w-2/3'}`}>
              {/* Chat History */}
              <div className="flex-grow border border-border-light dark:border-border-dark rounded-md p-3 mb-4 overflow-y-auto min-h-[200px] bg-white dark:bg-gray-800">
                {state.avatarMessages.map((msg, index) => (
                  <p key={index} className={`text-sm mb-2 ${msg.startsWith('You:') ? 'text-text-secondary dark:text-text-secondary-dark' : 'text-text-primary dark:text-text-primary-dark'}`}>
                    {msg}
                  </p>
                ))}
                {state.status === 'PROCESSING' && <p className="text-sm text-text-secondary dark:text-text-secondary-dark italic">Thinking...</p>}
                {state.status === 'ERROR' && <p className="text-sm text-red-500">Error: {state.errorMessage}</p>}
              </div>

              {/* User Input */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={state.userInput}
                  onChange={(e) => dispatch({ type: 'SET_USER_INPUT', payload: e.target.value })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && state.userInput.trim()) {
                      processCommand(state.userInput.trim());
                      dispatch({ type: 'SET_USER_INPUT', payload: '' });
                    }
                  }}
                  placeholder={state.status === 'LISTENING' ? 'Listening...' : 'Type your message...'}
                  className="flex-grow p-2 border border-border-light dark:border-border-dark rounded-md bg-white dark:bg-gray-700 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary"
                  disabled={state.status !== 'IDLE'}
                />
                <button
                  onClick={() => {
                    if (state.userInput.trim()) {
                      processCommand(state.userInput.trim());
                      dispatch({ type: 'SET_USER_INPUT', payload: '' });
                    }
                  }}
                  disabled={state.status !== 'IDLE' || !state.userInput.trim()}
                  className="p-2 bg-primary text-white rounded-md disabled:opacity-50 hover:bg-primary-dark transition-colors"
                >
                  <Send size={20} />
                </button>
                <button
                  className={`p-2 rounded-full transition-colors ${state.status === 'LISTENING' ? 'bg-red-500 animate-pulse' : 'bg-primary'} text-white disabled:opacity-50`}
                  onClick={() => {
                    if (state.status === 'LISTENING') {
                      stopListening();
                      dispatch({ type: 'STOP_LISTENING' });
                    } else if (state.status === 'IDLE') {
                      startListening();
                      dispatch({ type: 'START_LISTENING' });
                    }
                  }}
                  aria-label={state.status === 'LISTENING' ? 'Stop Listening' : 'Start Listening'}
                  disabled={state.status !== 'IDLE' && state.status !== 'LISTENING'}
                >
                  {state.status === 'LISTENING' ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                  className={`p-2 rounded-full transition-colors ${state.isMuted ? 'bg-yellow-500' : 'bg-gray-500'} text-white disabled:opacity-50`}
                  onClick={() => dispatch({ type: 'TOGGLE_MUTE' })}
                  aria-label={state.isMuted ? 'Unmute Avatar' : 'Mute Avatar'}
                  disabled={state.status === 'PROCESSING'}
                  title={state.isMuted ? 'Avatar Muted' : 'Mute Avatar'}
                >
                  {state.isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex-grow-0">
                <h3 className="text-lg font-semibold mb-2 text-text-primary dark:text-text-primary-dark">What would you like to do?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {state.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (action.command) {
                          processCommand(action.command);
                        } else if (action.link) {
                          window.open(action.link, '_blank');
                          onClose();
                        }
                      }}
                      disabled={state.status === 'PROCESSING' || state.status === 'SPEAKING'}
                      className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-primary dark:text-primary-dark border border-border-light dark:border-border-dark disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pioneer_AMA_Canvas;