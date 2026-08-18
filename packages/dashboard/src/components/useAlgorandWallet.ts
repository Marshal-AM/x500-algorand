"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import type { WalletSession } from "@/lib/algorand-wallet";
import { appToast } from "@/lib/toast";

function walletAddress(
  wallet: { activeAccount: { address: string } | null },
  accounts?: Array<{ address: string }>,
): string | null {
  return accounts?.[0]?.address ?? wallet.activeAccount?.address ?? null;
}

export function useAlgorandWallet() {
  const { activeAddress, wallets, isReady, transactionSigner } = useWallet();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session: WalletSession | null = activeAddress
    ? { address: activeAddress }
    : null;

  const connect = useCallback(
    async (walletId: string) => {
      const wallet = wallets?.find((item) => item.id === walletId);
      if (!wallet) {
        const message = "That wallet is not available in this browser.";
        setError(message);
        appToast.error("Wallet unavailable", message);
        return;
      }

      setConnectingId(wallet.id);
      setError(null);
      try {
        const active = wallets.find((item) => item.isActive && item.isConnected);
        if (active && active.id !== wallet.id) {
          await active.disconnect();
        }
        const accounts = await wallet.connect();
        const address = walletAddress(wallet, accounts);
        appToast.success("Wallet connected", address ?? undefined);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        appToast.error("Could not connect wallet", message);
      } finally {
        setConnectingId(null);
      }
    },
    [wallets],
  );

  const disconnect = useCallback(async () => {
    const active = wallets?.find((item) => item.isActive && item.isConnected);
    if (!active) return;
    try {
      await active.disconnect();
      appToast.success("Wallet disconnected");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appToast.error("Could not disconnect wallet", message);
    }
  }, [wallets]);

  return {
    session,
    wallets: wallets ?? [],
    connect,
    disconnect,
    connecting: connectingId != null,
    connectingId,
    error,
    ready: isReady,
    transactionSigner,
  };
}
