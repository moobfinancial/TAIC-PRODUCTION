"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/analytics';
import useWebSpeech from '@/hooks/useWebSpeech';
import useVAD from '@/hooks/useVAD';
import {
  Bot,
  Play,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  Crown,
  Star,
  Zap,
  Target,
  Rocket,
  ShoppingBag,
  User,
  Wallet,
  CheckCircle,
  ArrowRight,
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PioneerApplicationForm } from '@/components/pioneer/PioneerApplicationForm';
import { ProductCanvas } from '@/components/products/ProductCanvas';
import type { ProductForAI } from '@/ai/schemas/shopping-assistant-schemas-new';

// Types for canvas content modes
type CanvasMode = 'conversation' | 'pioneer-application' | 'product-showcase' | 'dashboard' | 'loading';

interface HomePageSitePalCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface AvatarMessage {
  id: string;
  text: string;
  timestamp: Date;
  type: 'greeting' | 'response' | 'system';
}

interface ActionButton {
  label: string;
  command: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary';
}

// Pioneer Program tier definitions for quick reference
const PIONEER_TIERS = [
  {
    id: 'Tier 1: Visionary Partner',
    name: 'Visionary Partner',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: 'Founding merchants and established businesses',
    tokenRange: '10,000-50,000 TAIC'
  },
  {
    id: 'Tier 2: Strategic Influencer', 
    name: 'Strategic Influencer',
    icon: Star,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Content creators and community leaders',
    tokenRange: '5,000-25,000 TAIC'
  },
  {
    id: 'Tier 3: Innovation Catalyst',
    name: 'Innovation Catalyst', 
    icon: Zap,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: 'Tech enthusiasts and early adopters',
    tokenRange: '2,500-10,000 TAIC'
  },
  {
    id: 'Tier 4: Community Champion',
    name: 'Community Champion',
    icon: Target,
    color: 'text-orange-600', 
    bgColor: 'bg-orange-50',
    description: 'Active community members and advocates',
    tokenRange: '1,000-5,000 TAIC'
  },
  {
    id: 'Tier 5: Platform Pioneer',
    name: 'Platform Pioneer',
    icon: Rocket,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50', 
    description: 'New users interested in early participation',
    tokenRange: '500-2,500 TAIC'
  }
];

export default function HomePageSitePalCanvas({ isOpen, onClose, className }: HomePageSitePalCanvasProps) {
  // Core state management
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('loading');
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [isGreetingSpoken, setIsGreetingSpoken] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Initializing AI Presentation...');
  
  // Conversation state
  const [avatarMessages, setAvatarMessages] = useState<AvatarMessage[]>([]);
  const [aiResponseText, setAiResponseText] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  
  // Content state
  const [actions, setActions] = useState<ActionButton[]>([]);
  const [canvasProducts, setCanvasProducts] = useState<ProductForAI[]>([]);
  const [userApplicationStatus, setUserApplicationStatus] = useState<any>(null);

  // Voice recognition state
  const [isListeningToUser, setIsListeningToUser] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [userInput, setUserInput] = useState('');

  // Hooks
  const { toast } = useToast();
  const { isAuthenticated, user, loginWithWallet } = useAuth();

  // Refs for voice recognition and avatar control
  const initialized = useRef(false);
  const isAvatarSpeaking = useRef(false);
  const canBargeInRef = useRef(true);
  const didBargeInRef = useRef(false);
  const bargeInGracePeriodRef = useRef<NodeJS.Timeout | null>(null);
  const speechEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechEndHandlerRef = useRef<(() => void) | null>(null);
  const isAvatarStartingSpeechRef = useRef(false);
  const processCommandRef = useRef<(command: string) => Promise<void>>();
  const speakAndListenRef = useRef<((text: string) => void) | null>(null);

  // Voice recognition hook callbacks
  const handleSTTResult = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal && processCommandRef.current) {
      console.log('[HomePageCanvas] STT Result:', transcript);
      setUserInput(transcript);
      processCommandRef.current(transcript);
      setIsListeningToUser(false);
    }
  }, []);

  const handleSTTError = useCallback((error: any) => {
    console.log('[HomePageCanvas] STT Error:', error);
    let userFriendlyMessage = 'Speech recognition error';

    if (typeof error === 'string') {
      if (error.includes('Network error')) {
        userFriendlyMessage = 'Speech service temporarily unavailable. Please check your internet connection.';
      } else if (error.includes('network')) {
        userFriendlyMessage = 'Network connection issue. Please try again.';
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
    setIsListeningToUser(false);

    // Auto-clear error message after 5 seconds
    setTimeout(() => {
      setErrorMessage(null);
    }, 5000);
  }, []);

  // Voice recognition hooks
  const {
    isListening,
    startListening,
    stopListening,
    sttError,
    finalTranscript,
    isSTTSupported,
  } = useWebSpeech({
    onSTTResult: handleSTTResult,
    onSTTError: handleSTTError,
    onSTTStart: () => console.log('[HomePageCanvas] STT Started listening'),
    onSTTEnd: () => console.log('[HomePageCanvas] STT Stopped listening'),
  });

  // VAD hook
  const {
    isListening: isVADListening,
    vadError,
    initVAD,
    start: startVAD,
    stop: stopVAD,
    attachEventHandlers,
  } = useVAD();

  // SitePal speech event handlers
  const handleSitePalSpeechStart = useCallback(() => {
    console.log('[HomePageCanvas] vh_speechStarted fired. Avatar is speaking.');
    isAvatarSpeaking.current = true;
    setIsProcessing(true);

    // Calculate estimated speech duration for safety timeout
    const estimatedDuration = aiResponseText.length * 80 + 2000; // 80ms per character + 2s buffer

    // Clear any existing timeout
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }

    // Set safety timeout to handle cases where vh_speechEnded doesn't fire
    speechEndTimeoutRef.current = setTimeout(() => {
      console.log('%c[SafetyNet] Timeout triggered. Forcing speech end state.', 'color: red; font-weight: bold;');
      handleSitePalSpeechEnd();
    }, estimatedDuration);

    // Set a brief grace period to prevent the VAD from picking up the avatar's own starting audio
    isAvatarStartingSpeechRef.current = true;
    setTimeout(() => {
      isAvatarStartingSpeechRef.current = false;
    }, 500); // 500ms grace period
  }, [aiResponseText]);

  const handleSitePalSpeechEnd = useCallback(() => {
    console.log('[HomePageCanvas] vh_speechEnded fired. Avatar finished speaking.');
    isAvatarSpeaking.current = false;
    setIsProcessing(false);

    // Clear the safety timeout since speech ended naturally
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }

    // Clear barge-in grace period if it exists
    if (bargeInGracePeriodRef.current) {
      clearTimeout(bargeInGracePeriodRef.current);
      bargeInGracePeriodRef.current = null;
    }
    canBargeInRef.current = true; // Re-enable barge-in for next speech

    // If speech ended naturally (no barge-in), restart VAD in activation mode
    if (!didBargeInRef.current) {
      stopVAD();
      startVAD();
      console.log('[HomePageCanvas] VAD started in activation mode.');
    }
    // Reset the barge-in flag for the next interaction cycle
    didBargeInRef.current = false;
  }, [startVAD, stopVAD]);

  // VAD speech probability handler
  const handleSpeechProbability = useCallback((probability: number) => {
    // Debug flag - set to true to see all VAD probabilities in console
    const DEBUG_VAD = false;

    // CRITICAL FIX: Completely disable VAD processing while avatar is speaking
    if (isAvatarSpeaking.current && !canBargeInRef.current) {
      if (DEBUG_VAD) console.log(`[HomePageCanvas VAD] Completely ignored during avatar speech grace period (${probability.toFixed(2)})`);
      return;
    }

    // Ignore VAD if STT is active or if the avatar has just started speaking
    if (isListeningToUser || isListening || isAvatarStartingSpeechRef.current) {
      if (DEBUG_VAD) console.log(`[HomePageCanvas VAD] Ignored: STT active=${isListeningToUser || isListening}, avatar starting=${isAvatarStartingSpeechRef.current}`);
      return;
    }

    const ACTIVATION_THRESHOLD = 0.4; // Lowered from 0.5
    const BARGE_IN_THRESHOLD = 0.7; // Increased from 0.5 to reduce false positives

    // Rule Set #1: Avatar is SPEAKING (Barge-in Mode)
    if (isAvatarSpeaking.current) {
      if (DEBUG_VAD) console.log(`%cHomePageCanvas VAD during speech: ${probability.toFixed(2)}`, probability > 0.3 ? 'color: orange; font-weight: bold' : 'color: gray');

      if (probability > BARGE_IN_THRESHOLD) {
        console.log(`%cHomePageCanvas BARGE-IN DETECTED! (Prob: ${probability.toFixed(2)})`, 'color: red; font-weight: bold;');

        // Mark that barge-in occurred
        didBargeInRef.current = true;
        canBargeInRef.current = false; // Disable further barge-ins until speech ends

        // Stop avatar speech
        if (window.sayText && typeof window.sayText === 'function') {
          try {
            const elevenLabsEngineID = 14;
            const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
            const languageID = 1; // English
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
        console.log(`%cHomePageCanvas USER ACTIVATION DETECTED! (Prob: ${probability.toFixed(2)})`, 'color: green; font-weight: bold;');
        stopVAD();
        setIsListeningToUser(true);
        startListening(); // Start STT
      }
      return;
    }
  }, [isListeningToUser, isListening, startListening, stopVAD]);

  // Connect handleSpeechProbability to VAD system
  useEffect(() => {
    if (attachEventHandlers) {
      console.log('[HomePageCanvas] Attaching speech probability handler');
      attachEventHandlers({
        onFrameProcessed: handleSpeechProbability
      });
    }
  }, [attachEventHandlers, handleSpeechProbability]);

  // speakAndListen function for avatar speech with VAD integration
  const speakAndListen = useCallback((text: string) => {
    if (isMuted) {
      startVAD();
      return;
    }

    stopListening();
    stopVAD();
    didBargeInRef.current = false;

    console.log("[HomePageCanvas] VAD temporarily disabled during speech start");

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
          console.log('[HomePageCanvas] Grace period ended - barge-in now allowed');

          // Start VAD only after the grace period
          startVAD();
          console.log('[HomePageCanvas] VAD started after grace period for controlled barge-in detection');
        }, 2000);

        window.sayText(text, jessicaVoiceID, languageID, elevenLabsEngineID);
        console.log("[HomePageCanvas] Started speaking with VAD grace period: 2s");

        // Set a safety timeout to handle cases where vh_speechEnded doesn't fire
        const estimatedSpeechDuration = text.length * 80 + 1000; // 80ms/char + 1s buffer
        if (speechEndTimeoutRef.current) clearTimeout(speechEndTimeoutRef.current);
        speechEndTimeoutRef.current = setTimeout(() => {
          console.log(`%c[HomePageCanvas Timeout] Safety timeout triggered after ${estimatedSpeechDuration}ms. Forcing speech end state.`, 'color: orange;');
          if (speechEndHandlerRef.current) {
            speechEndHandlerRef.current();
          }
        }, estimatedSpeechDuration);
      } else {
        console.error('[HomePageCanvas] sayText function not available');
      }
    } catch (error) {
      console.error('[HomePageCanvas] Error in speakAndListen:', error);
      if (speechEndHandlerRef.current) {
        speechEndHandlerRef.current();
      }
    }
  }, [isMuted, startListening, stopListening, startVAD, stopVAD]);

  // Effect to keep a stable reference to the speech end handler
  useEffect(() => {
    speechEndHandlerRef.current = handleSitePalSpeechEnd;
  }, [handleSitePalSpeechEnd]);

  // Effect to keep a stable reference to speakAndListen
  useEffect(() => {
    speakAndListenRef.current = speakAndListen;
  }, [speakAndListen]);

  // Initialize guest session ID for anonymous users
  useEffect(() => {
    if (!guestSessionId) {
      const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setGuestSessionId(sessionId);
      console.log('[HomePageCanvas] Generated guest session ID:', sessionId);
    }
  }, [guestSessionId]);

  // Add a ref to track if component is still mounted
  const isMountedRef = useRef(true);

  // Add a ref to track SitePal cleanup state
  const sitePalCleanupRef = useRef(false);

  // Add a ref to the DOM container element
  const containerRef = useRef<HTMLDivElement>(null);

  // Add a ref to track DOM mutation observer
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  // Add state to track container ID without direct DOM manipulation
  const [containerIdState, setContainerIdState] = useState<'homepage-vhss-aiPlayer' | 'vhss_aiPlayer'>('homepage-vhss-aiPlayer');

  // REMOVED: Duplicate embedding effect that was causing double embedding conflicts

  // Effect to dynamically load the SitePal script and initialize the avatar
  useEffect(() => {
    if (isOpen) {
      console.log('[HomePageCanvas] Opening canvas - initializing SitePal integration.');

      // Reset cleanup state and container ID
      sitePalCleanupRef.current = false;
      isMountedRef.current = true;
      setContainerIdState('homepage-vhss-aiPlayer');

      // Add global error handler for SitePal internal errors
      const originalErrorHandler = window.onerror;
      window.onerror = (message, source, lineno, colno, error) => {
        const messageStr = typeof message === 'string' ? message : message.toString();
        const sourceStr = typeof source === 'string' ? source : '';

        if (sourceStr && sourceStr.includes('sitepalPlayer_v1.js') && messageStr.includes('Cannot read properties of null')) {
          console.error('[HomePageCanvas] SitePal dimension calculation error detected:', messageStr);
          if (isMountedRef.current) {
            setErrorMessage('Avatar initialization failed due to dimension calculation error. Please try refreshing the page.');
            setContainerIdState('homepage-vhss-aiPlayer');
          }
          return true; // Prevent default error handling
        }
        // Call original error handler if it exists
        if (originalErrorHandler) {
          return originalErrorHandler(message, source, lineno, colno, error);
        }
        return false;
      };

      // Reset state for clean initialization
      setIsAvatarReady(false);
      setIsGreetingSpoken(false);
      setThreadId(null);
      setErrorMessage(null);
      setAvatarMessages([]);
      setCanvasMode('loading');
      setAiResponseText('Initializing AI Presentation...');
      setLoadingMessage('Initializing AI Presentation...');
      setIsProcessing(true);
      setIsListeningToUser(false);
      setIsMuted(false);
      setUserInput('');

      // Reset voice recognition refs
      isAvatarSpeaking.current = false;
      canBargeInRef.current = true;
      didBargeInRef.current = false;

      // Clear any existing timeouts
      if (bargeInGracePeriodRef.current) {
        clearTimeout(bargeInGracePeriodRef.current);
        bargeInGracePeriodRef.current = null;
      }
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
        speechEndTimeoutRef.current = null;
      }
      
      // Set initial action buttons for home page presentation
      setActions([
        { 
          label: 'Tell me about TAIC', 
          command: 'Tell me about TAIC platform and what makes it special',
          icon: <Bot className="h-4 w-4" />
        },
        { 
          label: 'Pioneer Program Benefits', 
          command: 'What are the benefits of joining the Pioneer Program?',
          icon: <Crown className="h-4 w-4" />
        },
        { 
          label: 'Show me products', 
          command: 'What products can I buy on TAIC?',
          icon: <ShoppingBag className="h-4 w-4" />
        },
        { 
          label: 'How to get started', 
          command: 'How do I get started with TAIC?',
          icon: <Rocket className="h-4 w-4" />
        }
      ]);

      // Check if SitePal script is already loaded, if not load it
      const existingScript = document.getElementById('sitepal-script-homepage');

      const initializeSitePal = () => {
        console.log('[HomePageCanvas] Initializing SitePal avatar...');
        setLoadingMessage('Embedding avatar...');

        if (typeof window.AI_vhost_embed === 'function') {
          // Set up DOM mutation observer to detect when React removes elements
          const setupMutationObserver = () => {
            if (mutationObserverRef.current) {
              mutationObserverRef.current.disconnect();
            }

            mutationObserverRef.current = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                  mutation.removedNodes.forEach((node) => {
                    if (node instanceof Element && (node.id === 'vhss_aiPlayer' || node.id === 'homepage-vhss-aiPlayer')) {
                      console.log('[HomePageCanvas] DOM mutation detected: SitePal container being removed by React');
                      sitePalCleanupRef.current = true;
                    }
                  });
                }
              });
            });

            // Observe the document body for child list changes
            mutationObserverRef.current.observe(document.body, {
              childList: true,
              subtree: true
            });
          };

          setupMutationObserver();

          // Define SitePal callbacks with mount state checks
          window.vh_sceneLoaded = () => {
            if (!isMountedRef.current || sitePalCleanupRef.current) {
              console.log("[HomePageCanvas] vh_sceneLoaded fired but component unmounted, ignoring");
              return;
            }

            console.log("[HomePageCanvas] vh_sceneLoaded fired. Scene is ready.");
            setIsAvatarReady(true);
            setCanvasMode('conversation');

            // Restore original container ID after SitePal has loaded using state
            console.log('[HomePageCanvas] Scene loaded - restoring container ID through state');
            setContainerIdState('homepage-vhss-aiPlayer');
          };

          // Set up speech event handlers
          window.vh_speechStarted = handleSitePalSpeechStart;
          window.vh_speechEnded = handleSitePalSpeechEnd;

          // COMPREHENSIVE FIX: Simplified container validation with direct embedding approach
          let retryCount = 0;
          const maxRetries = 30; // Reduced to 3 seconds of retries
          let hasTriedIdSwitch = false; // Track if we've attempted ID switching

          const checkContainerAndEmbed = () => {
            // Check if component is still mounted and modal is still open
            if (!isMountedRef.current || !isOpen || sitePalCleanupRef.current) {
              console.log('[HomePageCanvas] Component unmounted or modal closed, aborting container check');
              return;
            }

            // Try to find container with current ID first
            let container = document.getElementById(containerIdState);

            // If container not found and we haven't tried switching IDs yet, try the alternate ID
            if (!container && !hasTriedIdSwitch) {
              const alternateId = containerIdState === 'homepage-vhss-aiPlayer' ? 'vhss_aiPlayer' : 'homepage-vhss-aiPlayer';
              container = document.getElementById(alternateId);
              if (container) {
                console.log(`[HomePageCanvas] Found container with alternate ID: ${alternateId}`);
                setContainerIdState(alternateId as 'homepage-vhss-aiPlayer' | 'vhss_aiPlayer');
                hasTriedIdSwitch = true;
                // Wait for state update and retry
                setTimeout(checkContainerAndEmbed, 100);
                return;
              }
            }

            // Enhanced container readiness validation
            const isContainerReady = container &&
              container.offsetParent !== null &&
              container.parentNode &&
              container.offsetWidth > 0 &&
              container.offsetHeight > 0 &&
              getComputedStyle(container).display !== 'none' &&
              getComputedStyle(container).visibility !== 'hidden';

            if (isContainerReady && container) {
              console.log('[HomePageCanvas] DOM container validated successfully:', {
                id: container.id,
                width: container.offsetWidth,
                height: container.offsetHeight,
                display: getComputedStyle(container).display,
                visibility: getComputedStyle(container).visibility
              });

              // If container ID is not the expected SitePal ID, switch it
              if (container.id !== 'vhss_aiPlayer') {
                console.log('[HomePageCanvas] Switching container ID to vhss_aiPlayer for SitePal embedding');
                setContainerIdState('vhss_aiPlayer');

                // Wait for React to update the DOM with new ID
                setTimeout(() => {
                  checkContainerAndEmbed();
                }, 150); // Increased delay for React state update
                return;
              }

              // Container is ready and has correct ID - proceed with embedding
              if (window.AI_vhost_embed && isMountedRef.current) {
                try {
                  console.log('[HomePageCanvas] Embedding SitePal with validated container...', {
                    containerId: container.id,
                    dimensions: `${container.offsetWidth}x${container.offsetHeight}`,
                    parentNode: !!container.parentNode,
                    offsetParent: !!container.offsetParent
                  });

                  // Use container dimensions for responsive embedding
                  const containerWidth = Math.max(400, container.offsetWidth);
                  const containerHeight = Math.max(500, container.offsetHeight);

                  window.AI_vhost_embed(containerWidth, containerHeight, 9226953, 278, 1, 1);
                  console.log('[HomePageCanvas] SitePal embed called successfully with dimensions:', `${containerWidth}x${containerHeight}`);

                  // Exit retry loop on successful embedding
                  return;
                } catch (error) {
                  console.error('[HomePageCanvas] Error during SitePal embedding:', error);
                  if (isMountedRef.current) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    setErrorMessage(`Failed to initialize avatar: ${errorMessage}. Please try refreshing the page.`);
                    // Restore original ID on error through state
                    setContainerIdState('homepage-vhss-aiPlayer');
                  }
                  return;
                }
              }
            } else if (retryCount < maxRetries && isMountedRef.current && isOpen && !sitePalCleanupRef.current) {
              retryCount++;
              console.log(`[HomePageCanvas] DOM container not ready (attempt ${retryCount}/${maxRetries}), retrying in 100ms...`, {
                containerFound: !!container,
                containerId: container?.id || 'not found',
                containerIdState,
                offsetWidth: container?.offsetWidth || 0,
                offsetHeight: container?.offsetHeight || 0,
                offsetParent: container?.offsetParent !== null,
                parentNode: !!container?.parentNode
              });
              setTimeout(checkContainerAndEmbed, 100);
            } else if (isMountedRef.current && isOpen) {
              console.error('[HomePageCanvas] DOM container failed to initialize after maximum retries', {
                finalContainerIdState: containerIdState,
                containerFound: !!container,
                retryCount,
                maxRetries
              });
              setErrorMessage('Avatar container failed to initialize. Please try refreshing the page.');
            }
          };

          // Use requestAnimationFrame to ensure DOM is ready with enhanced debugging
          requestAnimationFrame(() => {
            console.log('[HomePageCanvas] Starting container initialization with state:', {
              containerIdState,
              isOpen,
              isMounted: isMountedRef.current,
              sitePalCleanup: sitePalCleanupRef.current
            });

            // Check if container exists immediately
            const immediateContainer = document.getElementById(containerIdState);
            console.log('[HomePageCanvas] Immediate container check:', {
              found: !!immediateContainer,
              id: immediateContainer?.id,
              dimensions: immediateContainer ? `${immediateContainer.offsetWidth}x${immediateContainer.offsetHeight}` : 'N/A'
            });

            setTimeout(checkContainerAndEmbed, 50);
          });
        } else {
          console.error('[HomePageCanvas] SitePal embed function not found.');
          const errorMsg = 'Failed to initialize AI avatar. Please refresh the page.';
          setErrorMessage(errorMsg);
          setLoadingMessage(errorMsg);
          setIsProcessing(false);
        }
      };

      if (existingScript && typeof window.AI_vhost_embed === 'function') {
        // Script already loaded, initialize directly
        console.log('[HomePageCanvas] SitePal script already loaded, initializing directly.');
        initializeSitePal();
      } else if (!existingScript) {
        // Load script for the first time
        console.log('[HomePageCanvas] Loading SitePal script for the first time.');
        const script = document.createElement('script');
        script.id = 'sitepal-script-homepage';
        script.src = '//vhss-d.oddcast.com/ai_embed_functions_v1.php';
        script.async = true;

        script.onload = () => {
          console.log('[HomePageCanvas] SitePal script loaded successfully.');
          initializeSitePal();
        };

        script.onerror = () => {
          console.error('[HomePageCanvas] Failed to load the SitePal script.');
          const errorMsg = 'The AI avatar script could not be downloaded. Please check your connection and refresh.';
          setErrorMessage(errorMsg);
          setLoadingMessage(errorMsg);
          setIsProcessing(false);
        };

        document.body.appendChild(script);
      } else {
        // Script exists but function not available yet, wait and retry
        console.log('[HomePageCanvas] Script exists but function not ready, retrying...');
        setTimeout(initializeSitePal, 100);
      }
    }

    // Cleanup function when modal is closed - use safer approach to prevent race conditions
    return () => {
      if (!isOpen) {
        console.log('[HomePageCanvas] Modal closed - performing cleanup.');

        // Mark cleanup in progress but don't mark as unmounted yet (that's for component unmount only)
        sitePalCleanupRef.current = true;

        // Disconnect mutation observer
        if (mutationObserverRef.current) {
          mutationObserverRef.current.disconnect();
          mutationObserverRef.current = null;
        }

        // Restore original error handler
        if (window.onerror && window.onerror.toString().includes('sitepalPlayer_v1.js')) {
          window.onerror = null;
        }

        // Stop all voice recognition activities
        try {
          stopListening();
          stopVAD();
        } catch (error) {
          console.log('[HomePageCanvas] Error stopping voice recognition:', error);
        }

        // Clear all timeouts
        if (bargeInGracePeriodRef.current) {
          clearTimeout(bargeInGracePeriodRef.current);
          bargeInGracePeriodRef.current = null;
        }
        if (speechEndTimeoutRef.current) {
          clearTimeout(speechEndTimeoutRef.current);
          speechEndTimeoutRef.current = null;
        }

        // Reset avatar state and container ID
        isAvatarSpeaking.current = false;
        canBargeInRef.current = true;
        didBargeInRef.current = false;
        setContainerIdState('homepage-vhss-aiPlayer');

        // Stop any ongoing avatar speech
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

        // CRITICAL FIX: Remove ALL DOM manipulation from cleanup to prevent React race conditions
        // Instead, let React handle DOM cleanup naturally and only reset state/callbacks
        console.log('[HomePageCanvas] Modal cleanup completed - DOM operations deferred to prevent race conditions');
      }
    };
  }, [isOpen, handleSitePalSpeechStart, handleSitePalSpeechEnd, stopListening, stopVAD]);

  // Greeting effect - trigger welcome message when avatar is ready
  useEffect(() => {
    const fetchAndSpeakGreeting = async () => {
      if (isAvatarReady && !isGreetingSpoken && canvasMode === 'conversation') {
        console.log('[HomePageCanvas] Avatar is ready. Delivering greeting with VAD initialization.');
        setLoadingMessage('Preparing voice recognition...');
        setIsProcessing(true);

        // 1. Ensure VAD is initialized before we proceed
        await initVAD();
        console.log('[HomePageCanvas] VAD initialized for voice recognition.');

        // 2. Personalized greeting based on authentication status
        const greetingText = isAuthenticated
          ? `Welcome back to TAIC, ${user?.displayName || user?.username || 'valued member'}! I'm here to help you explore our AI-powered crypto commerce platform. You can speak to me naturally or use the action buttons below. Whether you're interested in our Pioneer Program, want to discover products, or need assistance with your account, I'm ready to guide you through everything TAIC has to offer.`
          : `Welcome to TAIC! I'm your AI guide to the future of crypto commerce. You can speak to me naturally or use the action buttons below. I'm here to show you how our platform revolutionizes online shopping with AI technology and cryptocurrency rewards. Let me help you discover the Pioneer Program, explore our products, or learn how to get started with TAIC.`;

        // 3. Update state and mark greeting as done
        setIsGreetingSpoken(true);
        setLoadingMessage('');

        // Add greeting message to conversation
        const greetingMessage: AvatarMessage = {
          id: `greeting_${Date.now()}`,
          text: greetingText,
          timestamp: new Date(),
          type: 'greeting'
        };

        setAvatarMessages([greetingMessage]);
        setAiResponseText(greetingText);

        // 4. Speak the greeting and start listening for the user
        if (speakAndListenRef.current) {
          speakAndListenRef.current(greetingText);
        }

        setIsProcessing(false);

        // Track analytics
        trackEvent('homepage_avatar_greeting', {
          user_authenticated: isAuthenticated,
          session_id: guestSessionId,
          voice_recognition_enabled: true
        });
      }
    };

    fetchAndSpeakGreeting();
  }, [isAvatarReady, isGreetingSpoken, canvasMode, isAuthenticated, user, guestSessionId, initVAD]);

  // Effect to ensure VAD is stopped when the component unmounts
  useEffect(() => {
    return () => {
      stopVAD();
      console.log('[HomePageCanvas] VAD stopped on component unmount');
    };
  }, [stopVAD]);

  // Process command function for voice and button interactions
  const processCommand = useCallback(async (command: string) => {
    console.log('[HomePageCanvas] Processing command:', command);
    setIsProcessing(true);
    setUserInput('');

    try {
      // Create or get thread ID for conversation continuity
      let currentThreadId = threadId;
      if (!currentThreadId) {
        currentThreadId = `homepage_thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setThreadId(currentThreadId);
        console.log('[HomePageCanvas] Created new thread ID:', currentThreadId);
      }

      // Call the AI API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: command,
          threadId: currentThreadId,
          sessionId: guestSessionId,
          context: 'homepage_presentation'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.response || 'I apologize, but I encountered an issue processing your request. Please try again.';

      // Add user and AI messages to conversation
      const userMessage: AvatarMessage = {
        id: `user_${Date.now()}`,
        text: command,
        timestamp: new Date(),
        type: 'response'
      };

      const aiMessage: AvatarMessage = {
        id: `ai_${Date.now()}`,
        text: aiResponse,
        timestamp: new Date(),
        type: 'response'
      };

      setAvatarMessages(prev => [...prev, userMessage, aiMessage]);
      setAiResponseText(aiResponse);

      // Track analytics
      trackEvent('homepage_avatar_interaction', {
        user_message: command,
        ai_response_length: aiResponse.length,
        thread_id: currentThreadId,
        session_id: guestSessionId,
        user_authenticated: isAuthenticated
      });

      // Use the robust function to handle speech and listening
      if (speakAndListenRef.current) {
        speakAndListenRef.current(aiResponse);
      }

    } catch (error: any) {
      console.error('[HomePageCanvas] Error processing command:', error);
      const errorMsg = error.message || 'An unknown error occurred.';
      setErrorMessage(`Error: ${errorMsg}`);

      // Clear error after 5 seconds
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  }, [threadId, guestSessionId, isAuthenticated]);

  // Effect to keep a stable reference to processCommand
  useEffect(() => {
    processCommandRef.current = processCommand;
  }, [processCommand]);

  // Voice control handlers
  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (newMutedState) {
      // Stop avatar speech when muting
      if (window.sayText && typeof window.sayText === 'function') {
        try {
          const elevenLabsEngineID = 14;
          const jessicaVoiceID = "cgSgspJ2msm6clMCkdW9";
          const languageID = 1;
          window.sayText('', jessicaVoiceID, languageID, elevenLabsEngineID);
          console.log('[HomePageCanvas] Stopped avatar speech via mute');
        } catch (error) {
          console.log('[HomePageCanvas] Could not stop via sayText:', error);
        }
      }
    }
  };

  // Function to handle user action button clicks
  const handleActionClick = useCallback(async (action: ActionButton) => {
    console.log('[HomePageCanvas] Action clicked:', action.label);

    // Track user interaction
    trackEvent('homepage_avatar_action', {
      action_label: action.label,
      action_command: action.command,
      user_authenticated: isAuthenticated,
      session_id: guestSessionId
    });

    // Use the unified processCommand function for all interactions
    if (processCommandRef.current) {
      await processCommandRef.current(action.command);
    }
  }, [isAuthenticated, guestSessionId]);

  // Render voice control buttons
  const renderVoiceControls = () => {
    if (!isSTTSupported) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Voice recognition not supported
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Button
          variant={isListening || isListeningToUser ? "default" : "outline"}
          size="sm"
          onClick={handleMicClick}
          disabled={isProcessing}
          className={cn(
            "transition-all duration-200",
            (isListening || isListeningToUser) && "bg-red-500 hover:bg-red-600 text-white"
          )}
        >
          {isListening || isListeningToUser ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {isListening || isListeningToUser ? "Stop" : "Speak"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMuteToggle}
          disabled={isProcessing}
          className="transition-all duration-200"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          {isMuted ? "Unmute" : "Mute"}
        </Button>

        {(isListening || isListeningToUser) && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Listening...
          </div>
        )}

        {vadError && (
          <div className="flex items-center gap-1 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            Voice error
          </div>
        )}
      </div>
    );
  };

  // Function to handle special commands
  const handleSpecialCommand = useCallback(async (command: string) => {
    switch (command) {
      case 'connect_wallet':
        // Redirect to login page where wallet connection is properly handled
        window.location.href = '/login';
        break;

      case 'create_account':
        window.location.href = '/register';
        break;

      case 'show_pioneer_application':
        setCanvasMode('pioneer-application');
        break;

      case 'show_application_status':
        setCanvasMode('dashboard');
        break;

      case 'browse_all_products':
        window.location.href = '/products';
        break;

      case 'ai_shopping_help':
        window.location.href = '/ai-shopping-now';
        break;

      case 'show_dashboard':
        setCanvasMode('dashboard');
        break;

      case 'main_menu':
        setCanvasMode('conversation');
        setActions([
          {
            label: 'Tell me about TAIC',
            command: 'Tell me about TAIC platform and what makes it special',
            icon: <Bot className="h-4 w-4" />
          },
          {
            label: 'Pioneer Program Benefits',
            command: 'What are the benefits of joining the Pioneer Program?',
            icon: <Crown className="h-4 w-4" />
          },
          {
            label: 'Show me products',
            command: 'What products can I buy on TAIC?',
            icon: <ShoppingBag className="h-4 w-4" />
          },
          {
            label: 'How to get started',
            command: 'How do I get started with TAIC?',
            icon: <Rocket className="h-4 w-4" />
          }
        ]);
        break;

      default:
        // Use processCommand for general conversation
        if (processCommandRef.current) {
          await processCommandRef.current(command);
        }
        break;
    }
  }, [toast]);

  // Enhanced action click handler
  const enhancedHandleActionClick = useCallback(async (action: ActionButton) => {
    if (action.command.startsWith('show_') || action.command.includes('_')) {
      await handleSpecialCommand(action.command);
    } else {
      await handleActionClick(action);
    }
  }, [handleSpecialCommand, handleActionClick]);

  // Function to handle Pioneer Application Form success
  const handlePioneerApplicationSuccess = useCallback(() => {
    const successText = `Congratulations! Your Pioneer Program application has been submitted successfully. You'll receive a confirmation email shortly, and our team will review your application within 2-3 business days. Thank you for your interest in joining the TAIC Pioneer Program!`;

    const successMessage: AvatarMessage = {
      id: `success_${Date.now()}`,
      text: successText,
      timestamp: new Date(),
      type: 'system'
    };

    setAvatarMessages(prev => [...prev, successMessage]);
    setAiResponseText(successText);

    if (speakAndListenRef.current) {
      speakAndListenRef.current(successText);
    }

    // Return to conversation mode
    setTimeout(() => {
      setCanvasMode('conversation');
      setActions([
        {
          label: 'Check Application Status',
          command: 'show_application_status',
          icon: <CheckCircle className="h-4 w-4" />
        },
        {
          label: 'Explore Products',
          command: 'What products can I buy on TAIC?',
          icon: <ShoppingBag className="h-4 w-4" />
        },
        {
          label: 'Learn More About TAIC',
          command: 'Tell me about TAIC platform and what makes it special',
          icon: <Bot className="h-4 w-4" />
        }
      ]);
    }, 5000);

    // Track successful application
    trackEvent('pioneer_application_success', {
      user_authenticated: isAuthenticated,
      session_id: guestSessionId
    });
  }, [isAuthenticated, guestSessionId]);

  // Function to handle canvas mode changes
  const handleCanvasModeChange = useCallback((newMode: CanvasMode) => {
    setCanvasMode(newMode);

    // Track mode changes
    trackEvent('homepage_canvas_mode_change', {
      from_mode: canvasMode,
      to_mode: newMode,
      user_authenticated: isAuthenticated
    });
  }, [canvasMode, isAuthenticated]);

  // Consolidated cleanup effect for component unmounting
  useEffect(() => {
    return () => {
      // Only perform cleanup if component is actually unmounting (not just modal closing)
      if (isMountedRef.current) {
        console.log('[HomePageCanvas] Component unmounting - performing final cleanup');

        // Mark component as unmounted
        isMountedRef.current = false;
        sitePalCleanupRef.current = true;

        // Disconnect mutation observer
        if (mutationObserverRef.current) {
          mutationObserverRef.current.disconnect();
          mutationObserverRef.current = null;
        }

        // Stop all voice recognition activities immediately
        try {
          stopListening();
          stopVAD();
        } catch (error) {
          console.log('[HomePageCanvas] Error stopping voice recognition on unmount:', error);
        }

        // Clear all timeouts
        if (bargeInGracePeriodRef.current) {
          clearTimeout(bargeInGracePeriodRef.current);
          bargeInGracePeriodRef.current = null;
        }
        if (speechEndTimeoutRef.current) {
          clearTimeout(speechEndTimeoutRef.current);
          speechEndTimeoutRef.current = null;
        }

        // Clean up SitePal script if component unmounts
        const script = document.getElementById('sitepal-script-homepage');
        if (script) {
          // Don't remove script immediately as it might be used by other components
          console.log('[HomePageCanvas] Component unmounting, script cleanup deferred');
        }
      }
    };
  }, [stopListening, stopVAD]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
      "flex items-center justify-center p-4"
    )}>
      <div className="relative w-full max-w-6xl h-[90vh] bg-background rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">TAIC AI Assistant</h2>
              <p className="text-sm text-muted-foreground">
                {isAvatarReady ? 'Ready to help' : loadingMessage}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Voice Controls */}
            {renderVoiceControls()}

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex h-[calc(100%-4rem)]">
          {/* Left Panel - Avatar */}
          <div className="flex-1 flex flex-col">
            {/* SitePal Avatar Container */}
            <div className="flex-1 relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
              <div
                ref={containerRef}
                id={containerIdState}
                className="w-full h-full flex items-center justify-center"
                style={{ minWidth: '400px', minHeight: '500px' }}
              >
                {!isAvatarReady && (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">{loadingMessage}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {actions.length > 0 && (
              <div className="p-4 border-t bg-muted/30">
                <div className="flex flex-wrap gap-2">
                  {actions.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant || "outline"}
                      size="sm"
                      onClick={() => enhancedHandleActionClick(action)}
                      disabled={isProcessing}
                      className="flex items-center gap-2"
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Content */}
          <div className="w-96 border-l bg-muted/20 flex flex-col">
            {canvasMode === 'conversation' && (
              <>
                {/* Conversation History */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="space-y-4">
                    {avatarMessages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "p-3 rounded-lg",
                          message.type === 'system'
                            ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                            : "bg-white dark:bg-slate-800 border"
                        )}
                      >
                        <p className="text-sm">{message.text}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Input */}
                {userInput && (
                  <div className="p-4 border-t">
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        You said: "{userInput}"
                      </p>
                    </div>
                  </div>
                )}

                {/* STT Error Display */}
                {sttError && (
                  <div className="p-4 border-t">
                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        {sttError}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {canvasMode === 'pioneer-application' && (
              <div className="flex-1 p-4">
                <PioneerApplicationForm
                  onSuccess={handlePioneerApplicationSuccess}
                  onCancel={() => setCanvasMode('conversation')}
                />
              </div>
            )}

            {canvasMode === 'product-showcase' && (
              <div className="flex-1 p-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Featured Products</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {canvasProducts.slice(0, 6).map((product) => (
                      <div key={product.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                        {product.imageUrl && (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-20 object-cover rounded mb-2"
                          />
                        )}
                        <h4 className="font-medium text-sm">{product.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                        <p className="text-sm font-semibold mt-1">${product.price}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {canvasMode === 'dashboard' && (
              <div className="flex-1 p-4 flex items-center justify-center">
                {isAuthenticated ? (
                  <div className="text-center space-y-4">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                    <h4 className="text-lg font-semibold">Welcome back, {user?.displayName || user?.username || 'User'}!</h4>
                    <p className="text-muted-foreground">Dashboard features coming soon...</p>
                    <div className="space-y-2">
                      <Button onClick={() => setCanvasMode('pioneer-application')} className="w-full">
                        Apply to Pioneer Program
                      </Button>
                      <Button variant="outline" onClick={() => window.location.href = '/dashboard'} className="w-full">
                        Go to Full Dashboard
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <User className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h4 className="text-lg font-semibold">Sign In Required</h4>
                    <p className="text-muted-foreground">Connect your wallet or create an account to access your dashboard</p>
                    <div className="space-y-2">
                      <Button onClick={() => window.location.href = '/login'} className="w-full">
                        <Wallet className="h-4 w-4 mr-2" />
                        Connect Wallet
                      </Button>
                      <Button variant="outline" onClick={() => window.location.href = '/register'} className="w-full">
                        Create Account
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

