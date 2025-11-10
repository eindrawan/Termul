/**
 * Utility functions to handle focus management after native dialog usage
 * This helps prevent issues where input elements become readonly/disabled
 * after using window.alert or window.confirm
 */

/**
 * Wrapper function for window.confirm that ensures proper focus management
 * @param message The message to display in the confirmation dialog
 * @returns Promise<boolean> indicating whether the user confirmed
 */
export function safeConfirm(message: string): boolean {
  // Store the currently focused element before showing the dialog
 const activeElement = document.activeElement as HTMLElement | null;

  try {
    // Show the native confirmation dialog
    const result = window.confirm(message);

    // Force window to regain focus in Electron to prevent inputs from becoming readonly
    // This is a workaround for an Electron issue where native dialogs can cause focus loss
    setTimeout(() => {
      // Force the window to regain focus
      window.focus();

      // Trigger a focus event on the document to ensure Electron recognizes the window has focus
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      window.dispatchEvent(focusEvent);

      // Restore focus to the previously active element if still available
      if (activeElement && document.contains(activeElement)) {
        activeElement.blur();
        setTimeout(() => {
          if (activeElement && document.contains(activeElement)) {
            activeElement.focus();
          } else {
            // Focus on body if element is no longer available
            document.body.focus();
          }
        }, 10);
      } else {
        // If the previous element is no longer available, focus on the body
        document.body.focus();
      }
    }, 10);

    return result;
  } catch (error) {
    // If anything goes wrong, ensure focus is restored
    setTimeout(() => {
      window.focus();
      if (activeElement && document.contains(activeElement)) {
        activeElement.focus();
      }
    }, 10);
    throw error;
  }
}

/**
 * Wrapper function for window.alert that ensures proper focus management
 * @param message The message to display in the alert dialog
 */
export function safeAlert(message: string): void {
  // Store the currently focused element before showing the dialog
  const activeElement = document.activeElement as HTMLElement | null;

  try {
    // Show the native alert dialog
    window.alert(message);

    // Force window to regain focus in Electron to prevent inputs from becoming readonly
    setTimeout(() => {
      // Force the window to regain focus
      window.focus();

      // Trigger a focus event on the document to ensure Electron recognizes the window has focus
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      window.dispatchEvent(focusEvent);

      // Restore focus to the previously active element if still available
      if (activeElement && document.contains(activeElement)) {
        activeElement.blur();
        setTimeout(() => {
          if (activeElement && document.contains(activeElement)) {
            activeElement.focus();
          } else {
            document.body.focus();
          }
        }, 10);
      } else {
        // If the previous element is no longer available, focus on the body
        document.body.focus();
      }
    }, 10);
  } catch (error) {
    // If anything goes wrong, ensure focus is restored
    setTimeout(() => {
      window.focus();
      if (activeElement && document.contains(activeElement)) {
        activeElement.focus();
      }
    }, 10);
    throw error;
  }
}

/**
 * Wrapper function for window.prompt that ensures proper focus management
 * @param message The message to display in the prompt dialog
 * @param defaultValue The default value for the prompt
 * @returns The value entered by the user, or null if cancelled
 */
export function safePrompt(message: string, defaultValue?: string): string | null {
  // Store the currently focused element before showing the dialog
  const activeElement = document.activeElement as HTMLElement | null;

  try {
    // Show the native prompt dialog
    const result = window.prompt(message, defaultValue || '');

    // Force window to regain focus in Electron to prevent inputs from becoming readonly
    setTimeout(() => {
      // Force the window to regain focus
      window.focus();

      // Trigger a focus event on the document to ensure Electron recognizes the window has focus
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      window.dispatchEvent(focusEvent);

      // Restore focus to the previously active element if still available
      if (activeElement && document.contains(activeElement)) {
        activeElement.blur();
        setTimeout(() => {
          if (activeElement && document.contains(activeElement)) {
            activeElement.focus();
          } else {
            document.body.focus();
          }
        }, 10);
      } else {
        // If the previous element is no longer available, focus on the body
        document.body.focus();
      }
    }, 10);

    return result;
  } catch (error) {
    // If anything goes wrong, ensure focus is restored
    setTimeout(() => {
      window.focus();
      if (activeElement && document.contains(activeElement)) {
        activeElement.focus();
      }
    }, 10);
    throw error;
  }
}