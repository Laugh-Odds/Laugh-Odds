"use client";

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useYellowNetwork } from '@/context/YellowNetworkContext';

const API_ROUTE =
  process.env.NEXT_PUBLIC_PROD == "False" ? "http://localhost:5000" : "https://ViralForge.onrender.com";

const SERVER_YELLOW_ADDRESS = process.env.NEXT_PUBLIC_SERVER_YELLOW_ADDRESS || '';

export function useYellowChannel() {
  const { address } = useAccount();
  const {
    isConnected,
    isAuthenticated,
    yellowBalance,
    channelId,
    sendVoteTransfer,
    refreshBalance,
  } = useYellowNetwork();

  const [isVoting, setIsVoting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const castVote = useCallback(async (
    marketId: number,
    voteYes: boolean,
    memeCid?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!address) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (!isAuthenticated) {
      return { success: false, error: 'Not connected to Yellow Network' };
    }

    if (!SERVER_YELLOW_ADDRESS) {
      return { success: false, error: 'Server Yellow address not configured' };
    }

    const vote = voteYes ? 'funny' : 'lame';

    setIsVoting(true);
    setLastError(null);

    try {
      // Send off-chain transfer via Yellow Network state channel
      const transferResult = await sendVoteTransfer(
        SERVER_YELLOW_ADDRESS,
        marketId,
        vote,
        memeCid
      );

      if (!transferResult.success) {
        setLastError(transferResult.error || 'Transfer failed');
        return { success: false, error: transferResult.error };
      }

      // Record vote on server with transfer proof
      try {
        const response = await fetch(`${API_ROUTE}/api/user-vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: address,
            marketId,
            vote,
            transferId: transferResult.transferId,
            memeCid,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          console.warn('[Yellow] Failed to record vote on server:', data.message);
          // Don't fail the vote if server tracking fails
        }
      } catch (serverError) {
        console.warn('[Yellow] Server vote recording failed:', serverError);
      }

      // Store vote locally
      const voteKey = memeCid
        ? `user_vote_${address}_meme_${memeCid}`
        : `user_vote_${address}_${marketId}`;
      localStorage.setItem(voteKey, vote);
      if (memeCid) {
        localStorage.setItem(`voted_meme_${memeCid}`, 'true');
      }

      refreshBalance();
      return { success: true };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsVoting(false);
    }
  }, [address, isAuthenticated, sendVoteTransfer, refreshBalance]);

  return {
    castVote,
    yellowBalance,
    isConnected,
    isAuthenticated,
    isVoting,
    lastError,
    channelId,
  };
}
