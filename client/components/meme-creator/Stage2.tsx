import React, { useEffect, useState } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { TextBox } from "./types";
import { DraggableText } from "./DraggableText";
import { TextControl } from "./TextControl";
import { generateMemeCanvas } from "./helper";
import { createMeme, uploadImage } from "@/lib/utils";
import { useAccount } from "wagmi";

interface Stage2Props {
  capturedImage: string | null;
  textBoxes: TextBox[];
  setTextBoxes: React.Dispatch<React.SetStateAction<TextBox[]>>;
  imageContainerRef: React.RefObject<HTMLDivElement>;
  setFinalMeme: (meme: string | null) => void;
  setStage: (stage: number) => void;
  setIsLoading: (loading: boolean) => void;
  setLoadingMessage: (message: string) => void;
  memeTemplate: number;
}

const Stage2: React.FC<Stage2Props> = ({
  capturedImage,
  textBoxes,
  setTextBoxes,
  imageContainerRef,
  setFinalMeme,
  setStage,
  setIsLoading,
  setLoadingMessage,
  memeTemplate,
}) => {
  const [isClient, setIsClient] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const account = useAccount();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Keyboard navigation for text boxes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textBoxes.length === 0) return;
      
      if (e.key === 'ArrowLeft' && currentTextIndex > 0) {
        e.preventDefault();
        setCurrentTextIndex(currentTextIndex - 1);
      } else if (e.key === 'ArrowRight' && currentTextIndex < textBoxes.length - 1) {
        e.preventDefault();
        setCurrentTextIndex(currentTextIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTextIndex, textBoxes.length]);

  const addTextBox = () => {
    const newBox: TextBox = {
      id: `text-${Date.now()}`,
      text: "Add text here",
      position: { x: 50, y: 50 },
      fontSize: 24,
      color: "#FFFFFF",
    };
    setTextBoxes((prev) => {
      const newTextBoxes = [...prev, newBox];
      // Navigate to the newly added text box
      setCurrentTextIndex(newTextBoxes.length - 1);
      return newTextBoxes;
    });
  };

  const generateMeme = async () => {
    if (!imageContainerRef.current || !capturedImage || !isClient) return;

    setIsLoading(true);
    setLoadingMessage("Generating your meme...");

    try {
      const container = imageContainerRef.current;
      const { width, height } = container.getBoundingClientRect();

      const memeDataUrl = await generateMemeCanvas(
        capturedImage,
        textBoxes,
        width,
        height
      );

      try {
        const cid = await uploadImage(memeDataUrl.replace(/^data:image\/\w+;base64,/, ""));

        await createMeme({
          address: account.address as string,
          cid: cid,
          templateId: memeTemplate.toString()
        });

      } catch (error) {
        console.error("Error uploading to IPFS:", error);
      }

      setFinalMeme(memeDataUrl);
      setStage(3);
    } catch (error) {
      console.error("Error generating meme:", error);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  if (!isClient) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="flex flex-col items-center w-full h-screen">
      <div className="relative w-full h-[55vh] glass rounded-xl overflow-hidden mb-4">
        {capturedImage && (
          <div
  ref={imageContainerRef}
  className="relative w-full h-[55vh] rounded-xl overflow-hidden mb-4 image-container"
  style={{ touchAction: 'pan-y' }} // Allow vertical scrolling but prevent horizontal pan
>
  <img
    src={capturedImage}
    alt="Template"
    className="w-full h-full object-contain pointer-events-none" // Prevent image interference
  />
</div>
        )}
        {textBoxes.map((box) => (
          <DraggableText
            key={box.id}
            box={box}
            onMove={(id, newPosition) => {
              setTextBoxes((prev) =>
                prev.map((b) =>
                  b.id === id ? { ...b, position: newPosition } : b
                )
              );
            }}
          />
        ))}
      </div>
      <div className="w-full space-y-4 flex-1 flex flex-col">
        <div className="flex sm:flex-row w-full gap-4 px-4 items-center justify-center">
          <button
            onClick={addTextBox}
            className="w-3/12 sm:w-auto px-6 py-4 glass hover:bg-white/10 rounded-xl
                     transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={generateMeme}
            className="w-9/12 sm:w-auto px-6 py-4 bg-blue-500 hover:bg-blue-400 rounded-xl
                     transition-all duration-200 flex items-center justify-center gap-2 glow-blue"
          >
            Generate Meme
          </button>
        </div>

        {textBoxes.length > 0 && (
          <div className="px-4">
            {/* Text Slider Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-white/50">
                  Text Box {currentTextIndex + 1} of {textBoxes.length}
                </span>
                <span className="text-xs text-white/30">
                  Use ← → arrow keys or buttons to navigate
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentTextIndex(Math.max(0, currentTextIndex - 1))}
                  disabled={currentTextIndex === 0}
                  className="p-2 glass hover:bg-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentTextIndex(Math.min(textBoxes.length - 1, currentTextIndex + 1))}
                  disabled={currentTextIndex === textBoxes.length - 1}
                  className="p-2 glass hover:bg-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Slider Dots */}
            <div className="flex justify-center gap-2 mb-4">
              {textBoxes.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTextIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    index === currentTextIndex ? 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Scrollable Text Controls Container */}
            <div className="max-h-[35vh] min-h-[200px] overflow-y-auto overflow-x-hidden
                          custom-scrollbar transition-all duration-200
                          glass rounded-xl p-4">
              {/* Current Text Control */}
              <div className="transition-all duration-300 ease-in-out">
                {textBoxes[currentTextIndex] && (
                  <TextControl
                    key={textBoxes[currentTextIndex].id}
                    box={textBoxes[currentTextIndex]}
                    onTextChange={(id, newText) => {
                      setTextBoxes((prev) =>
                        prev.map((b) => (b.id === id ? { ...b, text: newText } : b))
                      );
                    }}
                    onRemove={(id) => {
                      const newTextBoxes = textBoxes.filter((b) => b.id !== id);
                      setTextBoxes(newTextBoxes);
                      // Adjust current index if needed
                      if (currentTextIndex >= newTextBoxes.length && newTextBoxes.length > 0) {
                        setCurrentTextIndex(newTextBoxes.length - 1);
                      } else if (newTextBoxes.length === 0) {
                        setCurrentTextIndex(0);
                      }
                    }}
                    onFontSizeChange={(id, increase) => {
                      setTextBoxes((prev) =>
                        prev.map((b) =>
                          b.id === id
                            ? {
                                ...b,
                                fontSize: Math.max(
                                  12,
                                  b.fontSize + (increase ? 2 : -2)
                                ),
                              }
                            : b
                        )
                      );
                    }}
                    onColorChange={(id, color) => {
                      setTextBoxes((prev) =>
                        prev.map((b) => (b.id === id ? { ...b, color } : b))
                      );
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stage2;