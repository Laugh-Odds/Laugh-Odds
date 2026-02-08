"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Wallet,
  AlertCircle,
  Zap,
} from "lucide-react";
import { MemeTemplate } from "@/lib/memes";
import { useAccount, useReadContract } from "wagmi";
import { useParams, useRouter } from "next/navigation";
import { CONTRACT_ABI, DEPLOYED_CONTRACT } from "@/lib/ethers";
import { useYellowChannel } from "@/hooks/useYellowChannel";

// Type definitions
interface ContractMemeData {
  creator: string;
  cid: string;
  memeTemplate: number;
}

type MarketDataTuple = [
  string,   // creator
  bigint,   // endTime
  boolean,  // isActive
  string,   // metadata
  ContractMemeData[] // memes array
];

const MemeView = () => {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showReaction, setShowReaction] = useState<"like" | "dislike" | null>(null);
  const [memes, setMemes] = useState<MemeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);

  const { address, isConnected } = useAccount();
  const { castVote, yellowBalance, isAuthenticated, isVoting } = useYellowChannel();

  const hasEnoughBalance = parseFloat(yellowBalance) >= 0.0001;

  // Check if user has already voted on this specific meme
  useEffect(() => {
    if (memes.length > 0 && currentIndex < memes.length) {
      const currentMeme = memes[currentIndex];
      const voted = localStorage.getItem(`voted_meme_${currentMeme.cid}`);
      setHasVoted(!!voted);
    }
  }, [templateId, currentIndex, memes]);

  // Get market count
  const { data: marketCount } = useReadContract({
    address: DEPLOYED_CONTRACT as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: "marketCount",
    args: [],
  }) as { data: bigint | undefined };

  // Get market data
  const { data: marketData, error: marketError } = useReadContract({
    address: DEPLOYED_CONTRACT as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: "getMarket",
    args: [BigInt(templateId)],
    query: {
      enabled: !!marketCount && Number(templateId) < Number(marketCount)
    }
  }) as { data: MarketDataTuple | undefined; error: any };

  // Handle instructions visibility
  useEffect(() => {
    const hasSeenInstructions = localStorage.getItem("hasSeenMemeInstructions");
    if (hasSeenInstructions) {
      setShowInstructions(false);
    }
  }, []);

  // Load memes for specific template
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadMemes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!marketCount || Number(templateId) >= Number(marketCount)) {
          throw new Error(
            `Template ${templateId} does not exist. Available templates: 0-${
              marketCount ? Number(marketCount) - 1 : 0
            }`
          );
        }

        if (marketError) {
          throw new Error(`Failed to load market data: ${marketError.message}`);
        }

        if (!marketData) {
          console.log("Market data not available yet, waiting...");
          return;
        }

        const marketMemes = marketData[4] as ContractMemeData[];

        if (!marketMemes || marketMemes.length === 0) {
          throw new Error("No memes found for this template. Try creating the first meme!");
        }

        console.log(`Loading ${marketMemes.length} memes for template ${templateId}`);

        const loadedMemes = await Promise.all(
          marketMemes.map(async (meme: ContractMemeData, index: number) => {
            try {
              // Use Pinata gateway URL directly for the image
              const imageUrl = `https://gateway.pinata.cloud/ipfs/${meme.cid}`;
              
              console.log(`Using Pinata gateway for meme ${index}: ${imageUrl}`);

              const displayMeme: MemeTemplate = {
                creator: meme.creator,
                cid: meme.cid,
                memeTemplate: templateId,
                image: imageUrl,
                isTemplate: false
              };

              return displayMeme;
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                throw error;
              }
              console.error(`Failed to load meme ${index}:`, error);
              return null;
            }
          })
        );

        if (!isMounted) return;

        const validMemes = loadedMemes.filter((meme): meme is MemeTemplate => meme !== null);

        if (validMemes.length === 0) {
          throw new Error("No memes could be loaded from IPFS. This might be a temporary network issue.");
        }

        console.log(`Successfully loaded ${validMemes.length} out of ${marketMemes.length} memes`);
        setMemes(validMemes);
      } catch (error) {
        if (!isMounted) return;

        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Error loading memes:", error);
        setError(error instanceof Error ? error.message : "Failed to load memes");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (marketCount !== undefined) {
      loadMemes();
    }

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [marketData, templateId, marketCount, marketError]);

  // Swipe handling
  const handleDrag = (event: any, info: PanInfo) => {
    // Visual feedback during drag (optional)
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 50;
    const { offset } = info;

    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      if (offset.x > swipeThreshold) {
        handleLike();
      } else if (offset.x < -swipeThreshold) {
        handleDislike();
      }
    }
  };

  // Navigation functions
  const goToPrevious = () => {
    setDirection(-1);
    const prevIndex = (currentIndex - 1 + memes.length) % memes.length;
    setCurrentIndex(prevIndex);

    const prevMeme = memes[prevIndex];
    if (prevMeme) {
      const voted = localStorage.getItem(`voted_meme_${prevMeme.cid}`);
      setHasVoted(!!voted);
    }
  };

  const goToNext = () => {
    setDirection(1);
    const nextIndex = (currentIndex + 1) % memes.length;
    setCurrentIndex(nextIndex);

    const nextMeme = memes[nextIndex];
    if (nextMeme) {
      const voted = localStorage.getItem(`voted_meme_${nextMeme.cid}`);
      setHasVoted(!!voted);
    }
  };

  const handleLike = async () => {
    if (isLoading || memes.length === 0 || hasVoted || isVoting) return;

    if (!isConnected || !address) {
      alert("Please connect your wallet to vote!");
      return;
    }

    if (!isAuthenticated) {
      setShowPaymentInfo(true);
      return;
    }

    if (!hasEnoughBalance) {
      setShowPaymentInfo(true);
      return;
    }

    const mm = memes[currentIndex];
    const existingVote = localStorage.getItem(`voted_meme_${mm.cid}`);
    if (existingVote) {
      alert("You have already voted on this meme!");
      return;
    }

    setShowReaction("like");

    try {
      const result = await castVote(parseInt(mm.memeTemplate), true, mm.cid);

      if (result.success) {
        setHasVoted(true);
        setTimeout(() => {
          setShowReaction(null);
          goToNext();
        }, 2000);
      } else {
        setTimeout(() => setShowReaction(null), 1000);
        if (result.error !== "Payment cancelled by user") {
          alert(`Voting failed: ${result.error || "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error("Error during voting:", error);
      setTimeout(() => setShowReaction(null), 1000);
      alert("Voting failed. Please try again.");
    }
  };

  const handleDislike = async () => {
    if (isLoading || memes.length === 0 || hasVoted || isVoting) return;

    if (!isConnected || !address) {
      alert("Please connect your wallet to vote!");
      return;
    }

    if (!isAuthenticated) {
      setShowPaymentInfo(true);
      return;
    }

    if (!hasEnoughBalance) {
      setShowPaymentInfo(true);
      return;
    }

    const mm = memes[currentIndex];
    const existingVote = localStorage.getItem(`voted_meme_${mm.cid}`);
    if (existingVote) {
      alert("You have already voted on this meme!");
      return;
    }

    setShowReaction("dislike");

    try {
      const result = await castVote(parseInt(mm.memeTemplate), false, mm.cid);

      if (result.success) {
        setHasVoted(true);
        setTimeout(() => {
          setShowReaction(null);
          goToNext();
        }, 2000);
      } else {
        setTimeout(() => setShowReaction(null), 1000);
        if (result.error !== "Payment cancelled by user") {
          alert(`Voting failed: ${result.error || "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error("Error during voting:", error);
      setTimeout(() => setShowReaction(null), 1000);
      alert("Voting failed. Please try again.");
    }
  };

  const closeInstructions = () => {
    setShowInstructions(false);
    localStorage.setItem("hasSeenMemeInstructions", "true");
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -1000 : 1000,
      opacity: 0,
    }),
  };

  if (error) {
    return (
      <div className="max-w-full min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 text-white text-center max-w-md">
          <p className="text-xl mb-4">😕 {error}</p>
          <div className="space-y-2 mb-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-400 glow-blue transition-all mr-2"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/app/memes')}
              className="px-4 py-2 glass hover:bg-white/10 text-white rounded-lg transition-all"
            >
              Back to Gallery
            </button>
          </div>
          {marketCount && (
            <p className="text-sm text-white/50">
              Available templates: 0 to {Number(marketCount) - 1}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full h-screen flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 z-30">
        <button
          onClick={() => router.back()}
          className="text-white/80 hover:text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {/* Yellow Network Balance */}
        {isConnected && (
          <div className="flex items-center gap-4">
            <div className={`glass rounded-full px-3 py-1 text-sm flex items-center gap-2 ${
              isAuthenticated ? 'text-yellow-300' : 'text-white'
            }`}>
              <Zap className="w-4 h-4" />
              {isAuthenticated
                ? `${parseFloat(yellowBalance).toFixed(4)} ytest.usd`
                : 'Connecting...'}
            </div>

            {/* Meme Counter */}
            {memes.length > 0 && (
              <div className="glass rounded-full px-4 py-2 text-white text-sm">
                {currentIndex + 1} / {memes.length}
              </div>
            )}
          </div>
        )}

        {/* Vote Status */}
        {hasVoted && (
          <div className="glass rounded-full px-3 py-1 text-green-400 text-sm">
            ✓ Voted
          </div>
        )}
      </div>

      {/* Payment Info Modal */}
      <AnimatePresence>
        {showPaymentInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="glass-strong rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-bold text-white">
                  {!isAuthenticated ? 'Yellow Network Required' : 'Insufficient Balance'}
                </h3>
              </div>

              <div className="space-y-3 text-white/70">
                {!isAuthenticated ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                    <p className="text-yellow-300">
                      Connecting to Yellow Network for instant gasless votes...
                    </p>
                  </div>
                ) : (
                  <>
                    <p>To vote, you need <strong className="text-white">0.0001 ytest.usd</strong></p>
                    <p>Your balance: <strong className="text-white">{parseFloat(yellowBalance).toFixed(4)} ytest.usd</strong></p>

                    {!hasEnoughBalance && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                        <p className="text-red-300">Insufficient balance. Requesting faucet tokens...</p>
                      </div>
                    )}
                  </>
                )}

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                  <p className="text-blue-300">
                    ⚡ Votes are instant and gasless via Yellow Network state channels!
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPaymentInfo(false)}
                  className="flex-1 px-4 py-2 glass hover:bg-white/10 text-white rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl z-50">
            <div className="text-white text-xl">Loading memes...</div>
          </div>
        )}

        {/* Instructions Overlay */}
        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-6 p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-4">
                How to Rate Memes
              </h2>

              <div className="space-y-4 text-center max-w-md">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <ThumbsUp className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white">Swipe Right or Click for Funny</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                    <ThumbsDown className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white">Swipe Left or Click for Lame</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-500 rounded-full flex items-center justify-center">
                    <ChevronRight className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white">Use arrows to navigate</span>
                </div>

                <div className="text-sm text-yellow-400 mt-4 p-3 bg-yellow-400/10 rounded-lg">
                  ⚠️ You can only vote once per meme!
                </div>

                <div className="text-sm text-blue-400 mt-2 p-3 bg-blue-400/10 rounded-lg">
                  ⚡ Votes are instant & gasless via Yellow Network state channels!
                </div>
              </div>

              <button
                onClick={closeInstructions}
                className="mt-6 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Got it!
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reaction Animations */}
        <AnimatePresence>
          {showReaction && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40"
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                showReaction === "like" ? "bg-green-500" : "bg-red-500"
              }`}>
                {showReaction === "like" ? (
                  <ThumbsUp className="w-10 h-10 text-white" />
                ) : (
                  <ThumbsDown className="w-10 h-10 text-white" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons - Left */}
        {memes.length > 1 && (
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-30 w-12 h-12 glass hover:bg-white/15 rounded-full flex items-center justify-center transition-all duration-200"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Meme Display */}
        <div className="w-[400px] h-[60vh] relative overflow-hidden rounded-xl">
          {!isLoading && memes.length > 0 && (
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                className="absolute w-full h-full"
              >
                <img
                  src={memes[currentIndex]?.image}
                  alt="Meme"
                  className="w-full h-full object-contain rounded-xl"
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Navigation Buttons - Right */}
        {memes.length > 1 && (
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-30 w-12 h-12 glass hover:bg-white/15 rounded-full flex items-center justify-center transition-all duration-200"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="p-6">
        <div className="flex justify-center items-center gap-6">
          {/* Dislike Button */}
          <motion.button
            whileHover={{ scale: hasVoted || isVoting ? 1 : 1.05 }}
            whileTap={{ scale: hasVoted || isVoting ? 1 : 0.95 }}
            onClick={handleDislike}
            disabled={hasVoted || isVoting || !isConnected}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all relative ${
              hasVoted || isVoting || !isConnected
                ? 'glass opacity-50 cursor-not-allowed'
                : 'bg-red-500/80 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
            }`}
          >
            {isVoting ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ThumbsDown className="w-8 h-8 text-white" />
            )}
          </motion.button>

          {/* Previous Button */}
          {memes.length > 1 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goToPrevious}
              className="w-12 h-12 glass hover:bg-white/15 rounded-full flex items-center justify-center transition-all duration-200"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </motion.button>
          )}

          {/* Next Button */}
          {memes.length > 1 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goToNext}
              className="w-12 h-12 glass hover:bg-white/15 rounded-full flex items-center justify-center transition-all duration-200"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </motion.button>
          )}

          {/* Like Button */}
          <motion.button
            whileHover={{ scale: hasVoted || isVoting ? 1 : 1.05 }}
            whileTap={{ scale: hasVoted || isVoting ? 1 : 0.95 }}
            onClick={handleLike}
            disabled={hasVoted || isVoting || !isConnected}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all relative ${
              hasVoted || isVoting || !isConnected
                ? 'glass opacity-50 cursor-not-allowed'
                : 'bg-green-500/80 hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
            }`}
          >
            {isVoting ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ThumbsUp className="w-8 h-8 text-white" />
            )}
          </motion.button>
        </div>

        {/* Action Labels */}
        <div className="flex justify-center items-center gap-6 mt-3">
          <span className="text-red-400 text-sm font-medium w-16 text-center">
            Lame{!isConnected && " (Connect)"}
          </span>
          {memes.length > 1 && (
            <>
              <span className="text-gray-400 text-xs w-12 text-center">Prev</span>
              <span className="text-gray-400 text-xs w-12 text-center">Next</span>
            </>
          )}
          <span className="text-green-400 text-sm font-medium w-16 text-center">
            Funny{!isConnected && " (Connect)"}
          </span>
        </div>

        {/* Payment Info */}
        {isConnected && !hasVoted && isAuthenticated && (
          <div className="text-center mt-4">
            <p className="text-white/50 text-sm">
              ⚡ Each vote costs <span className="text-white font-medium">0.0001 ytest.usd</span> — instant & gasless!
            </p>
            <p className="text-white/30 text-xs mt-1">
              Win = earn from the losing side
            </p>
          </div>
        )}

        {/* Vote Status Messages */}
        {!isConnected && (
          <div className="text-center mt-4">
            <p className="text-yellow-400 text-sm">
              🔗 Connect your wallet to vote and earn rewards!
            </p>
          </div>
        )}

        {isConnected && !isAuthenticated && (
          <div className="text-center mt-4">
            <p className="text-yellow-400 text-sm">
              ⚡ Connecting to Yellow Network for instant votes...
            </p>
          </div>
        )}

        {hasVoted && (
          <div className="text-center mt-4">
            <p className="text-yellow-400 text-sm">
              ✓ You've voted! Check back after 6 hours for settlement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemeView;
