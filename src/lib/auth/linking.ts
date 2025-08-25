import * as odd from '@oddjs/odd';

/**
 * Creates an account linking consumer for the specified username
 * @param username The username to create a consumer for
 * @returns A Promise resolving to an AccountLinkingConsumer-like object
 */
export const createAccountLinkingConsumer = async (
  username: string
): Promise<any> => {
  // Check if the method exists in the current ODD version
  if (odd.account && typeof (odd.account as any).createConsumer === 'function') {
    return await (odd.account as any).createConsumer({ username });
  }
  
  // Fallback: create a mock consumer for development
  console.warn('Account linking consumer not available in current ODD version, using mock implementation');
  return {
    on: (event: string, callback: Function) => {
      // Mock event handling
      if (event === 'challenge') {
        // Simulate PIN challenge
        setTimeout(() => callback({ pin: [1, 2, 3, 4] }), 1000);
      } else if (event === 'link') {
        // Simulate successful link
        setTimeout(() => callback({ approved: true, username }), 2000);
      }
    },
    destroy: () => {
      // Cleanup mock consumer
    }
  };
};

/**
 * Creates an account linking producer for the specified username
 * @param username The username to create a producer for
 * @returns A Promise resolving to an AccountLinkingProducer-like object
 */
export const createAccountLinkingProducer = async (
  username: string
): Promise<any> => {
  // Check if the method exists in the current ODD version
  if (odd.account && typeof (odd.account as any).createProducer === 'function') {
    return await (odd.account as any).createProducer({ username });
  }
  
  // Fallback: create a mock producer for development
  console.warn('Account linking producer not available in current ODD version, using mock implementation');
  return {
    on: (_event: string, _callback: Function) => {
      // Mock event handling - parameters unused in mock implementation
    },
    destroy: () => {
      // Cleanup mock producer
    }
  };
};