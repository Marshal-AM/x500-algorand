import type { Account, Application, uint64 } from "@algorandfoundation/algorand-typescript";
import {
  abimethod,
  assert,
  assertMatch,
  BoxMap,
  Contract,
  Global,
  GlobalState,
  gtxn,
  itxn,
  Txn,
  Uint64,
  readonly,
} from "@algorandfoundation/algorand-typescript";
import { arc4, FixedArray } from "@algorandfoundation/algorand-typescript";

type Slug16 = FixedArray<arc4.Uint8, 16>;

/** Algorand testnet USDC ASA id — escrow, premiums, and refunds use microUSDC. */
const USDC_TESTNET_ASA_ID = Uint64(10458941);

export default class X500Pool extends Contract {
  settlerApp = GlobalState<Application>();
  totalEscrow = GlobalState<uint64>({ initialValue: Uint64(0) });
  initialized = GlobalState<boolean>({ initialValue: false });

  poolBalances = BoxMap<Slug16, uint64>({ keyPrefix: "" });
  escrowBalances = BoxMap<Account, uint64>({ keyPrefix: "e" });

  @abimethod({ name: "init" })
  init(settlerAppId: Application): void {
    assert(!this.initialized.value, "already initialized");
    this.settlerApp.value = settlerAppId;
    this.initialized.value = true;
  }

  /** Opt the pool app into testnet USDC (zero-amount self-transfer). */
  @abimethod({ name: "opt_in_usdc" })
  optInUsdc(): void {
    assert(this.initialized.value, "not initialized");
    itxn
      .assetTransfer({
        assetReceiver: Global.currentApplicationAddress,
        xferAsset: USDC_TESTNET_ASA_ID,
        assetAmount: Uint64(0),
        fee: Uint64(0),
      })
      .submit();
  }

  @abimethod({ name: "top_up" })
  topUp(slug: Slug16): void {
    assert(this.initialized.value, "not initialized");
    assert(Txn.groupIndex > Uint64(0), "grouped axfer required");
    const axfer = gtxn.AssetTransferTxn(Txn.groupIndex - Uint64(1));
    assertMatch(axfer, {
      assetReceiver: Global.currentApplicationAddress,
      assetAmount: { greaterThan: Uint64(0) },
    });
    assert(axfer.xferAsset.id === USDC_TESTNET_ASA_ID, "wrong asset");
    const current = this.poolBalances(slug).get({ default: Uint64(0) });
    this.poolBalances(slug).value = current + axfer.assetAmount;
  }

  @abimethod({ name: "deposit_escrow" })
  depositEscrow(): void {
    assert(this.initialized.value, "not initialized");
    assert(Txn.groupIndex > Uint64(0), "grouped axfer required");
    const axfer = gtxn.AssetTransferTxn(Uint64(0));
    assertMatch(axfer, {
      assetReceiver: Global.currentApplicationAddress,
      sender: Txn.sender,
      assetAmount: { greaterThan: Uint64(0) },
    });
    assert(axfer.xferAsset.id === USDC_TESTNET_ASA_ID, "wrong asset");
    const agent = Txn.sender;
    const current = this.escrowBalances(agent).get({ default: Uint64(0) });
    this.escrowBalances(agent).value = current + axfer.assetAmount;
    this.totalEscrow.value = this.totalEscrow.value + axfer.assetAmount;
  }

  @abimethod({ name: "escrow_of", readonly: true })
  @readonly
  escrowOf(agent: Account): uint64 {
    return this.escrowBalances(agent).get({ default: Uint64(0) });
  }

  @abimethod({ name: "balance_of", readonly: true })
  @readonly
  balanceOf(slug: Slug16): [uint64, uint64] {
    const poolBalance = this.poolBalances(slug).get({ default: Uint64(0) });
    return [poolBalance, this.totalEscrow.value];
  }

  @abimethod({ name: "apply_settlement" })
  applySettlement(
    slug: Slug16,
    agent: Account,
    premium: uint64,
    refund: uint64,
    breach: boolean,
  ): void {
    assert(this.initialized.value, "not initialized");
    assert(Txn.sender === this.settlerApp.value.address, "not settler app");

    const escrow = this.escrowBalances(agent).get({ default: Uint64(0) });
    assert(escrow >= premium, "insufficient escrow");
    this.escrowBalances(agent).value = escrow - premium;
    this.totalEscrow.value = this.totalEscrow.value - premium;

    const pool = this.poolBalances(slug).get({ default: Uint64(0) });
    this.poolBalances(slug).value = pool + premium;

    if (breach && refund > Uint64(0)) {
      const poolAfterPremium = this.poolBalances(slug).value;
      assert(poolAfterPremium >= refund, "insufficient pool");
      this.poolBalances(slug).value = poolAfterPremium - refund;
      itxn
        .assetTransfer({
          assetReceiver: agent,
          xferAsset: USDC_TESTNET_ASA_ID,
          assetAmount: refund,
          fee: Uint64(0),
        })
        .submit();
    }
  }
}
