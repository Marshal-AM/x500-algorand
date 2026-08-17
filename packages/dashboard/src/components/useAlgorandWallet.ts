"use client";

import { useCallback, useState } from "react";
import { useWallet, WalletId } from "@txnlab/use-wallet-react";
import type { WalletSession } from "@/lib/algorand-wallet";
import { appToast } from "@/lib/toast";

export function useAlgorandWallet() {
  const { activeAddress, wallets, isReady, transactionSigner } = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session: WalletSession | null = activeAddress
    ? { address: activeAddress }
    : null;

  const connect = useCallback(async () => {
    if (!wallets?.length) {
      const message = "Install Pera or Defly wallet extension.";
      setError(message);
      appToast.error("No wallets available", message);
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const preferred =
        wallets.find((w) => w.id === WalletId.DEFLY) ??
        wallets.find((w) => w.id === WalletId.PERA) ??
        wallets[0];
      await preferred.connect();
      const address = preferred.activeAccount?.address ?? activeAddress;
      if (!address) {
        throw new Error("No Algorand address returned from wallet");
      }
      appToast.success("Wallet connected", address);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      appToast.error("Could not connect wallet", message);
    } finally {
      setConnecting(false);
    }
  }, [activeAddress, wallets]);

  return {
    session,
    connect,
    connecting,
    error,
    ready: isReady,
    transactionSigner,
  };
}
