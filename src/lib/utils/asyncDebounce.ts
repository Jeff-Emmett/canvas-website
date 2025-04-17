/**
 * Creates a debounced version of an async function.
 * 
 * A debounced function will only execute after a specified delay has passed
 * without the function being called again. This is particularly useful for
 * functions that make API calls in response to user input, to avoid making
 * too many calls when a user is actively typing or interacting.
 * 
 * @param fn The async function to debounce
 * @param wait The time to wait in milliseconds before the function is called
 * @returns A debounced version of the input function
 * 
 * @example
 * // Create a debounced version of an API call function
 * const debouncedFetch = asyncDebounce(fetchFromAPI, 300);
 * 
 * // Use the debounced function in an input handler
 * const handleInputChange = (e) => {
 *   debouncedFetch(e.target.value)
 *     .then(result => setData(result))
 *     .catch(error => setError(error));
 * };
 */
export function asyncDebounce<A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
    wait: number
  ): (...args: A) => Promise<R> {
    let lastTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  
    return (...args: A): Promise<R> => {
      // Clear any existing timeout to cancel pending executions
      clearTimeout(lastTimeoutId);
  
      // Return a promise that will resolve with the function's result
      return new Promise((resolve, reject) => {
        // Create a new timeout
        const currentTimeoutId = setTimeout(async () => {
          try {
            // Only execute if this is still the most recent timeout
            if (currentTimeoutId === lastTimeoutId) {
              const result = await fn(...args);
              resolve(result);
            }
          } catch (err) {
            reject(err);
          }
        }, wait);
  
        // Store the current timeout ID
        lastTimeoutId = currentTimeoutId;
      });
    };
  }
  
  /**
   * Throttles an async function to be called at most once per specified period.
   * 
   * Unlike debounce which resets the timer on each call, throttle will ensure the
   * function is called at most once in the specified period, regardless of how many
   * times the throttled function is called.
   * 
   * @param fn The async function to throttle
   * @param limit The minimum time in milliseconds between function executions
   * @returns A throttled version of the input function
   * 
   * @example
   * // Create a throttled version of an API call function
   * const throttledSave = asyncThrottle(saveToAPI, 1000);
   * 
   * // Use the throttled function in an input handler
   * const handleInputChange = (e) => {
   *   throttledSave(e.target.value)
   *     .then(() => setSaveStatus('Saved'))
   *     .catch(error => setSaveStatus('Error saving'));
   * };
   */
  export function asyncThrottle<A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
    limit: number
  ): (...args: A) => Promise<R> {
    let lastRun = 0;
    let lastPromise: Promise<R> | null = null;
    let pending = false;
    let lastArgs: A | null = null;
  
    const execute = async (...args: A): Promise<R> => {
      lastRun = Date.now();
      pending = false;
      return await fn(...args);
    };
  
    return (...args: A): Promise<R> => {
      lastArgs = args;
  
      // If we're not pending and it's been longer than the limit since the last run,
      // execute immediately
      if (!pending && Date.now() - lastRun >= limit) {
        return execute(...args);
      }
  
      // If we don't have a promise or we're not pending, create a new promise
      if (!lastPromise || !pending) {
        pending = true;
        lastPromise = new Promise<R>((resolve, reject) => {
          setTimeout(async () => {
            try {
              // Make sure we're using the most recent args
              if (lastArgs) {
                const result = await execute(...lastArgs);
                resolve(result);
              }
            } catch (err) {
              reject(err);
            }
          }, limit - (Date.now() - lastRun));
        });
      }
  
      return lastPromise;
    };
  }
  
  /**
   * Extracts a search parameter from a URL and removes it from the URL.
   * 
   * Useful for handling one-time parameters like auth tokens or invite codes.
   * 
   * @param url The URL object
   * @param param The parameter name to extract
   * @returns The parameter value or null if not found
   * 
   * @example
   * // Extract an invite code from the current URL
   * const url = new URL(window.location.href);
   * const inviteCode = extractSearchParam(url, 'invite');
   * // The parameter is now removed from the URL
   */
  export const extractSearchParam = (url: URL, param: string): string | null => {
    // Get the parameter value
    const val = url.searchParams.get(param);
  
    // Remove the parameter from the URL
    url.searchParams.delete(param);
    
    // Update the browser history to reflect the URL change without reloading
    if (typeof history !== 'undefined') {
      history.replaceState(null, document.title, url.toString());
    }
  
    return val;
  };
  
  /**
   * Checks if a function execution is taking too long and returns a timeout result if so.
   * 
   * @param fn The async function to execute with timeout
   * @param timeout The maximum time in milliseconds to wait
   * @param timeoutResult The result to return if timeout occurs
   * @returns The function result or timeout result
   * 
   * @example
   * // Execute a function with a 5-second timeout
   * const result = await withTimeout(
   *   fetchDataFromSlowAPI,
   *   5000,
   *   { error: 'Request timed out' }
   * );
   */
  export async function withTimeout<T, R>(
    fn: () => Promise<T>,
    timeout: number,
    timeoutResult: R
  ): Promise<T | R> {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const timeoutPromise = new Promise<R>((resolve) => {
      timeoutId = setTimeout(() => resolve(timeoutResult), timeout);
    });
    
    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }