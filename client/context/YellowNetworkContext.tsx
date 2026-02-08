"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { keccak256, toBytes, toHex } from 'viem';
import {
  CLEARNODE_WS_URL,
  buildAuthRequest,
  buildAuthVerify,
  buildAuthTypedData,
  buildRequest,
  nextReqId,
  parseResponse,
  requestFaucetTokens,
  VOTE_COST_AMOUNT,
  type AuthParams,
} from '@/lib/yellowNetwork';

interface YellowNetworkState {
  isConnected: boolean;
  isAuthenticated: boolean;
  yellowBalance: string;
  channelId: string | null;
  sessionKey: string | null;
  error: string | null;
  sendVoteTransfer: (
    toAddress: string,
    marketId: number,
    vote: 'funny' | 'lame',
    memeCid?: string
  ) => Promise<{ success: boolean; transferId?: string; error?: string }>;
  refreshBalance: () => void;
}

const YellowNetworkContext = createContext<YellowNetworkState>({
  isConnected: false,
  isAuthenticated: false,
  yellowBalance: '0',
  channelId: null,
  sessionKey: null,
  error: null,
  sendVoteTransfer: async () => ({ success: false, error: 'Not initialized' }),
  refreshBalance: () => {},
});

export function useYellowNetwork() {
  return useContext(YellowNetworkContext);
}

export function YellowNetworkProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected: walletConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const wsRef = useRef<WebSocket | null>(null);
  const sessionKeyRef = useRef<string | null>(null);
  const sessionPrivateKeyRef = useRef<`0x${string}` | null>(null);
  const authParamsRef = useRef<AuthParams | null>(null);
  const nonceRef = useRef(0);
  const pendingTransfersRef = useRef<Map<number, { resolve: Function; reject: Function }>>(new Map());

  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [yellowBalance, setYellowBalance] = useState('0');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate ephemeral session key and store the private key for signing
  const generateSessionKey = (): string => {
    const privateKey = generatePrivateKey();
    sessionPrivateKeyRef.current = privateKey;
    return privateKeyToAccount(privateKey).address;
  };

  // Build canonical JSON (sorted keys) and sign with session key
  const signRequest = useCallback(async (req: any[]): Promise<{ canonical: string; sig: string }> => {
    if (!sessionPrivateKeyRef.current) throw new Error('No session key');
    
    // Sort keys alphabetically for canonical JSON
    const sortKeys = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sortKeys);
      } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj)
          .sort()
          .reduce((result: any, key) => {
            result[key] = sortKeys(obj[key]);
            return result;
          }, {});
      }
      return obj;
    };
    
    const sortedReq = sortKeys(req);
    const canonical = JSON.stringify(sortedReq);
    
    // Yellow Network expects raw signature over keccak256 hash (no Ethereum Signed Message prefix)
    const messageHash = keccak256(toBytes(canonical));
    
    const account = privateKeyToAccount(sessionPrivateKeyRef.current);
    const sig = await account.sign({ hash: messageHash });
    
    return { canonical, sig };
  }, []);

  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    try {
      const parsed = parseResponse(event.data);
      if (!parsed) {
        console.log('[Yellow] Unparseable message:', event.data);
        return;
      }

      const { id, method, result } = parsed;
      console.log('[Yellow] Received:', method, result);

      switch (method) {
        case 'auth_challenge': {
          // Clearnode responded to our auth request with a challenge
          if (!address || !sessionKeyRef.current || !authParamsRef.current) {
            console.error('[Yellow] Missing auth data:', { address, sessionKey: sessionKeyRef.current, authParams: authParamsRef.current });
            return;
          }
          const challenge = result?.challenge_message;
          if (!challenge) {
            console.error('[Yellow] No challenge in auth_challenge response');
            return;
          }
          try {
            console.log('[Yellow] Signing challenge:', challenge);
            console.log('[Yellow] Auth params:', authParamsRef.current);
            const typedData = buildAuthTypedData(challenge, authParamsRef.current);
            console.log('[Yellow] EIP-712 typed data:', JSON.stringify(typedData, null, 2));
            const signature = await signTypedDataAsync(typedData);
            console.log('[Yellow] Generated signature:', signature.substring(0, 20) + '...');
            const verifyMsg = buildAuthVerify(signature, challenge);
            console.log('[Yellow] Sending auth_verify:', JSON.stringify(verifyMsg));
            sendMessage(verifyMsg);
          } catch (signError) {
            console.error('[Yellow] Auth signing failed:', signError);
            setError('Failed to sign Yellow Network auth challenge');
          }
          break;
        }

        case 'auth_verify': {
          if (result?.success || result?.authenticated || result?.session_key) {
            console.log('[Yellow] Authenticated successfully');
            setIsAuthenticated(true);
            setError(null);
            sendMessage(buildRequest('get_ledger_balances', {}));
            sendMessage(buildRequest('get_channels', {}));
            // Request faucet after fetching balance (bu notification will follow)
            if (address) {
              requestFaucetTokens(address);
            }
          } else {
            console.error('[Yellow] Auth failed:', result);
            setError(result?.error || 'Yellow Network authentication failed');
            setIsAuthenticated(false);
          }
          break;
        }

        case 'get_ledger_balances': {
          const entries = result?.ledger_balances || [];
          const entry = entries.find((b: any) => b.asset === 'ytest.usd');
          if (entry?.amount) {
            setYellowBalance((parseFloat(entry.amount) / 1_000_000).toString());
          }
          break;
        }

        case 'bu': {
          // Push notification: balance update
          const buUpdates = result?.balance_updates || [];
          const buEntry = buUpdates.find((b: any) => b.asset === 'ytest.usd');
          if (buEntry?.amount) {
            setYellowBalance((parseFloat(buEntry.amount) / 1_000_000).toString());
          } else {
            sendMessage(buildRequest('get_ledger_balances', {}));
          }
          break;
        }

        case 'channels':
        case 'get_channels': {
          const channelList = result?.channels || (Array.isArray(result) ? result : []);
          const openChannel = channelList.find((c: any) => c.status === 'open');
          if (openChannel) {
            setChannelId(openChannel.channel_id || openChannel.id);
          }
          break;
        }

        case 'cu': // channel update notification — re-fetch channels
          sendMessage(buildRequest('get_channels', {}));
          break;

        case 'tr': // transfer notification — ignore, balance update follows
        case 'asu': // app session update notification
          break;

        case 'open_channel': {
          if (result?.channel_id) {
            setChannelId(result.channel_id);
            console.log('[Yellow] Channel opened:', result.channel_id);
          }
          break;
        }

        case 'transfer': {
          // Transfer response - match by request ID
          const transfer = pendingTransfersRef.current.get(id);
          if (transfer) {
            if (result?.transactions && result.transactions.length > 0) {
              const txId = result.transactions[0].id;
              transfer.resolve({ success: true, transferId: txId?.toString() });
              pendingTransfersRef.current.delete(id);
              sendMessage(buildRequest('get_ledger_balances', {}));
            } else if (result?.error) {
              transfer.reject({ success: false, error: result.error });
              pendingTransfersRef.current.delete(id);
            } else {
              transfer.reject({ success: false, error: 'Transfer failed - no transaction returned' });
              pendingTransfersRef.current.delete(id);
            }
          }
          break;
        }

        case 'assets': {
          // Server sent available assets list - just log it
          console.log('[Yellow] Available assets:', result?.assets);
          break;
        }

        case 'error': {
          // Server sent an error response
          console.error('[Yellow] Server error:', result?.error);
          setError(result?.error || 'Unknown server error');
          break;
        }

        default:
          console.log('[Yellow] Unhandled method:', method, result);
      }
    } catch (err) {
      console.error('[Yellow] Error handling message:', err);
    }
  }, [address, signTypedDataAsync, sendMessage, yellowBalance]);

  // Connect to Clearnode
  const connect = useCallback(() => {
    if (!address || wsRef.current) return;

    console.log('[Yellow] Connecting to Clearnode...');
    const ws = new WebSocket(CLEARNODE_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Yellow] WebSocket connected');
      setIsConnected(true);
      setError(null);

      // Generate session key and start auth
      const sessionKey = generateSessionKey();
      sessionKeyRef.current = sessionKey;
      const { message, params } = buildAuthRequest(sessionKey, address);
      authParamsRef.current = params;
      sendMessage(message);
    };

    ws.onmessage = handleMessage;

    ws.onerror = (err) => {
      console.error('[Yellow] WebSocket error:', err);
      setError('Yellow Network connection error');
    };

    ws.onclose = () => {
      console.log('[Yellow] WebSocket disconnected');
      setIsConnected(false);
      setIsAuthenticated(false);
      wsRef.current = null;
    };
  }, [address, sendMessage, handleMessage]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsAuthenticated(false);
    setChannelId(null);
    sessionKeyRef.current = null;
    sessionPrivateKeyRef.current = null;
  }, []);

  // Connect when wallet connects
  useEffect(() => {
    if (walletConnected && address) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      // Don't disconnect on unmount to preserve channel across navigations
    };
  }, [walletConnected, address, connect, disconnect]);

  const refreshBalance = useCallback(() => {
    if (isAuthenticated) {
      sendMessage(buildRequest('get_ledger_balances', {}));
    }
  }, [isAuthenticated, sendMessage]);

  const sendVoteTransfer = useCallback(async (
    toAddress: string,
    marketId: number,
    vote: 'funny' | 'lame',
    memeCid?: string
  ): Promise<{ success: boolean; transferId?: string; error?: string }> => {
    if (!isAuthenticated) {
      return { success: false, error: 'Not authenticated with Yellow Network' };
    }

    if (!address) {
      return { success: false, error: 'Wallet not connected' };
    }

    return new Promise(async (resolve) => {
      // Transfer requires session key signature
      // Only send recognized fields: destination + allocations (no custom metadata)
      const params = {
        allocations: [{ asset: 'ytest.usd', amount: VOTE_COST_AMOUNT }],
        destination: toAddress,
      };
      
      // Get request ID before building the request
      const reqId = nextReqId();
      const req = [reqId, 'transfer', params, Date.now()];
      
      // Store the promise resolver with the request ID
      pendingTransfersRef.current.set(reqId, {
        resolve: (result: any) => resolve(result),
        reject: (err: any) => resolve({ success: false, error: err.error || 'Transfer failed' }),
      });
      
      try {
        const { canonical, sig } = await signRequest(req);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // CRITICAL: Send the exact canonical string that was signed
          // Do NOT parse and re-stringify, as key order must match what was signed
          // Manually construct message with the canonical req string to ensure consistency
          const message = `{"req":${canonical},"sig":${JSON.stringify([sig])}}`;
          wsRef.current.send(message);
        } else {
          pendingTransfersRef.current.delete(reqId);
          resolve({ success: false, error: 'WebSocket not connected' });
          return;
        }
      } catch (signErr) {
        console.error('[Yellow] Transfer signing failed:', signErr);
        pendingTransfersRef.current.delete(reqId);
        resolve({ success: false, error: 'Failed to sign transfer' });
        return;
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingTransfersRef.current.has(reqId)) {
          pendingTransfersRef.current.delete(reqId);
          resolve({ success: false, error: 'Transfer timeout' });
        }
      }, 30000);
    });
  }, [isAuthenticated, address, signRequest]);

  return (
    <YellowNetworkContext.Provider
      value={{
        isConnected,
        isAuthenticated,
        yellowBalance,
        channelId,
        sessionKey: sessionKeyRef.current,
        error,
        sendVoteTransfer,
        refreshBalance,
      }}
    >
      {children}
    </YellowNetworkContext.Provider>
  );
}
