import { RefreshCcw } from "lucide-react";

interface ShareButtonsProps {
  handleReset: () => void;
  handleShare: () => void;
}

const ShareButtons: React.FC<ShareButtonsProps> = ({ 
  handleReset, 
  handleShare 
}) => {
  return (
    <div className="flex gap-4 w-full max-w-md mx-auto p-4">
      {/* Start Over Button */}
      <button
        onClick={handleReset}
        className="flex-1 group flex items-center justify-center gap-3 p-3 
                 bg-gray-800/50 rounded-xl hover:bg-gray-800 
                 transition-all duration-300 border border-gray-700/50 
                 hover:border-gray-600 backdrop-blur-sm"
        aria-label="Start Over"
      >
        <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
        <span className="text-sm font-medium">Start Over</span>
      </button>

      {/* Share on X Button */}
      <button
        onClick={handleShare}
        className="flex-1 group flex items-center justify-center gap-3 p-3 
                 bg-black/80 rounded-xl hover:bg-black 
                 transition-all duration-300 border border-gray-800 
                 hover:border-gray-700 backdrop-blur-sm"
        aria-label="Share on X (Twitter)"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 fill-current group-hover:scale-110 transition-transform duration-200"
          aria-hidden="true"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span className="text-sm font-medium">Share on X</span>
      </button>
    </div>
  );
};

export default ShareButtons;