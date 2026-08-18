"use client";

import type { ReactNode } from "react";
import {
  WalletId,
  WalletManager,
  WalletProvider,
  type SupportedWallet,
} from "@txnlab/use-wallet-react";

const supportedWallets: SupportedWallet[] = [
  { id: WalletId.PERA },
  { id: WalletId.DEFLY },
  { id: WalletId.LUTE, options: { siteName: "x500" } },
];

const algodServer =
  process.env.NEXT_PUBLIC_ALGOD_SERVER?.trim() ||
  "https://testnet-api.algonode.cloud";
const algodPort = process.env.NEXT_PUBLIC_ALGOD_PORT?.trim() || "443";
const algodToken = process.env.NEXT_PUBLIC_ALGOD_TOKEN?.trim() || "";
const network =
  process.env.NEXT_PUBLIC_ALGORAND_NETWORK?.trim() || "testnet";

const walletManager = new WalletManager({
  wallets: supportedWallets,
  defaultNetwork: network,
  networks: {
    [network]: {
      algod: {
        baseServer: algodServer,
        port: algodPort,
        token: algodToken,
      },
      genesisId: network === "mainnet" ? "mainnet-v1.0" : "testnet-v1.0",
      isTestnet: network !== "mainnet",
    },
  },
  options: {
    resetNetwork: true,
  },
});

export function AppWalletProvider({ children }: { children: ReactNode }) {
  return <WalletProvider manager={walletManager}>{children}</WalletProvider>;
}
