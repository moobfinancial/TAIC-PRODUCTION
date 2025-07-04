import { useEffect } from 'react';

/**
 * A hook that detects user inactivity and calls a callback after a specified timeout.
 * @param callback Function to call when inactivity is detected
 * @param timeout Time in milliseconds before inactivity is triggered
 */
const useInactivityDetector = (callback: () => void, timeout: number = 60000) => {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Events that reset the inactivity timer
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        callback();
      }, timeout);
    };

    // Set up event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Start the timer initially
    resetTimer();
    
    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Clean up event listeners on unmount
    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [callback, timeout]);
};

export default useInactivityDetector;
