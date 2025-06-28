// /src/types/sitepal.d.ts

// By declaring these functions in the global scope, we can access them from anywhere
// in the app without having to import them. This is necessary for scripts that are
// loaded globally, like the SitePal script.

declare global {
  interface Window {
    // Function to embed the avatar
    AI_vhost_embed?: (
      width: number,
      height: number,
      embedId: number,
      sceneId: number,
      autoplay: number,
      allowComms: number
    ) => void;
    // SitePal API functions
    sayText?: (
      text: string,
      voiceId?: string | number, // voice id or TTS engine id
      languageId?: number,
      ttsEngineId?: number
    ) => void;
    stopSpeech?: () => void;
    embed?: (options: any) => void;

    // SitePal event handlers
    vh_sceneLoaded?: (sceneName: string) => void;
    vh_characterLoaded?: (characterId: string) => void;
    vh_speechStarted?: () => void;
    vh_speechEnded?: () => void;
    setFacialExpression?: (expression: string, amplitude?: number, duration?: number) => void;
  }
}

// This empty export statement makes the file a module, which is required for 'declare global'.
export {};
