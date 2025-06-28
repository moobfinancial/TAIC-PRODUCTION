import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Send, Volume2, VolumeX, Minimize, Maximize } from 'lucide-react';
import useInactivityDetector from '../../hooks/useInactivityDetector';
import useWebSpeech from '../../hooks/useWebSpeech';
import useVAD from '../../hooks/useVAD';

// Define types for our API responses
interface Action {
  label: string;
  command?: string;
  link?: string;
}

interface AIResponse {
  speak_text?: string; // Keep for backward compatibility
  responseText?: string; // Add this for new format from OpenAI prompt
  canvas_state?: string;
  actions?: Action[];
}

interface Pioneer_AMA_CanvasProps {
  isOpen: boolean;
  onClose: () => void;
}

const Pioneer_AMA_Canvas: React.FC<Pioneer_AMA_CanvasProps> = ({ isOpen, onClose }) => {
  // --- State Definitions ---
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarMessages, setAvatarMessages] = useState<string[]>([]);
  const [aiResponseText, setAiResponseText] = useState<string>('Initializing AI Assistant...');
  const [actions, setActions] = useState<Action[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>('');
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isGreetingSpoken, setIsGreetingSpoken] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>('Initializing AI Assistant...');
  const [isListeningToUser, setIsListeningToUser] = useState(false); // New state to track STT activity
  const [isCopilotMode, setIsCopilotMode] = useState(false);
  const [hasOfferedProactiveHelp, setHasOfferedProactiveHelp] = useState(false);

  // --- Refs ---
  const processCommandRef = useRef<(command: string) => Promise<void>>();
  const isAvatarSpeaking = useRef(false); // New ref to track avatar speech state
  const didBargeInRef = useRef(false); // New ref to track if a barge-in occurred
  const isAvatarStartingSpeechRef = useRef(false);
  const speechEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechEndHandlerRef = useRef<() => void>();
  const speakAndListenRef = useRef<(text: string) => void>();
  const bargeInGracePeriodRef = useRef<NodeJS.Timeout | null>(null); // Grace period to prevent immediate barge-in
  const canBargeInRef = useRef(true); // Flag to control when barge-in is allowed

  // --- Hook Callbacks ---
  const handleSTTResult = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal && processCommandRef.current) {
      playListeningAnimation(); // User finished speaking, now AI is 'thinking'
      setUserInput(transcript);
      processCommandRef.current(transcript);
      setIsListeningToUser(false); // Reset after processing
    }
  }, []);

  const handleSTTError = useCallback((error: any) => {
    console.log('[STT Error]:', error);
    
    let userFriendlyMessage = 'Speech recognition error';
    
    if (typeof error === 'string') {
      if (error.includes('Network error')) {
        userFriendlyMessage = 'Speech service temporarily unavailable. Please check your internet connection.';
      } else if (error.includes('network')) {
        userFriendlyMessage = 'Network issue with speech service. Please try again.';
      } else {
        userFriendlyMessage = error;
      }
    } else if (error?.error === 'network') {
      userFriendlyMessage = 'Speech service temporarily unavailable. Please check your internet connection.';
    } else if (error?.error === 'timeout') {
      userFriendlyMessage = 'Speech recognition timed out. Please try again.';
    } else if (error?.error) {
      userFriendlyMessage = `Speech Error: ${error.error}`;
    }
    
    setErrorMessage(userFriendlyMessage);
    setIsListeningToUser(false); // Reset on error
    
    // Auto-clear error message after 5 seconds
    setTimeout(() => {
      setErrorMessage('');
    }, 5000);
  }, []);

  // --- Hooks ---
  // Hooks are defined before the callbacks that depend on them to prevent initialization errors.
  const {
    isListening,
    startListening,
    stopListening,
    sttError,
    finalTranscript,
    isSTTSupported,
  } = useWebSpeech({
    onSTTResult: handleSTTResult,
    onSTTError: (error) => console.error('[STT Error]:', error),
    onSTTStart: () => console.log('[STT] Started listening'),
    onSTTEnd: () => console.log('[STT] Stopped listening'),
  });

  const {
    isListening: isVADListening,
    vadError,
    initVAD,
    start: startVAD,
    stop: stopVAD,
  } = useVAD({
    onSpeechStart: () => {
      console.log('[VAD] Speech detected - checking barge-in conditions');
      
      // Check if barge-in is allowed (grace period)
      if (!canBargeInRef.current) {
        console.log('[VAD] Barge-in blocked - still in grace period');
        return;
      }
      
      // Check if avatar is actually speaking before attempting barge-in
      if (!isAvatarSpeaking.current) {
        console.log('[VAD] Avatar not speaking - proceeding with STT only');
        if (!isListening) {
          console.log('[VAD] Starting STT (no barge-in needed)');
          startListening();
        }
        return;
      }
      
      console.log('[VAD] Implementing barge-in - avatar is speaking');
      
      // Barge-in: Stop avatar speech when user starts speaking
      if (window.sayText && typeof window.sayText === 'function') {
        try {
          console.log('[VAD] Stopping avatar speech for barge-in');
          const elevenLabsEngineID = 14;
          const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
          const languageID = 1; // English
          window.sayText('', jessicaVoiceID, languageID, elevenLabsEngineID); // Stop current speech by sending empty text
          isAvatarSpeaking.current = false; // Update avatar speaking state
          didBargeInRef.current = true; // Mark that barge-in occurred
        } catch (error) {
          console.log('[VAD] Could not stop avatar speech:', error);
        }
      }
      
      // Start STT if not already listening
      if (!isListening) {
        console.log('[VAD] Starting STT after barge-in');
        startListening();
      }
    },
    onSpeechEnd: () => {
      console.log('[VAD] Speech ended - stopping STT');
      if (isListening) {
        stopListening();
      }
    },
  });

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

  // --- SitePal Event Handlers ---
  const handleSitePalSpeechEnd = useCallback(() => {
    // Clear the safety timeout since the event fired correctly.
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }

    // If we already handled the speech end (e.g., via the timeout), do nothing.
    if (!isAvatarSpeaking.current) {
      console.log("[vh_speechEnded] Ignored, speech end state already handled.");
      return;
    }

    console.log(`%c[vh_speechEnded] Fired. Barge-in status: ${didBargeInRef.current}`, "color: blue;");
    isAvatarSpeaking.current = false;
    
    // Clean up grace period timeout when speech ends
    if (bargeInGracePeriodRef.current) {
      clearTimeout(bargeInGracePeriodRef.current);
      bargeInGracePeriodRef.current = null;
    }
    canBargeInRef.current = true; // Re-enable barge-in for next speech

    // If speech ended naturally (no barge-in), restart VAD in activation mode.
    if (!didBargeInRef.current) {
      stopVAD();
      startVAD();
      console.log("[VAD] VAD started in 'activation' mode.");
    }
    // Reset the barge-in flag for the next interaction cycle.
    didBargeInRef.current = false;
  }, [startVAD, stopVAD]);

  const handleSitePalSpeechStart = useCallback(() => {
    console.log("%c[vh_speechStarted] Fired. Avatar is speaking.", "color: blue;");
    isAvatarSpeaking.current = true;

    // Clear any existing timeout from a previous, possibly failed, speech event.
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
    }

    // Set a safety timeout to manually call handleSitePalSpeechEnd.
    // This handles cases where the vh_speechEnded event doesn't fire.
    const wordCount = aiResponseText.split(/\s+/).length;
    const estimatedDuration = 4000 + (wordCount * 150); // 4s base + 150ms/word

    console.log(`[SafetyNet] Setting speech end timeout for ${estimatedDuration}ms`);
    speechEndTimeoutRef.current = setTimeout(() => {
      console.log("%c[SafetyNet] Timeout triggered. Forcing speech end state.", "color: red; font-weight: bold;");
      handleSitePalSpeechEnd();
    }, estimatedDuration);

    // Set a brief grace period to prevent the VAD from picking up the avatar's own starting audio.
    isAvatarStartingSpeechRef.current = true;
    setTimeout(() => {
      isAvatarStartingSpeechRef.current = false;
    }, 500); // 500ms grace period
  }, [aiResponseText, handleSitePalSpeechEnd]);
  

  // --- Core VAD Logic ---
  const handleSpeechProbability = useCallback((probability: number) => {
    // Debug flag - set to true to see all VAD probabilities in console
    const DEBUG_VAD = true;
    
    // Ignore VAD if STT is active or if the avatar has just started speaking.
    if (isListeningToUser || isListening || isAvatarStartingSpeechRef.current) {
      if (DEBUG_VAD) console.log(`[VAD] Ignored: STT active=${isListeningToUser || isListening}, avatar starting=${isAvatarStartingSpeechRef.current}`);
      return;
    }

    const ACTIVATION_THRESHOLD = 0.4; // Lowered from 0.5
    const BARGE_IN_THRESHOLD = 0.5; // Further lowered from 0.6 for even easier interruption

    // Rule Set #1: Avatar is SPEAKING (Barge-in Mode)
    if (isAvatarSpeaking.current) {
      // Log all probabilities during speech to help debug
      console.log(`%cVAD during speech: ${probability.toFixed(2)}`, probability > 0.3 ? 'color: orange; font-weight: bold' : 'color: gray');
      
      // More aggressive detection - consider any moderate probability as potential speech
      if (probability > BARGE_IN_THRESHOLD) {
        playIdleAnimation(); // Stop any animation on barge-in
        console.log(`%cBARGE-IN DETECTED! (Prob: ${probability.toFixed(2)})`, 'color: red; font-weight: bold;');
        // Mark that we detected a barge-in
        didBargeInRef.current = true;
        // Update avatar speaking state immediately
        isAvatarSpeaking.current = false;
        
        // Stop the avatar speech immediately
        if (window.stopSpeech) {
          try {
            window.stopSpeech();
            console.log('Successfully stopped avatar speech');
          } catch (e) {
            console.error('Error stopping speech:', e);
          }
        }
        
        // Stop VAD and start STT to capture user speech
        stopVAD();
        setIsListeningToUser(true);
        startListening();
      }
      return;
    }

    // Rule Set #2: Avatar is SILENT (Activation Mode)
    if (!isAvatarSpeaking.current) {
      if (probability > ACTIVATION_THRESHOLD) {
        console.log(`%cUSER ACTIVATION DETECTED! (Prob: ${probability.toFixed(2)})`, 'color: green; font-weight: bold;');
        stopVAD();
        setIsListeningToUser(true);
        startListening(); // Start STT
      }
      return;
    }
  }, [isListeningToUser, isListening, startListening, stopVAD]);

  const speakAndListen = useCallback((text: string) => {
    playIdleAnimation(); // Return to neutral before speaking.
    if (isMuted) {
      startVAD();
      return;
    }

    stopListening();
    stopVAD();
    didBargeInRef.current = false;
    
    startVAD();
    console.log("[VAD] VAD started BEFORE speech for barge-in detection");

    try {
      if (typeof window.sayText === 'function') {
        const elevenLabsEngineID = 14;
        const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
        const languageID = 1; // English
        
        // Set avatar speaking state and implement grace period
        isAvatarSpeaking.current = true;
        canBargeInRef.current = false; // Disable barge-in temporarily
        
        // Clear any existing grace period timeout
        if (bargeInGracePeriodRef.current) {
          clearTimeout(bargeInGracePeriodRef.current);
        }
        
        // Set grace period - allow barge-in after 2 seconds of avatar speaking
        bargeInGracePeriodRef.current = setTimeout(() => {
          canBargeInRef.current = true;
          console.log('[BARGE-IN] Grace period ended - barge-in now allowed');
        }, 2000);
        
        window.sayText(text, jessicaVoiceID, languageID, elevenLabsEngineID);
        console.log("[SitePal] Started speaking with VAD already active (grace period: 2s)");

        // --- VAD FIX ---
        // Set a safety timeout to handle cases where vh_speechEnded doesn't fire.
        // This ensures the VAD reactivates and the conversation doesn't stall.
        const estimatedSpeechDuration = text.length * 80 + 1000; // 80ms/char + 1s buffer
        if (speechEndTimeoutRef.current) clearTimeout(speechEndTimeoutRef.current);
        speechEndTimeoutRef.current = setTimeout(() => {
          console.log(`%c[Timeout] Safety timeout triggered after ${estimatedSpeechDuration}ms. Forcing speech end state.`, 'color: orange;');
          if (speechEndHandlerRef.current) {
            speechEndHandlerRef.current();
          }
        }, estimatedSpeechDuration);

      } else {
        throw new Error('window.sayText is not a function.');
      }
    } catch (error) {
      console.error('[SitePal] sayText failed. This may be a platform issue. Continuing gracefully.', error);
      if (speechEndHandlerRef.current) {
        speechEndHandlerRef.current();
      }
    }

  }, [isMuted, startListening, stopListening, startVAD, stopVAD]);

  // Effect to keep a stable reference to the speech end handler to prevent dependency loops.
  useEffect(() => {
    speechEndHandlerRef.current = handleSitePalSpeechEnd;
  }, [handleSitePalSpeechEnd]);

  // Keep a stable reference to the speakAndListen function to prevent dependency loops.
  useEffect(() => {
    speakAndListenRef.current = speakAndListen;
  }, [speakAndListen]);

  // Guard against double initialization in React Strict Mode
  const initialized = useRef(false);

  // --- Effects ---

  // Effect to dynamically load the SitePal script and initialize the avatar
  useEffect(() => {
    // This effect should only run its setup once when the component is opened.
    if (isOpen && !initialized.current) {
      initialized.current = true;
      console.log('Pioneer AMA Canvas: Mounting and preparing to load script.');

      // Reset state every time the component is opened for a clean slate.
      setIsAvatarReady(false);
      setIsGreetingSpoken(false);
      setThreadId(null);
      setErrorMessage(null);
      setAvatarMessages([]);
      setAiResponseText('Initializing AI Assistant...');
      setLoadingMessage('Initializing AI Assistant...');
      setIsProcessing(true);
      setActions([
        { label: 'Tell me about TAIC', command: 'Tell me about TAIC' },
        { label: 'How to buy TAIC?', command: 'How can I buy TAIC?' },
        { label: 'What is the Pioneer Program?', command: 'What is the Pioneer Program?' },
      ]);

      // Create a script element to load the SitePal functions.
      const script = document.createElement('script');
      script.id = 'sitepal-script';
      script.src = '//vhss-d.oddcast.com/ai_embed_functions_v1.php';
      script.async = true;

      // This function will run once the script is loaded and executed.
      script.onload = () => {
        console.log('SitePal script loaded successfully.');
        setLoadingMessage('Embedding avatar...');

        // Now that the script is loaded, the embed function should exist.
        if (typeof window.AI_vhost_embed === 'function') {
          // Define the official callback that SitePal will call when the scene is loaded.
          window.vh_sceneLoaded = () => {
            console.log("[vh_sceneLoaded] Fired. Scene is ready.");
            setIsAvatarReady(true); // This will trigger the greeting useEffect
          };
          // Embed the avatar.
          window.AI_vhost_embed(300, 400, 9226953, 278, 1, 1);
        } else {
          console.error('SitePal embed function not found even after script load.');
          const errorMsg = 'Failed to initialize AI avatar. Please refresh the page.';
          setErrorMessage(errorMsg);
          setLoadingMessage(errorMsg);
          setIsProcessing(false);
        }
      };

      // Handle script loading errors.
      script.onerror = () => {
        console.error('Failed to load the SitePal script.');
        const errorMsg = 'The AI avatar script could not be downloaded. Please check your connection and refresh.';
        setErrorMessage(errorMsg);
        setLoadingMessage(errorMsg);
        setIsProcessing(false);
      };

      // Append the script to the body to start loading it.
      document.body.appendChild(script);
    }

    // This cleanup function will run when the component unmounts.
    return () => {
      // We only want to perform the full cleanup when the component is truly closing.
      if (!isOpen) {
        console.log('Pioneer AMA Canvas: Component is closing, performing full cleanup.');
        
        // Remove the script from the DOM.
        const script = document.getElementById('sitepal-script');
        if (script) {
          script.remove();
        }

        // Remove the avatar container.
        const avatarContainer = document.getElementById('vhost_embed_9226953');
        if (avatarContainer) {
          avatarContainer.remove();
        }

        // Clean up global functions to prevent memory leaks and conflicts.
        if (window.sayText) window.sayText = undefined;
        if (window.vh_sceneLoaded) window.vh_sceneLoaded = undefined;
        if (window.vh_speechStarted) window.vh_speechStarted = undefined;
        if (window.vh_speechEnded) window.vh_speechEnded = undefined;

        // Reset the initialized flag so it can be re-initialized if opened again.
        initialized.current = false;
      }
    };
  }, [isOpen]);

  // Effect to fetch the initial greeting once the avatar is ready.
  useEffect(() => {
    const fetchAndSpeakGreeting = async () => {
      if (isAvatarReady && !isGreetingSpoken) {
        console.log('Avatar is ready. Delivering static greeting.');
        setLoadingMessage('Preparing assistant...'); // More accurate message
        setIsProcessing(true);

        // 1. Ensure VAD is initialized before we proceed.
        await initVAD();
        console.log('[Greeting] VAD initialized.');

        // 2. Use a static greeting to improve reliability and speed.
        // The thread will be created on the first real user message.
        const greetingText = "Hello! I am the official AI Guide for TAIC. How can I help you today?";
        
        // 3. Update state and mark greeting as done.
        setIsGreetingSpoken(true);
        setAvatarMessages([`Assistant: ${greetingText}`]);
        
        // 4. Speak the greeting and start listening for the user.
        if (speakAndListenRef.current) {
          speakAndListenRef.current(greetingText);
        }

        setLoadingMessage(null);
        setIsProcessing(false);
      }
    };

    fetchAndSpeakGreeting();
  }, [isAvatarReady, isGreetingSpoken, threadId, initVAD]);

  // Effect to ensure VAD is stopped ONLY when the component unmounts
  useEffect(() => {
    return () => {
      stopVAD();
    };
  }, [stopVAD]); // stopVAD is stable

  if (!isOpen) {
    return null;
  }

  // --- Core Functions ---

  // Memoize processCommand to stabilize dependencies for other hooks
  const processCommand = useCallback(async (command: string) => {
    console.log(`Processing command: ${command}`);
    setIsProcessing(true);
    setErrorMessage(null);
    setAvatarMessages(prev => [...prev, `You: ${command}`]);
    setAiResponseText('Thinking...');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command, thread_id: threadId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ details: 'The server returned an unexpected error.' }));
        console.error('API Error:', errorData);
        throw new Error(`Failed to get response: ${errorData.details || response.statusText}`);
      }

      const data = await response.json();
      console.log('Received from API:', data);

      setThreadId(data.thread_id);

      let textToSpeak = 'I received a response, but it was empty.';

      if (data.response) {
        const responseContent = data.response;
        try {
          const parsedJson = JSON.parse(responseContent);
          if (typeof parsedJson === 'object' && parsedJson !== null) {
            // Check for both formats - new format (responseText) first, then fallback to old format (speak_text)
            textToSpeak = parsedJson.responseText || parsedJson.speak_text || String(parsedJson);
            
            // Handle actions if present
            if (Array.isArray(parsedJson.actions)) {
              setActions(parsedJson.actions);
            }
            
            // Handle canvas_state if present
            if (parsedJson.canvas_state) {
              console.log(`[Canvas] Updating canvas state: ${parsedJson.canvas_state}`);
              // Here you would implement the logic to update the UI based on canvas_state
              // For example, you could have a state variable and a switch statement
              // to handle different canvas states
            }
          } else {
            textToSpeak = String(parsedJson);
          }
        } catch (e) {
          textToSpeak = responseContent;
        }
      } else if (data.responseText) {
        textToSpeak = data.responseText;
      } else if (data.speak_text) {
        textToSpeak = data.speak_text;
      }

      setAiResponseText(textToSpeak);
      setAvatarMessages(prev => [...prev, `Assistant: ${textToSpeak}`]);

      // Use the new robust function to handle speech and listening.
      speakAndListen(textToSpeak);

    } catch (error: any) {
      console.error('Error processing command:', error);
      const errorMsg = error.message || 'An unknown error occurred.';
      setErrorMessage(errorMsg);
      const errorText = 'I am sorry, I seem to be having a technical issue. Please try again in a moment.';
      setAiResponseText(errorText);
      
      // Also speak the error message.
      speakAndListen(errorText);

    } finally {
      setIsProcessing(false);
    }
  }, [threadId, speakAndListen]);

  // Keep the ref updated with the latest version of processCommand for our stable callbacks
  useEffect(() => {
    processCommandRef.current = processCommand;
  });

    const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    // If muting, immediately stop any ongoing speech.
    if (newMutedState) {
      console.log('[MUTE] Stopping current avatar speech');
      
      // Try multiple methods to stop SitePal speech
      if (window.sayText && typeof window.sayText === 'function') {
        try {
          const elevenLabsEngineID = 14;
          const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
          const languageID = 1; // English
          window.sayText('', jessicaVoiceID, languageID, elevenLabsEngineID); // Stop current speech by sending empty text
          console.log('[MUTE] Stopped avatar speech via sayText');
        } catch (error) {
          console.log('[MUTE] Could not stop via sayText:', error);
        }
      }
      
      // Also try legacy stopSpeech if available
      if (typeof window.stopSpeech === 'function') {
        try {
          window.stopSpeech();
          console.log('[MUTE] Stopped speech via stopSpeech');
        } catch (error) {
          console.log('[MUTE] Could not stop via stopSpeech:', error);
        }
      }
    }
    setIsMuted(newMutedState);
  };

  const handleActionClick = (action: Action) => {
    if (action.command) {
      processCommand(action.command);
    } else if (action.link) {
      window.open(action.link, '_blank');
      onClose();
    }
  };

  const toggleCopilotMode = useCallback(() => {
    const newMode = !isCopilotMode;
    setIsCopilotMode(newMode);

    const newWidth = newMode ? 150 : 300;
    const newHeight = newMode ? 200 : 400;

    if (window.AI_vhost_embed) {
      const avatarContainer = document.getElementById('vhss_aiPlayer');
      if (avatarContainer) {
        avatarContainer.innerHTML = '';
      }
      window.AI_vhost_embed(newWidth, newHeight, 9226953, 278, 1, 1);
    }
  }, [isCopilotMode]);

  // --- Proactive Help Logic ---
  const offerProactiveHelp = useCallback(() => {
    // Offer help only if the canvas is open, not busy, and hasn't offered before.
    if (isOpen && !isProcessing && !isAvatarSpeaking.current && !hasOfferedProactiveHelp) {
      console.log('%c[Inactivity] Triggering proactive help.', 'color: orange;');
      setHasOfferedProactiveHelp(true);

      // If not in copilot mode, switch to it.
      if (!isCopilotMode) {
        toggleCopilotMode();
      }

      const proactiveMessage = "It looks like you might be exploring. Is there anything I can help you with?";
      setAiResponseText(proactiveMessage);
      setAvatarMessages(prev => [...prev, `Assistant: ${proactiveMessage}`]);
      speakAndListen(proactiveMessage);
    }
  }, [isOpen, isProcessing, hasOfferedProactiveHelp, isCopilotMode, speakAndListen, toggleCopilotMode]);

  // Setup the inactivity detector.
  useInactivityDetector(offerProactiveHelp, 30000); // 30-second timeout

  // --- Render ---

  return (
    <div className={`fixed z-[100] transition-all duration-300 ${isCopilotMode ? 'bottom-4 right-4' : 'inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 sm:p-6 md:p-8'}`}>
      <div className={`bg-background-light dark:bg-background-dark rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isCopilotMode ? 'w-80 h-auto' : 'w-full max-w-4xl h-[90vh] max-h-[700px]'}`}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">TAIC AI Assistant</h2>
          <div className="flex items-center gap-2">
            <button onClick={toggleCopilotMode} aria-label={isCopilotMode ? 'Maximize' : 'Minimize'} className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark">
              {isCopilotMode ? <Maximize size={20} /> : <Minimize size={20} />}
            </button>
            <button onClick={onClose} aria-label="Close AI Assistant" className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-grow overflow-y-auto ${isCopilotMode ? 'p-2' : 'p-4'}`}>
          <div className={`flex gap-4 ${isCopilotMode ? 'flex-col' : 'flex-col md:flex-row'}`}>
            {/* Left Panel: SitePal Avatar */}
            <div className={`flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 p-4 rounded-md ${isCopilotMode ? 'w-full' : 'w-full md:w-1/3'}`}>
              <div id="vhss_aiPlayer" style={{ width: isCopilotMode ? '150px' : '300px', height: isCopilotMode ? '200px' : '400px', transition: 'width 0.3s, height 0.3s' }}></div>
              {loadingMessage && (
                <div className="mt-4 text-center">
                  <p className="text-text-secondary dark:text-text-secondary-dark">{loadingMessage}</p>
                </div>
              )}
            </div>

            {/* Right Panel: Chat and Actions */}
            <div className={`flex-col bg-gray-50 dark:bg-gray-900 p-4 rounded-md ${isCopilotMode ? 'hidden' : 'flex w-full md:w-2/3'}`}>
              {/* Chat History */}
              <div className="flex-grow border border-border-light dark:border-border-dark rounded-md p-3 mb-4 overflow-y-auto min-h-[200px] bg-white dark:bg-gray-800">
                {avatarMessages.map((msg, index) => (
                  <p key={index} className={`text-sm mb-2 ${msg.startsWith('You:') ? 'text-text-secondary dark:text-text-secondary-dark' : 'text-text-primary dark:text-text-primary-dark'}`}>
                    {msg}
                  </p>
                ))}
                {isProcessing && <p className="text-sm text-text-secondary dark:text-text-secondary-dark italic">Thinking...</p>}
                {errorMessage && <p className="text-sm text-red-500">Error: {errorMessage}</p>}
              </div>

              {/* User Input */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && userInput.trim() && processCommand(userInput.trim())}
                  placeholder="Type your message..."
                  className="flex-grow p-2 border border-border-light dark:border-border-dark rounded-md bg-white dark:bg-gray-700 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary"
                  disabled={isProcessing || !isAvatarReady}
                />
                <button
                  onClick={() => userInput.trim() && processCommand(userInput.trim())}
                  disabled={isProcessing || !isAvatarReady || !userInput.trim()}
                  className="p-2 bg-primary text-white rounded-md disabled:opacity-50 hover:bg-primary-dark transition-colors"
                >
                  <Send size={20} />
                </button>
                <button
                  className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500' : 'bg-primary'} text-white disabled:opacity-50`}
                  onClick={handleMicClick}
                  aria-label={isListening ? 'Stop Listening' : 'Start Listening'}
                  disabled={isProcessing || !isAvatarReady}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                  className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-yellow-500' : 'bg-gray-500'} text-white disabled:opacity-50`}
                  onClick={handleMuteToggle}
                  aria-label={isMuted ? 'Unmute Avatar' : 'Mute Avatar'}
                  disabled={isProcessing || !isAvatarReady}
                  title={isMuted ? 'Avatar Muted' : 'Mute Avatar'}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex-grow-0">
                <h3 className="text-lg font-semibold mb-2 text-text-primary dark:text-text-primary-dark">What would you like to do?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleActionClick(action)}
                      disabled={isProcessing}
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