import type { Account, Application, uint64 } from "@algorandfoundation/algorand-typescript";
import {
  abimethod,
  assert,
  BoxMap,
  clone,
  Contract,
  GlobalState,
  Txn,
  Uint64,
  readonly,
} from "@algorandfoundation/algorand-typescript";
import { arc4, FixedArray } from "@algorandfoundation/algorand-typescript";
import { abiCall } from "@algorandfoundation/algorand-typescript/arc4";

import X500Pool from "./X500Pool.algo";

type Slug16 = FixedArray<arc4.Uint8, 16>;
type CallId16 = FixedArray<arc4.Uint8, 16>;

type SettleCall = [
  Slug16,
  Account,
  CallId16,
  uint64,
  uint64,
  arc4.Uint32,
  boolean,
  arc4.Uint8,
  uint64,
];

export default class X500Settler extends Contract {
  poolApp = GlobalState<Application>();
  settlerAuthority = GlobalState<Account>();
  initialized = GlobalState<boolean>({ initialValue: false });

  settledCalls = BoxMap<CallId16, boolean>({ keyPrefix: "s" });

  @abimethod({ name: "init" })
  init(poolAppId: Application, authority: Account): void {
    assert(!this.initialized.value, "already initialized");
    this.poolApp.value = poolAppId;
    this.settlerAuthority.value = authority;
    this.initialized.value = true;
  }

  @abimethod({ name: "settle_batch" })
  settleBatch(calls: SettleCall[]): void {
    assert(this.initialized.value, "not initialized");
    assert(Txn.sender === this.settlerAuthority.value, "not settler authority");

    for (let i = Uint64(0); i < calls.length; i = i + Uint64(1)) {
      const call = clone(calls[i]);
      const slug = clone(call[0]);
      const agent = call[1];
      const callId = clone(call[2]);
      const premium = call[3];
      const refund = call[4];
      const breach = call[6];

      assert(!this.settledCalls(callId).exists, "already settled");

      abiCall({
        method: X500Pool.prototype.applySettlement,
        appId: this.poolApp.value,
        args: [slug, agent, premium, refund, breach],
        fee: 0,
      });

      this.settledCalls(callId).value = true;
    }
  }

  @abimethod({ name: "is_settled", readonly: true })
  @readonly
  isSettled(callId: CallId16): boolean {
    return this.settledCalls(callId).exists;
  }
}
