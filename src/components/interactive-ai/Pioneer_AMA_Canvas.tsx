import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, MessageSquare, Send, Hand, Volume2, VolumeX } from 'lucide-react';
import useWebSpeech from '../../hooks/useWebSpeech';
import useVAD from '../../hooks/useVAD';

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
  const GREETING_MESSAGE = "Welcome to TAIC! I'm Marisa, your AI assistant. How can I help you today?";
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

  // --- Refs ---
  const processCommandRef = useRef<(command: string) => Promise<void>>();
  const isAvatarSpeaking = useRef(false); // New ref to track avatar speech state
  const didBargeInRef = useRef(false); // New ref to track if a barge-in occurred
  const isAvatarStartingSpeechRef = useRef(false);

  // --- Hook Callbacks ---
  const handleSTTResult = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal && processCommandRef.current) {
      setUserInput(transcript);
      processCommandRef.current(transcript);
      setIsListeningToUser(false); // Reset after processing
    }
  }, []);

  const handleSTTError = useCallback((error: any) => {
    setErrorMessage(`Speech Error: ${error.error || 'Unknown error'}`);
    setIsListeningToUser(false); // Reset on error
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
    attachEventHandlers: attachSTTHandlers,
  } = useWebSpeech();

  const {
    isListening: isVADListening,
    vadError,
    initVAD,
    start: startVAD,
    stop: stopVAD,
    attachEventHandlers: attachVADEventHandlers,
  } = useVAD();

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
    if (isMuted) {
      // If muted, don't try to speak, just start VAD for user activation.
      startVAD();
      return;
    }

    stopListening();
    stopVAD();
    didBargeInRef.current = false;
    
    // Start VAD BEFORE speech begins - this is critical for barge-in detection
    startVAD();
    console.log("[VAD] VAD started BEFORE speech for barge-in detection");

    try {
      if (typeof window.sayText === 'function') {
        const elevenLabsEngineID = 14;
        const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
        const languageID = 1; // English
        window.sayText(text, jessicaVoiceID, languageID, elevenLabsEngineID);
        console.log("[SitePal] Started speaking with VAD already active");
      } else {
        throw new Error('window.sayText is not a function.');
      }
    } catch (error) {
      console.error('[SitePal] sayText failed. This may be a platform issue. Continuing gracefully.', error);
      // If sayText fails, the speechEnd callback won't fire.
      // We need to manually trigger the logic that would normally happen after speech ends.
      handleSitePalSpeechEnd();
    }

  }, [isMuted, startListening, stopListening, startVAD, stopVAD]);

  // --- Effects ---
  useEffect(() => {
    attachVADEventHandlers({ onFrameProcessed: handleSpeechProbability });
  }, [handleSpeechProbability, attachVADEventHandlers]);

  // Effect to attach STT handlers once they are stable.
  useEffect(() => {
    attachSTTHandlers({
      onSTTResult: handleSTTResult,
      onSTTError: handleSTTError,
    });
  }, [handleSTTResult, handleSTTError, attachSTTHandlers]);

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
            console.log('vh_sceneLoaded callback received: Avatar is ready.');
            setLoadingMessage('Avatar ready.');
            setIsAvatarReady(true);
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

  // Effect to initialize VAD and speak the greeting when the avatar is ready.
  useEffect(() => {
    const initAndSpeak = async () => {
      if (isAvatarReady && !isGreetingSpoken) {
        console.log('Avatar is ready. Initializing VAD and speaking greeting.');
        
        // 1. Initialize VAD and wait for it to complete.
        await initVAD();

        // 2. Immediately update the UI so the user sees the greeting.
        setAiResponseText(GREETING_MESSAGE);
        setAvatarMessages([`Assistant: ${GREETING_MESSAGE}`]);
        setIsProcessing(false);
        setLoadingMessage(null);
        setIsGreetingSpoken(true); // Mark as 'spoken' to prevent re-triggering.

        // 3. Use the new robust function to handle speech and listening.
        speakAndListen(GREETING_MESSAGE);
      }
    };

    initAndSpeak();
  }, [isAvatarReady, isGreetingSpoken, GREETING_MESSAGE, initVAD, speakAndListen]);

  // --- SitePal Event Handlers ---
  const handleSitePalSpeechStart = useCallback(() => {
    console.log("[vh_speechStarted] Fired. Avatar is speaking.");
    isAvatarSpeaking.current = true;
    // Set a brief grace period to prevent the VAD from picking up the avatar's own starting audio.
    isAvatarStartingSpeechRef.current = true;
    setTimeout(() => {
      isAvatarStartingSpeechRef.current = false;
    }, 500); // 500ms grace period
  }, []);

  const handleSitePalSpeechEnd = useCallback(() => {
    console.log(`[vh_speechEnded] Fired. Barge-in status: ${didBargeInRef.current}`);
    isAvatarSpeaking.current = false;

    // If speech ended naturally (no barge-in), restart VAD in activation mode.
    // If a barge-in just happened, STT is already running, so we do nothing here.
    if (!didBargeInRef.current) {
      stopVAD();
      startVAD();
      console.log("[VAD] VAD started in 'activation' mode.");
    }
    // Reset the barge-in flag for the next interaction cycle.
    didBargeInRef.current = false;
  }, [startVAD, stopVAD]);

  // Effect to attach SitePal handlers
  useEffect(() => {
    window.vh_speechStarted = handleSitePalSpeechStart;
    window.vh_speechEnded = handleSitePalSpeechEnd;

    return () => {
      window.vh_speechStarted = undefined;
      window.vh_speechEnded = undefined;
    };
  }, [handleSitePalSpeechStart, handleSitePalSpeechEnd]);

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
          if (typeof parsedJson === 'object' && parsedJson !== null && parsedJson.responseText) {
            textToSpeak = parsedJson.responseText;
          } else {
            textToSpeak = String(parsedJson);
          }
        } catch (e) {
          textToSpeak = responseContent;
        }
      } else if (data.responseText) {
        textToSpeak = data.responseText;
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
    if (newMutedState && typeof window.stopSpeech === 'function') {
      console.log('Muting: Stopping current speech.');
      window.stopSpeech();
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

  // --- Render ---

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4 sm:p-6 md:p-8">
      <div className="bg-background-light dark:bg-background-dark w-full max-w-4xl h-[90vh] max-h-[700px] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">TAIC AI Assistant</h2>
          <button onClick={onClose} aria-label="Close AI Assistant" className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark">
            <X size={24} />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-grow flex flex-col md:flex-row p-4 gap-4 overflow-y-auto">
          {/* Left Panel: SitePal Avatar */}
          <div className="w-full md:w-1/3 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
            <div id="vhss_aiPlayer" style={{ width: '300px', height: '400px' }}></div>
            {loadingMessage && (
              <div className="mt-4 text-center">
                <p className="text-text-secondary dark:text-text-secondary-dark">{loadingMessage}</p>
              </div>
            )}
          </div>

          {/* Right Panel: Chat and Actions */}
          <div className="w-full md:w-2/3 flex flex-col bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
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
  );
};

export default Pioneer_AMA_Canvas;
