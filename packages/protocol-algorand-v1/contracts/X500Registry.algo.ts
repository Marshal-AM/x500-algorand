import type { Account, uint64 } from "@algorandfoundation/algorand-typescript";
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

type Slug16 = FixedArray<arc4.Uint8, 16>;

type EndpointRecord = {
  owner: Account;
  flatPremiumMicroAlgos: uint64;
  percentBps: arc4.Uint16;
  slaLatencyMs: arc4.Uint32;
  imputedCostMicroAlgos: uint64;
  apiPriceMicroUsdc: uint64;
  feeRecipientCount: arc4.Uint8;
  paused: boolean;
  hostname: string;
  contactAddress: Account;
};

const DEFAULT_FLAT_PREMIUM = Uint64(10_000);
const DEFAULT_IMPUTED_COST = Uint64(100_000);

export default class X500Registry extends Contract {
  slugCount = GlobalState<uint64>({ initialValue: Uint64(0) });
  protocolPaused = GlobalState<boolean>({ initialValue: false });

  endpoints = BoxMap<Slug16, EndpointRecord>({ keyPrefix: "" });
  slugAt = BoxMap<uint64, Slug16>({ keyPrefix: "idx" });

  @abimethod({ name: "register_endpoint" })
  registerEndpoint(
    slug: Slug16,
    hostname: string,
    apiPriceMicroUsdc: uint64,
    contactAddress: Account,
    slaLatencyMs: arc4.Uint32,
  ): void {
    assert(!this.protocolPaused.value, "protocol paused");
    assert(!this.endpoints(slug).exists, "slug exists");

    this.endpoints(slug).value = {
      owner: Txn.sender,
      flatPremiumMicroAlgos: DEFAULT_FLAT_PREMIUM,
      percentBps: new arc4.Uint16(0),
      slaLatencyMs,
      imputedCostMicroAlgos: DEFAULT_IMPUTED_COST,
      apiPriceMicroUsdc,
      feeRecipientCount: new arc4.Uint8(1),
      paused: false,
      hostname,
      contactAddress,
    };

    const idx = this.slugCount.value;
    this.slugAt(idx).value = clone(slug);
    this.slugCount.value = idx + Uint64(1);
  }

  @abimethod({ name: "get_endpoint", readonly: true })
  @readonly
  getEndpoint(slug: Slug16): [
    boolean,
    boolean,
    Account,
    uint64,
    arc4.Uint16,
    arc4.Uint32,
    uint64,
    uint64,
    arc4.Uint8,
    string,
    Account,
  ] {
    if (!this.endpoints(slug).exists) {
      return [
        false,
        false,
        Txn.sender,
        Uint64(0),
        new arc4.Uint16(0),
        new arc4.Uint32(0),
        Uint64(0),
        Uint64(0),
        new arc4.Uint8(0),
        "",
        Txn.sender,
      ];
    }
    const ep = clone(this.endpoints(slug).value);
    return [
      true,
      ep.paused,
      ep.owner,
      ep.flatPremiumMicroAlgos,
      ep.percentBps,
      ep.slaLatencyMs,
      ep.imputedCostMicroAlgos,
      ep.apiPriceMicroUsdc,
      ep.feeRecipientCount,
      ep.hostname,
      ep.contactAddress,
    ];
  }

  @abimethod({ name: "slug_count", readonly: true })
  @readonly
  slugCountMethod(): uint64 {
    return this.slugCount.value;
  }

  @abimethod({ name: "slug_at", readonly: true })
  @readonly
  slugAtMethod(index: uint64): Slug16 {
    assert(index < this.slugCount.value, "index out of range");
    return this.slugAt(index).value;
  }

  @abimethod({ name: "protocol_paused", readonly: true })
  @readonly
  protocolPausedMethod(): boolean {
    return this.protocolPaused.value;
  }

  @abimethod({ name: "set_endpoint_sla" })
  setEndpointSla(slug: Slug16, slaLatencyMs: arc4.Uint32): void {
    assert(this.endpoints(slug).exists, "not registered");
    const ep = clone(this.endpoints(slug).value);
    assert(Txn.sender === ep.owner, "not owner");
    ep.slaLatencyMs = slaLatencyMs;
    this.endpoints(slug).value = clone(ep);
  }

  @abimethod({ name: "update_endpoint" })
  updateEndpoint(
    slug: Slug16,
    hostname: string,
    apiPriceMicroUsdc: uint64,
    contactAddress: Account,
  ): void {
    assert(this.endpoints(slug).exists, "not registered");
    const ep = clone(this.endpoints(slug).value);
    assert(Txn.sender === ep.owner, "not owner");
    ep.hostname = hostname;
    ep.apiPriceMicroUsdc = apiPriceMicroUsdc;
    ep.contactAddress = contactAddress;
    this.endpoints(slug).value = clone(ep);
  }
}
