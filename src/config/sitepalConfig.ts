/**
 * SitePal Avatar Configuration
 * 
 * This file centralizes all SitePal-related configuration constants
 * to make maintenance and updates easier.
 */

export const SITEPAL_CONFIG = {
  // Script URLs
  SCRIPT_URL: 'https://vhss-d.oddcast.com/ai_embed_functions_v1.php',
  
  // Avatar dimensions
  DIMENSIONS: {
    DEFAULT_WIDTH: 300,
    DEFAULT_HEIGHT: 400,
    COPILOT_WIDTH: 200,  // Smaller width for copilot mode
    COPILOT_HEIGHT: 267, // Smaller height for copilot mode (maintains aspect ratio)
  },
  
  // Avatar parameters
  AVATAR_PARAMS: {
    SCENE_ID: 9226953,
    CHARACTER_ID: 278,
    BACKGROUND_ID: 1,
    LANGUAGE_ID: 1,
  },
  
  // Speech parameters
  SPEECH_PARAMS: {
    VOICE_ID: "cgSgspJ2msm6clMCkdW9",
    VOICE_TYPE: 1,
    ENGINE_ID: 14,
  },
  
  // Animation parameters
  ANIMATIONS: {
    IDLE: {
      name: "idle",
      intensity: 0.5,
    },
    LISTENING: {
      name: "listening",
      intensity: 0.7,
    },
    THINKING: {
      name: "thinking",
      intensity: 0.6,
    },
    SPEAKING: {
      name: "speaking",
      intensity: 0.8,
    },
  },
  
  // Initialization
  INITIALIZATION: {
    CLEANUP_DELAY_MS: 100,  // Delay before initializing after cleanup
    SCRIPT_LOAD_TIMEOUT_MS: 5000, // Maximum time to wait for script to load
    SAYTEXT_CHECK_INTERVAL_MS: 200, // Interval to check for sayText availability
    SAYTEXT_MAX_ATTEMPTS: 15, // Maximum attempts to check for sayText (3 seconds total)
  },
};

/**
 * SitePal state machine states
 */
export enum SitePalState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  PROCESSING_AI = 'PROCESSING_AI',
  AVATAR_SPEAKING = 'AVATAR_SPEAKING',
  ERROR = 'ERROR',
}

/**
 * SitePal action types for useReducer
 */
export enum SitePalActionType {
  RESET = 'RESET',
  INITIALIZE_SUCCESS = 'INITIALIZE_SUCCESS',
  START_LISTENING = 'START_LISTENING',
  STOP_LISTENING = 'STOP_LISTENING',
  START_PROCESSING = 'START_PROCESSING',
  START_SPEAKING = 'START_SPEAKING',
  FINISH_SPEAKING = 'FINISH_SPEAKING',
  SET_ERROR = 'SET_ERROR',
  SET_THREAD_ID = 'SET_THREAD_ID',
  SET_GREETING_SPOKEN = 'SET_GREETING_SPOKEN',
  SET_AVATAR_MESSAGES = 'SET_AVATAR_MESSAGES',
  SET_COPILOT_MODE = 'SET_COPILOT_MODE',
  SET_MUTED = 'SET_MUTED',
}

/**
 * SitePal state interface
 */
export interface SitePalStateInterface {
  status: SitePalState;
  isAvatarReady: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isMuted: boolean;
  isGreetingSpoken: boolean;
  isCopilotMode: boolean;
  currentSpeech: string | null;
  threadId: string | null;
  error: string | null;
  avatarMessages: string[];
}

/**
 * SitePal action interface
 */
export interface SitePalAction {
  type: SitePalActionType;
  payload?: any;
}

/**
 * Initial state for SitePal reducer
 */
export const initialSitePalState: SitePalStateInterface = {
  status: SitePalState.IDLE,
  isAvatarReady: false,
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  isMuted: false,
  isGreetingSpoken: false,
  isCopilotMode: false,
  currentSpeech: null,
  threadId: null,
  error: null,
  avatarMessages: [],
};
