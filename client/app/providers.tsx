"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/config/wagmiConfig";
import { YellowNetworkProvider } from "@/context/YellowNetworkContext";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <YellowNetworkProvider>
          {children}
        </YellowNetworkProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
