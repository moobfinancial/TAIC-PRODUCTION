"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  X, Mic, MicOff, Send, Volume2, VolumeX,
  Store, Megaphone, Users, List, Star, UserPlus,
  Wallet, HelpCircle, Coins, Percent, UserCheck
} from 'lucide-react';
import useWebSpeech from '../../hooks/useWebSpeech';
import useVAD from '../../hooks/useVAD';
import { PioneerApplicationModal } from '@/components/pioneer/PioneerApplicationModal';

// Helper function to get the appropriate icon component
const getActionIcon = (iconName: string) => {
  const iconMap: { [key: string]: any } = {
    'store': Store,
    'megaphone': Megaphone,
    'users': Users,
    'list': List,
    'star': Star,
    'user-plus': UserPlus,
    'wallet': Wallet,
    'help-circle': HelpCircle,
    'coins': Coins,
    'percent': Percent,
    'user-check': UserCheck,
  };

  const IconComponent = iconMap[iconName] || HelpCircle;
  return IconComponent;
};

// Define types for our API responses
interface Action {
  label: string;
  command?: string;
  link?: string;
  value?: string;
  icon?: string;
  action_type?: 'command' | 'link' | 'signup' | 'connect_wallet';
}

interface AIResponse {
  speak_text?: string;
  responseText?: string;
  canvas_state?: string;
  actions?: Action[];
}

interface HomePageSitePalCanvasProps {
  isOpen: boolean;
  onClose: () => void;
}

const HomePageSitePalCanvas: React.FC<HomePageSitePalCanvasProps> = ({ isOpen, onClose }) => {
  // --- State Definitions ---
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiResponseText, setAiResponseText] = useState<string>('Welcome to TAIC! I\'m here to help you learn about our Pioneer Program.');
  const [actions, setActions] = useState<Action[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>('');
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [isGreetingSpoken, setIsGreetingSpoken] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>('Initializing AI Assistant...');
  const [isListeningToUser, setIsListeningToUser] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'loading' | 'conversation'>('loading');
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'connected' | 'disconnected' | 'slow'>('checking');
  const [retryCount, setRetryCount] = useState(0);

  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTierForModal, setSelectedTierForModal] = useState<string>('');

  // --- Refs ---
  const processCommandRef = useRef<(command: string) => Promise<void>>();
  const isAvatarSpeaking = useRef(false);
  const didBargeInRef = useRef(false);
  const canBargeInRef = useRef(true);
  const initialized = useRef(false);
  const speechEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechEndHandlerRef = useRef<(() => void) | null>(null);
  const speakAndListenRef = useRef<(text: string) => void>();
  const isAvatarStartingSpeechRef = useRef(false);
  const bargeInGracePeriodRef = useRef<NodeJS.Timeout | null>(null);

  // --- Hook Callbacks ---
  const handleSTTResult = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal && processCommandRef.current) {
      setUserInput(transcript);
      processCommandRef.current(transcript);
      setIsListeningToUser(false);
    }
  }, []);

  const handleSTTError = useCallback((error: any) => {
    console.log('[STT Error]:', error);
    setErrorMessage('Speech recognition error. Please try again.');
    setIsListeningToUser(false);
    setTimeout(() => setErrorMessage(''), 5000);
  }, []);

  // --- Hooks ---
  const { isListening, startListening, stopListening } = useWebSpeech({
    onSTTResult: handleSTTResult,
    onSTTError: handleSTTError,
  });

  const {
    isListening: isVADListening,
    vadError,
    initVAD,
    start: startVAD,
    stop: stopVAD,
    attachEventHandlers,
  } = useVAD();

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

  // --- Network Connectivity Checker ---
  const checkNetworkConnectivity = useCallback(async () => {
    try {
      setNetworkStatus('checking');
      const startTime = Date.now();

      // Test connectivity to SitePal's CDN using HTTPS
      const response = await fetch('https://vhss-d.oddcast.com/ai_embed_functions_v1.php', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      // With no-cors mode, we can't check response.ok, but if the fetch completes without throwing, it means connectivity is working
      if (latency > 5000) {
        setNetworkStatus('slow');
        setLoadingMessage('Slow network detected - avatar may take longer to load...');
      } else {
        setNetworkStatus('connected');
      }

      console.log(`[HomePageCanvas] Network check completed in ${latency}ms`);
      return true;
    } catch (error) {
      console.error('[HomePageCanvas] Network connectivity check failed:', error);
      setNetworkStatus('disconnected');
      setErrorMessage('Network connectivity issue detected. Please check your internet connection.');
      return false;
    }
  }, []);

  // --- Enhanced Retry Logic ---
  const retryAvatarInitialization = useCallback(() => {
    if (retryCount >= 3) {
      setErrorMessage('Maximum retry attempts reached. Please refresh the page or try again later.');
      setLoadingMessage('Connection failed - please refresh');
      return;
    }

    setRetryCount(prev => prev + 1);
    setErrorMessage(null);
    setLoadingMessage(`Retrying avatar connection (attempt ${retryCount + 1}/3)...`);

    console.log(`[HomePageCanvas] Retry attempt ${retryCount + 1}/3`);

    // Clean up existing scripts and containers
    const existingScript = document.getElementById('sitepal-script-homepage');
    if (existingScript) existingScript.remove();

    const fallbackScript = document.getElementById('sitepal-script-homepage-fallback');
    if (fallbackScript) fallbackScript.remove();

    // Reset avatar state
    setIsAvatarReady(false);
    setCanvasMode('loading');

    // Retry after a delay
    setTimeout(() => {
      checkNetworkConnectivity().then(isConnected => {
        if (isConnected) {
          // Re-trigger script loading
          loadSitePalScript();
        }
      });
    }, 2000 * retryCount); // Exponential backoff
  }, [retryCount, checkNetworkConnectivity]);

  // --- SitePal Speech Event Handlers ---
  const handleSitePalSpeechEnd = useCallback(() => {
    console.log("%c[vh_speechEnded] Fired. Avatar finished speaking.", "color: blue;");
    isAvatarSpeaking.current = false;

    // Clear any existing timeout
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }

    // Clear grace period timeout
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

    // Clear any existing timeout
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }

    // Set a safety timeout based on estimated speech duration
    const estimatedDuration = aiResponseText.length * 80 + 2000; // 80ms per character + 2s buffer
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

    // CRITICAL FIX: Completely disable VAD processing while avatar is speaking
    // This prevents the avatar's own speech from triggering VAD and causing interruptions
    if (isAvatarSpeaking.current && !canBargeInRef.current) {
      // During the grace period, completely ignore all VAD input
      if (DEBUG_VAD) console.log(`[VAD] Completely ignored during avatar speech grace period (${probability.toFixed(2)})`);
      return;
    }

    // Ignore VAD if STT is active or if the avatar has just started speaking.
    if (isListeningToUser || isListening || isAvatarStartingSpeechRef.current) {
      if (DEBUG_VAD) console.log(`[VAD] Ignored: STT active=${isListeningToUser || isListening}, avatar starting=${isAvatarStartingSpeechRef.current}`);
      return;
    }

    const ACTIVATION_THRESHOLD = 0.4; // Lowered from 0.5
    const BARGE_IN_THRESHOLD = 0.7; // Increased from 0.5 to reduce false positives

    // Rule Set #1: Avatar is SPEAKING (Barge-in Mode)
    if (isAvatarSpeaking.current) {
      // Log all probabilities during speech to help debug
      console.log(`%cVAD during speech: ${probability.toFixed(2)}`, probability > 0.3 ? 'color: orange; font-weight: bold' : 'color: gray');

      // More aggressive detection - consider any moderate probability as potential speech
      if (probability > BARGE_IN_THRESHOLD) {
        playIdleAnimation(); // Stop any animation on barge-in
        console.log(`%cBARGE-IN DETECTED! (Prob: ${probability.toFixed(2)})`, 'color: red; font-weight: bold;');
        didBargeInRef.current = true;
        canBargeInRef.current = false;

        // Stop avatar speech immediately
        if (window.sayText && typeof window.sayText === 'function') {
          try {
            const elevenLabsEngineID = 14;
            const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
            const languageID = 1;
            window.sayText('', jessicaVoiceID, languageID, elevenLabsEngineID);
            console.log('[HomePageCanvas] Stopped avatar speech via sayText');
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
  }, [isListeningToUser, isListening, startListening, stopVAD, playIdleAnimation]);

  // Connect handleSpeechProbability to VAD system
  useEffect(() => {
    if (attachEventHandlers) {
      console.log('[VAD] Attaching speech probability handler');
      attachEventHandlers({
        onFrameProcessed: handleSpeechProbability
      });
    }
  }, [attachEventHandlers, handleSpeechProbability]);

  // --- speakAndListen Function ---
  const speakAndListen = useCallback((text: string) => {
    playIdleAnimation(); // Return to neutral before speaking.
    if (isMuted) {
      startVAD();
      return;
    }

    stopListening();
    stopVAD();
    didBargeInRef.current = false;

    // CRITICAL FIX: Don't start VAD immediately when avatar starts speaking
    // This prevents the avatar's own speech from being detected as user speech
    console.log("[VAD] VAD temporarily disabled during speech start");

    // We'll start VAD after a short delay to allow the avatar to start speaking
    // This helps prevent false VAD triggers from the avatar's own speech

    try {
      console.log('[HomePageCanvas] speakAndListen called with text:', text.substring(0, 50) + '...');
      console.log('[HomePageCanvas] window.sayText type:', typeof window.sayText);
      console.log('[HomePageCanvas] Available window functions:', Object.keys(window).filter(key => key.includes('say') || key.includes('speak') || key.includes('vh_')));

      if (typeof window.sayText === 'function') {
        const elevenLabsEngineID = 14;
        const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
        const languageID = 1;

        console.log('[HomePageCanvas] Calling window.sayText with parameters:', {
          text: text.substring(0, 50) + '...',
          voiceID: jessicaVoiceID,
          languageID,
          engineID: elevenLabsEngineID
        });

        // Set grace period - allow barge-in after 2 seconds of avatar speaking
        bargeInGracePeriodRef.current = setTimeout(() => {
          canBargeInRef.current = true;
          console.log('[BARGE-IN] Grace period ended - barge-in now allowed');

          // CRITICAL FIX: Start VAD only after the grace period
          // This ensures the avatar has been speaking for a while before we enable VAD
          startVAD();
          console.log('[VAD] VAD started after grace period for controlled barge-in detection');
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
        console.error('[HomePageCanvas] sayText function not available');
        console.error('[HomePageCanvas] Available window properties:', Object.keys(window).filter(key => typeof (window as any)[key] === 'function' && (key.includes('say') || key.includes('speak') || key.includes('AI_') || key.includes('vh_'))));
      }
    } catch (error) {
      console.error('[HomePageCanvas] Error in speakAndListen:', error);
      if (speechEndHandlerRef.current) {
        speechEndHandlerRef.current();
      }
    }

  }, [isMuted, startListening, stopListening, startVAD, stopVAD, playIdleAnimation]);

  // Effect to keep a stable reference to the speech end handler to prevent dependency loops.
  useEffect(() => {
    speechEndHandlerRef.current = handleSitePalSpeechEnd;
  }, [handleSitePalSpeechEnd]);

  // Keep a stable reference to the speakAndListen function to prevent dependency loops.
  useEffect(() => {
    speakAndListenRef.current = speakAndListen;
  }, [speakAndListen]);

  // --- Generate Guest Session ID ---
  useEffect(() => {
    if (isOpen && !guestSessionId) {
      const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setGuestSessionId(sessionId);
      console.log('[HomePageCanvas] Generated guest session ID:', sessionId);
    }
  }, [isOpen, guestSessionId]);

  // --- Process User Commands ---
  const processCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    
    console.log('[HomePageCanvas] Processing command:', command);
    setIsProcessing(true);
    setUserInput('');
    setErrorMessage(null);

    try {
      // Create or get thread ID for conversation continuity
      let currentThreadId = threadId;
      if (!currentThreadId) {
        currentThreadId = `homepage_thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setThreadId(currentThreadId);
        console.log('[HomePageCanvas] Created new thread ID:', currentThreadId);
      }

      // Call the AI API with correct payload structure
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [command],              // ✅ Correct field name (array)
          thread_id: currentThreadId,       // ✅ Correct field name (snake_case)
          user_id: null,                   // ✅ Required field for guest users
          guest_session_id: guestSessionId // ✅ Correct field name (snake_case)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ details: 'The server returned an unexpected error.' }));
        console.error('[HomePageCanvas] API Error:', errorData);
        throw new Error(`Failed to get response: ${errorData.details || response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';
      let threadIdFromResponse = '';
      let isFirstChunk = true;

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        if (isFirstChunk) {
          // First chunk contains thread_id as JSON
          const lines = chunk.split('\n');
          try {
            const threadInfo = JSON.parse(lines[0]);
            threadIdFromResponse = threadInfo.thread_id;
            // Rest of the chunk is the AI response
            fullResponse += lines.slice(1).join('\n');
          } catch (e) {
            // If first chunk isn't JSON, treat as regular response
            fullResponse += chunk;
          }
          isFirstChunk = false;
        } else {
          fullResponse += chunk;
        }
      }

      // Update thread ID if we got one
      if (threadIdFromResponse && threadIdFromResponse !== currentThreadId) {
        setThreadId(threadIdFromResponse);
        console.log('[HomePageCanvas] Updated thread ID:', threadIdFromResponse);
      }

      let textToSpeak = 'I understand. How else can I help you with the Pioneer Program?';
      let actionsToSet: Action[] = [];

      // Parse the full response for JSON actions vs plain text
      if (fullResponse.trim()) {
        // Check if response is JSON format (for actions)
        if (fullResponse.trim().startsWith('{') || fullResponse.trim().startsWith('[')) {
          try {
            const parsedJson = JSON.parse(fullResponse.trim());
            if (typeof parsedJson === 'object' && parsedJson !== null) {
              // CRITICAL FIX: Extract ONLY the speech text, never the full JSON
              textToSpeak = parsedJson.responseText || parsedJson.speak_text || 'I have some options for you.';

              // Ensure textToSpeak is clean text without JSON artifacts
              if (typeof textToSpeak !== 'string') {
                textToSpeak = 'I have some options for you.';
              }

              // Remove any remaining JSON-like content from speech text
              textToSpeak = textToSpeak.replace(/[\{\}\[\]"]/g, '').trim();

              // Handle actions if present
              if (Array.isArray(parsedJson.actions)) {
                actionsToSet = parsedJson.actions.map((action: any) => ({
                  label: action.label || 'Action',
                  command: action.command,
                  link: action.link,
                  value: action.value || action.command,
                  icon: action.icon || 'help-circle',
                  action_type: action.action_type || 'command'
                }));
              }
            } else {
              textToSpeak = String(parsedJson).replace(/[\{\}\[\]"]/g, '').trim();
            }
          } catch (e) {
            // If JSON parsing fails, use the raw response as speech but clean it
            console.log('[HomePageCanvas] Response is not valid JSON, using as plain text');
            textToSpeak = fullResponse.trim().replace(/[\{\}\[\]"]/g, '').trim();
          }
        } else {
          // Plain text response - use directly for speech but clean any JSON artifacts
          textToSpeak = fullResponse.trim().replace(/[\{\}\[\]"]/g, '').trim();
        }
      }

      console.log('[HomePageCanvas] AI Response processed:', { textToSpeak, actionsCount: actionsToSet.length });

      // Update UI with response
      setAiResponseText(textToSpeak);
      setActions(actionsToSet);

      // Use speakAndListen for proper VAD integration
      if (isAvatarReady) {
        speakAndListen(textToSpeak);
        console.log('[HomePageCanvas] Avatar speaking response with VAD integration');
      }

    } catch (error) {
      console.error('[HomePageCanvas] Error processing command:', error);
      setErrorMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [threadId, guestSessionId, isAvatarReady, speakAndListen]);

  // Set up processCommand ref
  useEffect(() => {
    processCommandRef.current = processCommand;
  }, [processCommand]);

  // --- Handle Action Clicks ---
  const handleActionClick = useCallback((action: Action) => {
    console.log('[HomePageCanvas] Action clicked:', action);

    switch (action.action_type) {
      case 'signup':
        // Handle signup action - open Pioneer Application Modal
        console.log('[HomePageCanvas] Signup action triggered for tier:', action.label);
        setSelectedTierForModal(action.label);
        setIsModalOpen(true);

        if (speakAndListenRef.current) {
          speakAndListenRef.current("Perfect! I'm opening the Pioneer Program application form for you. Please fill in your details to begin your application for the " + action.label + " tier.");
        }
        break;

      case 'connect_wallet':
        // Handle wallet connection action
        if (speakAndListenRef.current) {
          speakAndListenRef.current("Excellent! Please follow the prompts from your wallet provider to securely connect your wallet. This is essential for receiving TAIC Coin rewards.");
        }
        // TODO: Implement initiateWalletConnection()
        console.log('[HomePageCanvas] Wallet connection action triggered - Web3Modal implementation needed');
        break;

      case 'link':
        // Handle external link
        if (action.link) {
          window.open(action.link, '_blank');
        }
        break;

      case 'command':
      default:
        // Handle command action (default behavior)
        const command = action.command || action.value || action.label;
        if (command) {
          processCommand(command);
        }
        break;
    }
  }, [processCommand]);

  // --- Handle Mic Click ---
  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
      setIsListeningToUser(false);
    } else {
      startListening();
      setIsListeningToUser(true);
    }
  }, [isListening, startListening, stopListening]);

  // --- Handle Mute Toggle ---
  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  // --- SitePal Initialization Effect (CLEAN VERSION) ---
  useEffect(() => {
    if (!isOpen || initialized.current) return;

    console.log('[HomePageCanvas] Initializing SitePal avatar...');
    initialized.current = true;

    // First, check network connectivity
    checkNetworkConnectivity().then(isConnected => {
      if (!isConnected) {
        console.error('[HomePageCanvas] Network connectivity check failed');
        return;
      }

      // Check if script already exists
      const existingScript = document.getElementById('sitepal-script-homepage');
      if (existingScript) {
        console.log('[HomePageCanvas] SitePal script already exists');
        return;
      }

      loadSitePalScript();
    });
  }, [isOpen, checkNetworkConnectivity]);

  // --- SitePal Script Loading Function ---
  const loadSitePalScript = useCallback(() => {

    // Create and load SitePal script with enhanced error handling
    const script = document.createElement('script');
    script.id = 'sitepal-script-homepage';
    script.src = 'https://vhss-d.oddcast.com/ai_embed_functions_v1.php';
    script.async = true;

    // Network timeout handler
    const scriptTimeout = setTimeout(() => {
      console.error('[HomePageCanvas] SitePal script loading timeout (30s)');
      setErrorMessage('Avatar loading timeout. Please check your network connection and try again.');
      setLoadingMessage('Network timeout - please retry');
    }, 30000);

    script.onload = () => {
      clearTimeout(scriptTimeout);
      console.log('[HomePageCanvas] SitePal script loaded successfully');
      setLoadingMessage('Embedding avatar...');

      if (typeof window.AI_vhost_embed === 'function') {
        // Enhanced SitePal callbacks with error handling
        window.vh_sceneLoaded = () => {
          console.log('[HomePageCanvas] vh_sceneLoaded fired. Scene is ready.');
          setIsAvatarReady(true);
          setCanvasMode('conversation');
          setLoadingMessage(null); // Clear loading message on success
        };

        // Network error monitoring for SitePal internal requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          try {
            const response = await originalFetch(...args);
            const url = args[0]?.toString() || '';

            // Monitor SitePal-specific network requests
            // Note: With no-cors mode, response.ok is always false and status is always 0
            // Only log actual errors, not no-cors responses
            if (url.includes('oddcast.com') && response.type !== 'opaque' && !response.ok && response.status !== 0) {
              console.error(`[HomePageCanvas] SitePal network error: ${response.status} for ${url}`);
              if (response.status >= 500) {
                setErrorMessage('SitePal service temporarily unavailable. Please try again in a moment.');
              } else if (response.status === 404) {
                setErrorMessage('Avatar configuration not found. Please contact support.');
              }
            }
            return response;
          } catch (error) {
            const url = args[0]?.toString() || '';
            if (url.includes('oddcast.com')) {
              console.error(`[HomePageCanvas] SitePal network request failed:`, error);
              setErrorMessage('Network connectivity issue. Please check your internet connection.');
            }
            throw error;
          }
        };

        window.vh_speechStarted = handleSitePalSpeechStart;
        window.vh_speechEnded = handleSitePalSpeechEnd;

        // Enhanced container check and embed with retry logic
        let embedAttempts = 0;
        const maxEmbedAttempts = 5;

        const checkContainerAndEmbed = () => {
          const container = document.getElementById('vhss_aiPlayer');
          if (container) {
            console.log('[HomePageCanvas] DOM container found, embedding avatar...');
            if (window.AI_vhost_embed) {
              try {
                window.AI_vhost_embed(300, 400, 9226953, 278, 1, 1);

                // Set a fallback timeout for scene loading
                setTimeout(() => {
                  if (!isAvatarReady) {
                    console.warn('[HomePageCanvas] Scene loading timeout, attempting fallback...');
                    setErrorMessage('Avatar loading is taking longer than expected. The service may be experiencing high traffic.');
                    setLoadingMessage('Retrying avatar connection...');

                    // Attempt to re-embed after timeout
                    if (embedAttempts < maxEmbedAttempts) {
                      embedAttempts++;
                      setTimeout(() => {
                        console.log(`[HomePageCanvas] Retry attempt ${embedAttempts}/${maxEmbedAttempts}`);
                        if (window.AI_vhost_embed) {
                          window.AI_vhost_embed(300, 400, 9226953, 278, 1, 1);
                        }
                      }, 2000);
                    } else {
                      setErrorMessage('Unable to connect to avatar service. Please refresh the page or try again later.');
                      setLoadingMessage('Connection failed');
                    }
                  }
                }, 15000); // 15 second timeout for scene loading

              } catch (error) {
                console.error('[HomePageCanvas] Error during avatar embedding:', error);
                setErrorMessage('Avatar embedding failed. Please refresh the page.');
              }
            }
          } else {
            console.log('[HomePageCanvas] DOM container not ready, retrying in 100ms...');
            setTimeout(checkContainerAndEmbed, 100);
          }
        };

        // Small delay to ensure DOM is ready
        setTimeout(checkContainerAndEmbed, 50);
      } else {
        console.error('[HomePageCanvas] SitePal embed function not found');
        setErrorMessage('Failed to initialize AI avatar. Please refresh the page.');
        setLoadingMessage('Avatar initialization failed');
      }
    };

    script.onerror = (error) => {
      clearTimeout(scriptTimeout);
      console.error('[HomePageCanvas] Failed to load SitePal script:', error);
      setErrorMessage('Avatar script could not be loaded. Please check your network connection and try again.');
      setLoadingMessage('Script loading failed');

      // Attempt to use HTTPS fallback
      setTimeout(() => {
        console.log('[HomePageCanvas] Attempting HTTPS fallback...');
        const fallbackScript = document.createElement('script');
        fallbackScript.id = 'sitepal-script-homepage-fallback';
        fallbackScript.src = 'https://vhss-d.oddcast.com/ai_embed_functions_v1.php';
        fallbackScript.async = true;

        fallbackScript.onload = () => {
          console.log('[HomePageCanvas] HTTPS fallback script loaded successfully');
          setErrorMessage(null);
          setLoadingMessage('Avatar loading via secure connection...');
          // Re-trigger the embedding process by calling the script loading logic directly
          if (typeof window.AI_vhost_embed === 'function') {
            // Set up callbacks and embed avatar
            window.vh_sceneLoaded = () => {
              console.log('[HomePageCanvas] vh_sceneLoaded fired. Scene is ready.');
              setIsAvatarReady(true);
              setCanvasMode('conversation');
              setLoadingMessage(null);
            };

            window.vh_speechStarted = handleSitePalSpeechStart;
            window.vh_speechEnded = handleSitePalSpeechEnd;

            // Embed avatar
            const container = document.getElementById('vhss_aiPlayer');
            if (container && window.AI_vhost_embed) {
              window.AI_vhost_embed(300, 400, 9226953, 278, 1, 1);
            }
          }
        };

        fallbackScript.onerror = () => {
          console.error('[HomePageCanvas] HTTPS fallback also failed');
          setErrorMessage('Unable to connect to avatar service. Please check your internet connection or try again later.');
          setLoadingMessage('Connection failed');
        };

        document.body.appendChild(fallbackScript);
      }, 2000);
    };

    document.body.appendChild(script);
  }, [checkNetworkConnectivity, retryAvatarInitialization, handleSitePalSpeechStart, handleSitePalSpeechEnd]);

  // --- Cleanup Effect ---
  useEffect(() => {
    return () => {
      if (!isOpen) {
        console.log('[HomePageCanvas] Component closing, performing cleanup');

        const script = document.getElementById('sitepal-script-homepage');
        if (script) script.remove();

        const fallbackScript = document.getElementById('sitepal-script-homepage-fallback');
        if (fallbackScript) fallbackScript.remove();

        const avatarContainer = document.getElementById('vhost_embed_9226953');
        if (avatarContainer) avatarContainer.remove();

        // Clean up global functions
        if (window.sayText) window.sayText = undefined;
        if (window.vh_sceneLoaded) window.vh_sceneLoaded = undefined;
        if (window.vh_speechStarted) window.vh_speechStarted = undefined;
        if (window.vh_speechEnded) window.vh_speechEnded = undefined;

        // Reset network status
        setNetworkStatus('checking');
        setRetryCount(0);

        initialized.current = false;
      }
    };
  }, [isOpen]);

  // --- Initial Greeting Effect ---
  useEffect(() => {
    const fetchAndSpeakGreeting = async () => {
      console.log('[HomePageCanvas] fetchAndSpeakGreeting called. isAvatarReady:', isAvatarReady, 'isGreetingSpoken:', isGreetingSpoken);

      if (isAvatarReady && !isGreetingSpoken) {
        console.log('[HomePageCanvas] Avatar is ready. Delivering Pioneer Program greeting.');
        setLoadingMessage('Preparing assistant...');
        setIsProcessing(true);

        // 1. Ensure VAD is initialized before we proceed.
        console.log('[HomePageCanvas] About to initialize VAD...');
        try {
          await initVAD();
          console.log('[HomePageCanvas] VAD initialized successfully.');
        } catch (error) {
          console.error('[HomePageCanvas] VAD initialization failed:', error);
          // Continue anyway
        }

        // Pioneer Program focused greeting
        const greetingText = "Welcome to TAIC! I'm here to help you discover our exclusive Pioneer Program. This is your opportunity to join a select group of early adopters who will shape the future of AI-powered commerce. Would you like to learn about the incredible benefits and how to apply?";

        setAiResponseText(greetingText);
        const pioneerActions: Action[] = [
          { label: "Founding Merchants", value: "Tell me about the Founding Merchants tier", icon: "store", action_type: "signup" },
          { label: "Strategic Influencers", value: "Tell me about the Strategic Influencers tier", icon: "megaphone", action_type: "signup" },
          { label: "Community Champions", value: "Tell me about the Early Community Champions tier", icon: "users", action_type: "signup" },
          { label: "General Interest", value: "Tell me about the General Interest Whitelist", icon: "list", action_type: "signup" },
          { label: "Program Benefits", value: "What are the benefits of the Pioneer Program?", icon: "star", action_type: "command" },
          { label: "How to Apply", value: "How can I apply for the Pioneer Program?", icon: "user-plus", action_type: "command" }
        ];

        console.log('[HomePageCanvas] Setting Pioneer Program actions:', pioneerActions);
        setActions(pioneerActions);
        console.log('[HomePageCanvas] Actions set successfully');

        // CRITICAL FIX: Set greeting as spoken BEFORE calling speech function (like working implementation)
        setIsGreetingSpoken(true);

        // Use speakAndListenRef for proper VAD integration (like working implementation)
        if (speakAndListenRef.current) {
          console.log('[HomePageCanvas] Attempting to speak greeting...');
          console.log('[HomePageCanvas] window.sayText available:', typeof window.sayText === 'function');
          console.log('[HomePageCanvas] speakAndListenRef available:', !!speakAndListenRef.current);
          speakAndListenRef.current(greetingText);
          console.log('[HomePageCanvas] Avatar speaking Pioneer Program greeting with VAD integration');
        } else {
          console.error('[HomePageCanvas] speakAndListenRef.current is not available');
        }

        setLoadingMessage(null);
        setIsProcessing(false);
      } else {
        console.log('[HomePageCanvas] Skipping greeting delivery. isAvatarReady:', isAvatarReady, 'isGreetingSpoken:', isGreetingSpoken);
      }
    };

    fetchAndSpeakGreeting();
  }, [isAvatarReady, isGreetingSpoken, initVAD]);

  // --- Cleanup Effect ---
  useEffect(() => {
    return () => {
      if (!isOpen) {
        console.log('[HomePageCanvas] Modal closed - performing cleanup.');

        // Stop any ongoing speech
        if (window.sayText && typeof window.sayText === 'function') {
          try {
            const elevenLabsEngineID = 14;
            const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
            const languageID = 1;
            window.sayText('', jessicaVoiceID, languageID, elevenLabsEngineID);
            console.log('[HomePageCanvas] Stopped avatar speech on cleanup');
          } catch (error) {
            console.log('[HomePageCanvas] Could not stop avatar speech:', error);
          }
        }

        // Reset avatar state
        isAvatarSpeaking.current = false;
        canBargeInRef.current = true;
        didBargeInRef.current = false;
      }
    };
  }, [isOpen]);

  // Effect to ensure VAD is stopped ONLY when the component unmounts
  useEffect(() => {
    return () => {
      stopVAD();
      console.log('[HomePageCanvas] VAD stopped on component unmount');
    };
  }, [stopVAD]);

  // Don't render anything if modal is not open
  if (!isOpen) return null;



  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" data-testid="sitepal-modal">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">TAIC AI Assistant</h2>
              <p className="text-sm text-muted-foreground">Pioneer Program Specialist</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-grow overflow-y-auto p-4">
          <div className="flex gap-4 flex-col md:flex-row">
            {/* Left Panel: SitePal Avatar */}
            <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 p-4 rounded-md w-full md:w-1/3">
              {/* CRITICAL: Use static vhss_aiPlayer ID exactly like Pioneer_AMA_Canvas */}
              <div id="vhss_aiPlayer" style={{ width: '300px', height: '400px' }}></div>
              {/* Network Status Indicator */}
              {networkStatus !== 'connected' && (
                <div className="mt-2 text-center">
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                    networkStatus === 'checking' ? 'bg-yellow-100 text-yellow-800' :
                    networkStatus === 'slow' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      networkStatus === 'checking' ? 'bg-yellow-400 animate-pulse' :
                      networkStatus === 'slow' ? 'bg-orange-400' :
                      'bg-red-400'
                    }`}></div>
                    {networkStatus === 'checking' ? 'Checking connection...' :
                     networkStatus === 'slow' ? 'Slow network detected' :
                     'Connection issues'}
                  </div>
                </div>
              )}

              {loadingMessage && (
                <div className="mt-4 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">{loadingMessage}</p>
                  {networkStatus === 'slow' && (
                    <p className="text-xs text-orange-600 mt-2">
                      Slow network detected - this may take up to 60 seconds
                    </p>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 text-center">
                  <p className="text-red-500 text-sm mb-3">{errorMessage}</p>
                  {retryCount < 3 && (
                    <Button
                      onClick={retryAvatarInitialization}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Retry Connection ({3 - retryCount} attempts left)
                    </Button>
                  )}
                  {retryCount >= 3 && (
                    <Button
                      onClick={() => window.location.reload()}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Refresh Page
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Right Panel: Conversation Interface */}
            <div className="flex flex-col w-full md:w-2/3 space-y-4">
              {/* AI Response Display */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Assistant</CardTitle>
                  <CardDescription>Pioneer Program Information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-4 rounded-md mb-4">
                    <p className="text-foreground whitespace-pre-wrap">{aiResponseText}</p>
                  </div>
                </CardContent>
              </Card>

              {/* User Input */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && userInput.trim() && processCommand(userInput.trim())}
                  placeholder="Type your message..."
                  className="flex-grow p-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary"
                  disabled={isProcessing || !isAvatarReady}
                />
                <Button
                  onClick={() => userInput.trim() && processCommand(userInput.trim())}
                  disabled={isProcessing || !isAvatarReady || !userInput.trim()}
                  size="sm"
                >
                  <Send size={16} />
                </Button>
                <Button
                  variant={isListening ? "destructive" : "secondary"}
                  onClick={handleMicClick}
                  disabled={isProcessing || !isAvatarReady}
                  size="sm"
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </Button>
                <Button
                  variant={isMuted ? "outline" : "secondary"}
                  onClick={handleMuteToggle}
                  disabled={isProcessing || !isAvatarReady}
                  size="sm"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex-grow-0">
                <h3 className="text-lg font-semibold mb-2 text-foreground">Pioneer Program Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {actions.map((action, index) => {
                    const IconComponent = getActionIcon(action.icon || 'help-circle');
                    return (
                      <Button
                        key={index}
                        onClick={() => handleActionClick(action)}
                        disabled={isProcessing}
                        variant="outline"
                        className="w-full text-left justify-start gap-2 h-auto py-3"
                        data-testid="action-card"
                      >
                        <IconComponent size={18} className="flex-shrink-0" />
                        <span className="text-sm">{action.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pioneer Application Modal */}
      <PioneerApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedTier={selectedTierForModal}
        onSuccess={(applicationId) => {
          console.log('[HomePageCanvas] Application submitted successfully with ID:', applicationId);
          setIsModalOpen(false);
          if (speakAndListenRef.current) {
            speakAndListenRef.current("Congratulations! Your Pioneer Program application has been submitted successfully. We'll review your application and get back to you soon. Thank you for your interest in joining the TAIC Pioneer Program!");
          }
        }}
      />
    </div>
  );
};

export default HomePageSitePalCanvas;
