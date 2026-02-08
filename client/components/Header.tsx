"use client";

import React, { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { LogOut, Plus, Wallet } from "lucide-react";
import { giveGas } from "@/lib/utils";

// MobileNav component remains largely the same
const MobileNav: React.FC<{
  isOpen: boolean;
}> = ({ isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 glass-strong z-40">
      <div className="p-4 flex justify-between items-center border-b border-white/10">
        <h1
          className="text-2xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent cursor-pointer"
          onClick={() => window.location.href = '/'}
        >
          ViralForge
        </h1>
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const addChain = async () => {
    if (window.ethereum)
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaa36a7", // Sepolia chain ID
            chainName: "Sepolia",
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://1rpc.io/sepolia"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    switchChain({ chainId: 11155111 }); // Sepolia chain ID
  };

  useEffect(() => {
    if (address) giveGas(address as string);
  }, [isConnected, address]);



  const truncatedAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  return (
    <header className="glass-strong text-foreground p-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo and Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-8">
          <h1
            className="text-2xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent cursor-pointer"
            onClick={() => window.location.href = '/'}
          >
            ViralForge
          </h1>
        </div>

        {/* Mobile Logo (centered) */}
        <h1
          className="text-2xl font-bold lg:hidden bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent cursor-pointer"
          onClick={() => window.location.href = '/'}
        >
          ViralForge
        </h1>

        {/* Wallet Controls */}
        <div className="flex items-center gap-2 sm:gap-4 justify-center">
          {isConnected ? (
            <>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="glass hover:bg-white/10 px-2 sm:px-4 py-2 rounded-lg flex items-center gap-1 sm:gap-2 transition-all duration-200 text-sm sm:text-base"
                >
                  <span>{truncatedAddress}</span>
                  <LogOut className="w-4 h-4" />
                </button>

                <button onClick={addChain} className="glass hover:bg-white/10 p-2 rounded-lg transition-all duration-200">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="glass hover:bg-white/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <MobileNav
        isOpen={isMobileMenuOpen}
      />
    </header>
  );
};

export default Header;
