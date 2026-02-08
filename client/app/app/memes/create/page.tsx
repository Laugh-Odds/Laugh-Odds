"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Stage1 from "@/components/meme-creator/Stage1";
import Stage2 from "@/components/meme-creator/Stage2";
import Stage3 from "@/components/meme-creator/Stage3";
import { LoadingOverlay } from "@/components/meme-creator/LoadingOverlay";
import type { TextBox } from "@/components/meme-creator/types";

const MemeCreator: React.FC = () => {
  const [stage, setStage] = useState(1);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [finalMeme, setFinalMeme] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [memeTemplate, setmemeTemplate] = useState(0);

  const RenderCurrentStage = () => {
    switch (stage) {
      case 1:
        return (
          <Stage1
            setCapturedImage={setCapturedImage}
            capturedImage={capturedImage}
            setStage={setStage}
            setIsLoading={setIsLoading}
            setLoadingMessage={setLoadingMessage}
            setmemeTemplate={setmemeTemplate}
          />
        );
      case 2: {
        if (!capturedImage) {
          useEffect(() => {
            setStage(1);
          }, []);
          return null;
        }
        return (
          <Stage2
            capturedImage={capturedImage}
            textBoxes={textBoxes}
            setTextBoxes={setTextBoxes}
            imageContainerRef={imageContainerRef}
            setFinalMeme={setFinalMeme}
            setStage={setStage}
            setIsLoading={setIsLoading}
            setLoadingMessage={setLoadingMessage}
            memeTemplate={memeTemplate}
          />
        );
      }
      case 3:
        return (
          <Stage3
            finalMeme={finalMeme}
            setStage={setStage}
            setFinalMeme={setFinalMeme}
            shareText="Check out this meme I created with Laugh Odds! 🎨"
          />
        );
      default:
        return null;
    }
  };

  // Effect to handle stage transitions
  useEffect(() => {
    if (stage === 2 && !capturedImage) {
      setStage(1);
    }
  }, [stage, capturedImage]);

  return (
    <div className="min-h-screen text-white p-4">
      <AnimatePresence>
        {isLoading && <LoadingOverlay message={loadingMessage} />}
      </AnimatePresence>
      <div className="w-full max-w-2xl mx-auto">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === stage
                  ? 'w-8 bg-white glow-blue'
                  : s < stage
                  ? 'w-4 bg-white/60'
                  : 'w-4 bg-white/20'
              }`}
            />
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          {RenderCurrentStage()}
        </motion.div>
      </div>
    </div>
  );
};

export default MemeCreator;