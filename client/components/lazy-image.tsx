"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { downloadBlob } from "@/lib/walrus-helper";
import { downloadAndDisplayFile } from "@/lib/akave-helper";

const LazyBlobImage = ({
  cid,
  type,
  className = "",
}: {
  cid: string;
  type: "akave" | "wolrus";
  className?: string;
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(null);

        if (type === "wolrus") {
          const blob = await downloadBlob(cid);
          console.log(blob);
          console.log(URL.createObjectURL(blob));

          setImageUrl(URL.createObjectURL(blob));
        } else {
          const url = await downloadAndDisplayFile("test", cid);
          setImageUrl(url);
        }
      } catch (err: any) {
        setError(err?.message ?? "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchImage();

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [cid, type]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-24 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <img
      src={imageUrl!}
      alt={`Content for ${cid}`}
      className={`max-w-full h-auto object-contain ${className}`}
    />
  );
};

export default LazyBlobImage;
