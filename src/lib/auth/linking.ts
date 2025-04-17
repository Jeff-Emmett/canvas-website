import * as odd from '@oddjs/odd';
import * as account from '@oddjs/odd/account';

/**
 * Creates an account linking consumer for the specified username
 * @param username The username to create a consumer for
 * @returns A Promise resolving to an AccountLinkingConsumer
 */
export const createAccountLinkingConsumer = async (
  username: string
): Promise<account.AccountLinkingConsumer> => {
  return await odd.account.createConsumer({ username });
};

/**
 * Creates an account linking producer for the specified username
 * @param username The username to create a producer for
 * @returns A Promise resolving to an AccountLinkingProducer
 */
export const createAccountLinkingProducer = async (
  username: string
): Promise<account.AccountLinkingProducer> => {
  return await odd.account.createProducer({ username });
};