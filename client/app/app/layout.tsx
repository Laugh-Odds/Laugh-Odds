"use client";

import dynamic from "next/dynamic";
import { ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import BottomHeader from "@/components/BottomHeader";

const Header = dynamic(() => import("@/components/Header"), { ssr: false });

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main>{children}</main>
      <BottomHeader />
    </div>
  );
}