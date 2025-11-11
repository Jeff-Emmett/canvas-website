// Cloudflare Worker relayer service for gasless transactions
// Verifies Web Crypto API signatures and submits transactions on behalf of users

import { type Address, type Hash, createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

interface RelayerRequest {
  authorization: {
    to: string;
    value: string;
    data: string;
    nonce: number;
    deadline: number;
  };
  signature: string;
  proxyContractAddress: Address;
  chainId: number;
}

interface RelayerResponse {
  success: boolean;
  transactionHash?: Hash;
  error?: string;
}

/**
 * Relayer service that accepts signed transaction requests
 * and submits them to the blockchain, paying for gas
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only handle POST requests for transaction submission
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      const body: RelayerRequest = await request.json();

      // Validate request
      if (!body.authorization || !body.signature || !body.proxyContractAddress) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid request format' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Check deadline
      if (Date.now() / 1000 > body.authorization.deadline) {
        return new Response(
          JSON.stringify({ success: false, error: 'Transaction expired' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Get relayer private key from environment
      // WARNING: This should be stored securely in Cloudflare Workers secrets
      const relayerPrivateKey = env.RELAYER_PRIVATE_KEY;
      if (!relayerPrivateKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Relayer not configured' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Get chain configuration
      const chain = body.chainId === 1 ? mainnet : sepolia;
      
      // Create relayer account
      const relayerAccount = privateKeyToAccount(relayerPrivateKey as `0x${string}`);

      // Create wallet client for relayer
      const walletClient = createWalletClient({
        account: relayerAccount,
        chain,
        transport: http(),
      });

      // Build transaction to proxy contract
      const proxyABI = [
        {
          name: 'execute',
          type: 'function',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'signature', type: 'bytes' },
          ],
        },
      ] as const;

      const signatureBytes = `0x${Buffer.from(body.signature, 'base64').toString('hex')}`;

      const transactionData = encodeFunctionData({
        abi: proxyABI,
        functionName: 'execute',
        args: [
          body.authorization.to as Address,
          BigInt(body.authorization.value),
          body.authorization.data as `0x${string}`,
          BigInt(body.authorization.nonce),
          BigInt(body.authorization.deadline),
          signatureBytes as `0x${string}`,
        ],
      });

      // Submit transaction (relayer pays for gas)
      const hash = await walletClient.sendTransaction({
        to: body.proxyContractAddress,
        data: transactionData,
      });

      const response: RelayerResponse = {
        success: true,
        transactionHash: hash,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Relayer error:', error);
      const response: RelayerResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

