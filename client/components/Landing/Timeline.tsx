import React from "react";
import { Timeline } from "@/components/ui/timeline";
import { motion } from "framer-motion";

export function TimelineDemo() {
  const data = [
    {
      title: "Q1 2025 - Genesis",
      content: (
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 hover:border-blue-500/50 transition-colors duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🚀</span>
              <h3 className="text-xl font-medium text-white">Platform Launch</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Template creation & monetization system
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Swipe-based meme voting mechanism
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Smart contract reward distribution
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Web3 wallet integration
              </div>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      title: "Q2 2025 - Evolution",
      content: (
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 hover:border-blue-500/50 transition-colors duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚡</span>
              <h3 className="text-xl font-medium text-white">Platform Growth</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Advanced template customization tools
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Creator analytics dashboard
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Community governance features
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Enhanced reward mechanisms
              </div>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      title: "Q3 2025 - Expansion",
      content: (
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 hover:border-blue-500/50 transition-colors duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🌟</span>
              <h3 className="text-xl font-medium text-white">Mobile & NFT Integration</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Native mobile apps launch
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                NFT minting for viral memes
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Cross-chain support
              </div>
              <div className="flex items-center gap-2 text-neutral-300 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Creator partnerships program
              </div>
            </div>
          </motion.div>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full bg-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-3xl font-bold text-white mb-4"
          >
            Roadmap
          </motion.h2>
        </div>
        <Timeline data={data} />
      </div>
    </div>
  );
}

export default TimelineDemo;