"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { useReadContract, useReadContracts } from 'wagmi';
import { Address, Abi } from 'viem';
import { CONTRACT_ABI, DEPLOYED_CONTRACT } from "@/lib/ethers";
import type { Meme } from "@/types/contract";

interface MemeWithImage extends Meme {
  image?: string;
}

const MemeGallery = () => {
  const [memes, setMemes] = useState<MemeWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Get market count with proper typing
  const { data: marketCount } = useReadContract({
    address: DEPLOYED_CONTRACT,
    abi: CONTRACT_ABI,
    functionName: "marketCount",
    args: [],
  }) as { data: bigint | undefined };

  // Create contracts array for fetching all markets
  const marketContracts = new Array(Number(marketCount) || 0).fill(0).map(
    (_, index) => ({
      address: DEPLOYED_CONTRACT as Address,
      abi: CONTRACT_ABI as Abi,
      functionName: "getMarketMemes",
      args: [BigInt(index)],
    } as const)
  );

  // Fetch all market memes with proper typing
  const { data: allMarketMemes } = useReadContracts({
    contracts: marketContracts as readonly unknown[],
  }) as { data: Array<{ result: Meme[] }> | undefined };

  useEffect(() => {
    const populateMemes = async () => {
      setLoading(true);
      try {
        if (!allMarketMemes) return;

        // Flatten all memes from all markets into a single array
        const allMemes = allMarketMemes.flatMap(market => 
          (market.result as Meme[]) || []
        ).filter(Boolean);

        // Fetch images for all memes
        const memesWithImages = await Promise.all(
          allMemes.map(async (meme) => {
            try {
              // Pinata returns actual image files, use the URL directly
              const imageUrl = `https://gateway.pinata.cloud/ipfs/${meme.cid}`;
              return {
                ...meme,
                image: imageUrl
              } as MemeWithImage;
            } catch (error) {
              console.error(`Error fetching meme ${meme.cid}:`, error);
              return meme as MemeWithImage;
            }
          })
        );

        setMemes(memesWithImages);
      } catch (error) {
        console.error("Error loading memes:", error);
      } finally {
        setLoading(false);
      }
    };

    populateMemes();
  }, [allMarketMemes]);

  const handleMemeClick = (meme: MemeWithImage) => {
    router.push(`/app/memes/templates/${meme.memeTemplate}`);
  };

  return (
    <div className="min-h-screen text-white">
      <main className="max-w-7xl mx-auto px-2 py-4">
        {memes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-white/50">
            <p className="text-xl font-medium">No memes found</p>
            <p className="mt-2">Be the first to create a meme template!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 sm:gap-2">
            {memes.map((meme, index) => (
              <motion.div
                key={`${meme.memeTemplate}-${index}`}
                layoutId={`meme-${meme.memeTemplate}-${index}`}
                onClick={() => handleMemeClick(meme)}
                className="relative group cursor-pointer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative aspect-square glass rounded-lg overflow-hidden">
                  <img
                    src={meme.image}
                    alt={`Meme ${index}`}
                    className="w-full h-full object-contain rounded-xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <Link
        href="/app/memes/create"
        className="fixed bottom-6 right-6 p-4 bg-blue-500 rounded-full shadow-lg hover:bg-blue-400 glow-blue transition-all duration-300 md:hidden"
      >
        <ImagePlus className="w-6 h-6" />
      </Link>
    </div>
  );
};

export default MemeGallery;