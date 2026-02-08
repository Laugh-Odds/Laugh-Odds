import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MemeTemplate } from "./memes";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_ROUTE =
  process.env.NEXT_PUBLIC_PROD == "False" ? "http://localhost:5000" :"https://ViralForge.onrender.com";

// lib/api.ts
interface MemeData {
  address: string,
  cid: string;
  templateId: string
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export const createMeme = async (memeData: MemeData): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_ROUTE}/api/meme`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(memeData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to create meme");
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Error creating meme:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
};

export const getAllMemes = async ()  => {
  try {
    const response = await fetch(`${API_ROUTE}/api/memes`);

    const data: MemeTemplate[] = await response.json();
    
    if (!response.ok) {
      throw new Error("Failed to create meme");
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Error creating meme:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// Compress and resize image before upload with progress callback
const compressImage = async (
  file: File, 
  maxWidth: number = 1200, 
  quality: number = 0.85,
  onProgress?: (progress: number) => void
): Promise<File> => {
  return new Promise((resolve, reject) => {
    onProgress?.(10); // Starting compression
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(10 + (e.loaded / e.total) * 20); // 10-30%
      }
    };
    
    reader.onload = (event) => {
      onProgress?.(30); // File loaded
      
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        onProgress?.(50); // Image decoded
        
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // More aggressive resizing for faster uploads
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        onProgress?.(60); // Drawing to canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        onProgress?.(70); // Converting to blob
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            onProgress?.(90); // Blob created
            
            // Create compressed file
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
            console.log(`✅ Image compressed: ${(file.size / 1024).toFixed(2)}KB → ${(compressedFile.size / 1024).toFixed(2)}KB (${compressionRatio}% reduction)`);
            
            onProgress?.(100); // Complete
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
};

// Retry logic wrapper
const retryUpload = async <T>(
  uploadFn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> => {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📤 Upload attempt ${attempt}/${maxRetries}`);
      return await uploadFn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw lastError || new Error('Upload failed after retries');
};

// Upload to Pinata IPFS
const uploadToPinata = async (
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<string> => {
  const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;
  
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  // Optional: Add metadata
  const metadata = JSON.stringify({
    name: `meme-${Date.now()}.jpg`,
  });
  formData.append('pinataMetadata', metadata);
  
  const options = JSON.stringify({
    cidVersion: 1,
  });
  formData.append('pinataOptions', options);
  
  onProgress?.(50, 'Uploading to Pinata...');
  
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed: ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  return result.IpfsHash;
};

export const uploadImage = async (
  base64: string,
  onProgress?: (progress: number, message: string) => void
) => {
  const startTime = Date.now();
  console.log('🔄 Starting image upload with Pinata...');
  onProgress?.(0, 'Starting upload...');
  
  onProgress?.(5, 'Preparing image...');
  
  // Convert base64 to File object
  const mimeType = base64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
  const file = base64ToFile(base64, 'meme-template.jpg', mimeType);
  
  console.log(`📦 Original file size: ${(file.size / 1024).toFixed(2)}KB`);
  
  onProgress?.(10, 'Compressing image...');
  
  // Compress the image before uploading
  const compressedFile = await compressImage(file, 800, 0.8, (compressionProgress) => {
    onProgress?.(10 + compressionProgress * 0.3, 'Compressing...'); // 10-40%
  });
  
  console.log(`📦 Compressed file size: ${(compressedFile.size / 1024).toFixed(2)}KB`);
  console.log(`⏱️ Compression took: ${Date.now() - startTime}ms`);
  
  onProgress?.(40, 'Uploading to IPFS...');
  
  const uploadStart = Date.now();
  
  try {
    // Upload with retries (Pinata is usually fast, so shorter timeout)
    const result = await retryUpload(async () => {
      const uploadPromise = uploadToPinata(compressedFile, onProgress);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout after 30s')), 30000)
      );
      
      return await Promise.race([uploadPromise, timeoutPromise]);
    }, 3); // 3 retries
    
    onProgress?.(100, 'Upload complete!');
    
    console.log(`✅ Upload complete! Took: ${Date.now() - uploadStart}ms`);
    console.log(`📍 CID: ${result}`);
    console.log(`⏱️ Total time: ${Date.now() - startTime}ms`);

    return result;
  } catch (error) {
    console.error('❌ Pinata upload failed:', error);
    onProgress?.(-1, 'Upload failed');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Upload failed: ${errorMessage}. Please check your internet connection.`);
  }
}

// Check if user has voted (local storage based)
export const hasUserVoted = async (userAddress: string, marketId: number): Promise<boolean> => {
  try {
    const voteKey = `user_vote_${userAddress}_${marketId}`;
    const localVote = localStorage.getItem(voteKey);
    return localVote !== null;
  } catch (error) {
    console.warn("Could not check voting status:", error);
    return false;
  }
};

// Utility function to clear all voting data for debugging
export const clearAllVotingData = (userAddress?: string) => {
  const keys = Object.keys(localStorage);
  const voteKeys = keys.filter(key => 
    key.includes('user_vote_') || 
    key.includes('voted_meme_') || 
    key.includes('vote_tx_')
  );
  
  if (userAddress) {
    // Clear only for specific user
    const userKeys = voteKeys.filter(key => key.includes(userAddress));
    userKeys.forEach(key => {
      console.log(`🗑️ Clearing: ${key}`);
      localStorage.removeItem(key);
    });
    console.log(`✅ Cleared ${userKeys.length} vote records for user ${userAddress}`);
  } else {
    // Clear all voting data
    voteKeys.forEach(key => {
      console.log(`🗑️ Clearing: ${key}`);
      localStorage.removeItem(key);
    });
    console.log(`✅ Cleared ${voteKeys.length} total vote records`);
  }
};

// Record vote on server (voting payment is now handled via Yellow Network state channels)
export const recordVoteOnServer = async (
  userAddress: string,
  marketId: number,
  vote: 'funny' | 'lame',
  transferId?: string,
  memeCid?: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_ROUTE}/api/user-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
        marketId,
        vote,
        transferId,
        memeCid,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to record vote');
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error recording vote on server:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// **NEW: Function to get user's voting history**
export const getUserVotingHistory = async (userAddress: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_ROUTE}/api/user-votes/${userAddress}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch voting history');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error fetching voting history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// **NEW: Function to get user's settlement history**
export const getUserSettlements = async (userAddress: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_ROUTE}/api/user-settlements/${userAddress}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch settlement history');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error fetching settlement history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// **NEW: Function to get settlement status for a market**
export const getSettlementStatus = async (marketId: number): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_ROUTE}/api/settlement-status/${marketId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch settlement status');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error fetching settlement status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// **NEW: Function to manually trigger settlement (admin)**
export const manualSettle = async (marketId: number): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_ROUTE}/api/manual-settle/${marketId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to trigger settlement');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error triggering settlement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const giveGas = async (address: string) => {
  try {
    const response = await fetch(`${API_ROUTE}/api/faucet/${address}`);
    const res = await response.json();
    
    if (!response.ok) {
      console.warn(`Faucet request failed: ${res.message}`);
      // Don't throw error, just log warning since this is optional
      return { success: false, message: res.message };
    }
    
    console.log("Faucet response:", res);
    return { success: true, data: res };
  } catch (error) {
    console.warn("Faucet request failed:", error);
    // Don't throw error, just log warning
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

// Type definitions
type MimeType = string;
type Base64String = string;
type FileName = string;

interface FileReaderProgressEvent extends ProgressEvent {
  readonly target: (FileReader & EventTarget) | null;
}

// Convert base64 to Blob
const base64ToBlob = (
  base64String: Base64String, 
  mimeType: MimeType = 'application/octet-stream'
): Blob => {
  // Remove data URL prefix if present
  const base64WithoutPrefix = base64String.replace(/^data:.*,/, '');
  
  // Convert base64 to byte array
  const byteCharacters = atob(base64WithoutPrefix);
  const byteArrays: BlobPart[] = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray as BlobPart);
  }
  
  return new Blob(byteArrays, { type: mimeType });
};

// Convert base64 to File
const base64ToFile = (
  base64String: Base64String, 
  fileName: FileName, 
  mimeType: MimeType = 'application/octet-stream'
): File => {
  const blob = base64ToBlob(base64String, mimeType);
  return new File([blob], fileName, { type: mimeType });
};

// Download base64 as file
const downloadBase64File = (
  base64String: Base64String, 
  fileName: FileName, 
  mimeType: MimeType = 'application/octet-stream'
): void => {
  const blob = base64ToBlob(base64String, mimeType);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  
  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  window.URL.revokeObjectURL(url);
};

// Error handling with types
interface Base64Error extends Error {
  code: string;
  details?: unknown;
}

// Helper function to create typed errors
const createBase64Error = (
  message: string, 
  code: string, 
  details?: unknown
): Base64Error => {
  const error: Base64Error = new Error(message) as Base64Error;
  error.code = code;
  if (details) error.details = details;
  return error;
};

// Safe base64 conversion with error handling
export const safeBase64ToFile = (
  base64String: Base64String, 
  fileName: FileName, 
  mimeType: MimeType = 'application/octet-stream'
): Promise<File> => {
  return new Promise((resolve, reject) => {
    try {
      if (!base64String) {
        throw createBase64Error(
          'Base64 string is required', 
          'INVALID_INPUT'
        );
      }
      
      const file = base64ToFile(base64String, fileName, mimeType);
      resolve(file);
    } catch (error) {
      reject(createBase64Error(
        'Failed to convert base64 to file',
        'CONVERSION_ERROR',
        error
      ));
    }
  });
};

// BONUS: Helper function to check if user has sufficient balance
export const checkUserBalance = async (
  userAddress: string,
  requiredAmount: string = "0.0001"
): Promise<{ hasEnough: boolean; balance: string; required: string }> => {
  try {
    // You can implement balance checking logic here
    // This is a placeholder that you can enhance based on your needs
    return {
      hasEnough: true, // Placeholder
      balance: "0", // Placeholder
      required: requiredAmount
    };
  } catch (error) {
    console.error("Error checking balance:", error);
    return {
      hasEnough: false,
      balance: "0",
      required: requiredAmount
    };
  }
};

// Helper to format transaction errors for user display
export const formatTransactionError = (error: string): string => {
  const errorMap: Record<string, string> = {
    'Not authenticated': 'Not connected to Yellow Network',
    'Transfer timeout': 'Yellow Network transfer timed out',
    'insufficient': 'Not enough ytest.usd in Yellow Network channel',
    'network': 'Network connection problem',
  };

  for (const [key, message] of Object.entries(errorMap)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }

  return 'Vote failed. Please try again.';
};