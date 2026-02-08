/* eslint-disable */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { CONTRACT_ABI, DEPLOYED_CONTRACT } from "@/lib/ethers";
import { uploadImage } from "@/lib/utils";
import { Abi, Address } from "viem";

interface Stage1Props {
  setCapturedImage: (image: string | null) => void;
  capturedImage: string | null;
  setStage: (stage: number) => void;
  setIsLoading: (loading: boolean) => void;
  setLoadingMessage: (message: string) => void;
  setmemeTemplate: (state: number) => void;
}

const Stage1: React.FC<Stage1Props> = ({
  setCapturedImage,
  capturedImage,
  setStage,
  setIsLoading,
  setLoadingMessage,
  setmemeTemplate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);
  const [isUploadingToIpfs, setIsUploadingToIpfs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [templates, setTemplates] = useState<
    [string, bigint, bigint, bigint, bigint, boolean, string, string][]
  >([]);

  const { data: hash, writeContract, error } = useWriteContract();
  const { isLoading: isConfirmingMarket, status: MarketCreationStatus } =
    useWaitForTransactionReceipt({
      hash,
    });

  const { data: marketCount } = useReadContract({
    address: DEPLOYED_CONTRACT,
    abi: CONTRACT_ABI,
    functionName: "marketCount",
    args: [],
  });

  const contracts = new Array(Number(marketCount) || 0).fill(0).map(
    (_, index) =>
      ({
        address: DEPLOYED_CONTRACT as Address,
        abi: CONTRACT_ABI as Abi,
        functionName: "getMarket",
        args: [BigInt(index)],
      } as const)
  );

  const { data: MemeTemplates } = useReadContracts({
    contracts: contracts as readonly unknown[],
  });

  useEffect(() => {
    const populateTemplates = async () => {
      const temps = [];
      if (!MemeTemplates) return;

      for (const temp of MemeTemplates) {
        // Type assertion for the result: [creator, endTime, isActive, metadata, memes]
        const result = temp.result as [
          string,
          bigint,
          boolean,
          string,
          unknown[]
        ];
        
        // Pinata returns actual image files, not base64 text
        // So we just use the IPFS gateway URL directly
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${result[3]}`;

        // Store image URL in a new array entry for display
        const resultWithImage: any = [...result, imageUrl];

        temps.push(resultWithImage);
      }

      setTemplates(temps);
    };

    populateTemplates();
  }, [MemeTemplates]);

  // Monitor transaction hash
  useEffect(() => {
    if (hash) {
      console.log("Transaction hash received:", hash);
      setLoadingMessage("Transaction submitted, waiting for confirmation...");
    }
  }, [hash, setLoadingMessage]);

  // Monitor confirmation status
  useEffect(() => {
    if (isConfirmingMarket) {
      setStage(2);
      setIsLoading(false);
      setLoadingMessage("");
      setSelectedImage(null);
      // Pass both base64 and IPFS URL to the next stage
      setCapturedImage(
        base64Image || (ipfsCid ? `https://ipfs.io/ipfs/${ipfsCid}` : null)
      );
      setLoadingMessage("Transaction is being confirmed...");

      setmemeTemplate(Number(marketCount));
    }
  }, [
    isConfirmingMarket,
    MarketCreationStatus,
    setStage,
    setIsLoading,
    setLoadingMessage,
    setCapturedImage,
    ipfsCid,
    base64Image,
  ]);

  const generateTemplate = async () => {
    console.log("Generate template started");
    setIsLoading(true);
    setLoadingMessage("Preparing transaction...");

    // Wait for IPFS upload if it's still in progress
    if (isUploadingToIpfs) {
      setLoadingMessage("Waiting for IPFS upload to complete...");
      return;
    }

    if (!ipfsCid) {
      console.log("No IPFS CID found");
      setIsLoading(false);
      setLoadingMessage("");
      return;
    }

    try {
      writeContract({
        address: DEPLOYED_CONTRACT,
        abi: CONTRACT_ABI,
        functionName: "createMarket",
        args: [ipfsCid],
      });

      console.log("Write contract call completed");
    } catch (error) {
      console.error("Error creating market:", error);
      setIsLoading(false);
      setLoadingMessage("Transaction failed. Please try again.");
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (warn if > 5MB)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) {
      console.warn(`Large file detected: ${fileSizeMB.toFixed(2)}MB - compressing...`);
    }

    setIsLoading(true);
    setLoadingMessage("Processing your photo...");

    try {
      // Convert the file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setBase64Image(base64String);
        setSelectedImage(base64String);
        setIsLoading(false); // Hide loading overlay so user can see preview
        setLoadingMessage("");
        setIsUploadingToIpfs(true);

        try {
          setLoadingMessage("Compressing and uploading to IPFS...");
          const res = await uploadImage(base64String, (progress, message) => {
            setUploadProgress(progress);
            setUploadStatus(message);
            if (progress >= 0) {
              setLoadingMessage(`${message} (${Math.round(progress)}%)`);
            }
          });

          // Store the CID
          setIpfsCid(res);
          setIsUploadingToIpfs(false);
          setLoadingMessage("");
          setUploadProgress(100);
          setUploadStatus("Complete!");
          console.log("✅ Image uploaded successfully. CID:", res);
        } catch (error) {
          console.error("Error uploading to IPFS:", error);
          setIsUploadingToIpfs(false);
          setLoadingMessage("");
          setUploadProgress(0);
          setUploadStatus("Failed");
          alert("Failed to upload image. Please try again or try a smaller image.");
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing file:", error);
      setIsUploadingToIpfs(false);
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleTemplateSelection = (
    template: [string, bigint, bigint, bigint, bigint, boolean, string, string],
    index: number
  ) => {
    // For templates, we'll use the template URL directly
    setSelectedImage(null);
    setBase64Image(null);

    setIpfsCid(String(template[3])); // Convert to string

    setStage(2);
    setIsLoading(false);
    setLoadingMessage("");
    setSelectedImage(null);
    // Pass both base64 and IPFS URL to the next stage
    setCapturedImage(String(template[5])); // Convert to string

    setLoadingMessage("Template is being selected...");

    setmemeTemplate(index);
  };

  // Monitor contract errors
  useEffect(() => {
    if (error) {
      console.error("Contract error detected:", error);
      setLoadingMessage("Transaction failed. Please try again.");
      setIsLoading(false);
    }
  }, [error, setLoadingMessage, setIsLoading]);

  // Disable template selection during IPFS upload
  const isDisabled = isConfirmingMarket || isUploadingToIpfs;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-6">Choose a Template</h2>

        {/* Grid Container */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {/* Upload Photo Tile */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative aspect-square glass rounded-xl overflow-hidden cursor-pointer group border-2 border-dashed border-white/20 hover:border-white/40 transition-all duration-300"
            onClick={() => !isDisabled && fileInputRef.current?.click()}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Camera className="w-8 h-8 mb-2 text-white/70" />
              <span className="text-sm font-medium text-white/70">Upload Photo</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isDisabled}
            />
          </motion.div>

          {/* Existing Templates */}
          {templates &&
            templates.map((template, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative aspect-square glass rounded-xl overflow-hidden cursor-pointer group"
                onClick={() =>
                  !isDisabled && handleTemplateSelection(template, index)
                }
              >
                <img
                  src={String(template[5])}
                  alt={"Meme template"}
                  className="w-full h-full object-cover"
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <div className="glass px-4 py-2 rounded-full text-sm font-medium text-white">
                    Use Template
                  </div>
                </div>
              </motion.div>
            ))}
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-strong rounded-2xl max-w-2xl w-full p-4">
            <div className="relative w-full aspect-square glass rounded-xl overflow-hidden mb-4">
              <img
                src={selectedImage}
                alt="Selected Template"
                className="w-full h-full object-contain"
              />

              {/* Upload Status Overlay */}
              {isUploadingToIpfs && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="glass rounded-xl px-6 py-4 flex flex-col items-center gap-3 min-w-[250px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div>
                    <p className="text-sm text-white/70 text-center">{uploadStatus || 'Processing...'}</p>

                    {/* Progress Bar */}
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-400 h-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(0, Math.min(100, uploadProgress))}%` }}
                      ></div>
                    </div>

                    <p className="text-xs text-white/40">{Math.round(uploadProgress)}%</p>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Status Message */}
            {isUploadingToIpfs && (
              <div className="mb-4 p-3 glass border border-blue-500/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-300">
                    📤 {uploadStatus || 'Processing...'}
                  </p>
                  <span className="text-xs text-blue-400 font-mono">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="mt-2 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-400 h-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, uploadProgress))}%` }}
                  ></div>
                </div>
              </div>
            )}

            {ipfsCid && !isUploadingToIpfs && (
              <div className="mb-4 p-3 glass border border-green-500/20 rounded-xl">
                <p className="text-sm text-green-300">
                  ✅ Image uploaded successfully!
                </p>
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setBase64Image(null);
                  setIpfsCid(null);
                  setUploadProgress(0);
                  setUploadStatus('');
                  setIsUploadingToIpfs(false);
                }}
                className="px-6 py-3 glass hover:bg-white/10 rounded-xl
                           transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDisabled}
              >
                Cancel
              </button>
              <button
                onClick={generateTemplate}
                className="px-6 py-3 bg-primary hover:bg-primary/90 rounded-xl
                           transition-all flex items-center gap-2 text-black
                           disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDisabled}
              >
                {isUploadingToIpfs ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    Uploading...
                  </>
                ) : (
                  "Use Template"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stage1;
