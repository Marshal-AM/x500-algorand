"use client";

import type { ReactNode } from "react";
import {
  WalletId,
  WalletManager,
  WalletProvider,
  type SupportedWallet,
} from "@txnlab/use-wallet-react";

const supportedWallets: SupportedWallet[] = [
  { id: WalletId.DEFLY },
  { id: WalletId.PERA },
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
    },
  },
  options: {
    resetNetwork: true,
  },
});

export function AppWalletProvider({ children }: { children: ReactNode }) {
  return <WalletProvider manager={walletManager}>{children}</WalletProvider>;
}
