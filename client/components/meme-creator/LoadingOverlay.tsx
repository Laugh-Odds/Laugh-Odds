import { Loader } from "lucide-react";

interface LoadingOverlayProps {
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-4 w-full max-w-sm">
      <Loader className="w-8 h-8 animate-spin" />
      <p className="text-white text-center">{message}</p>
    </div>
  </div>
);
