-- Rescale USDC economics from mistaken tinybar-scale integers to 6-decimal microUSDC
-- (mirrors Hedera: 1e6 tinybars = 0.01 HBAR → 10e3 microUSDC = 0.01 USDC).

UPDATE endpoints
SET
  flat_premium_micro_algos = 10000,
  imputed_cost_micro_algos = 100000,
  updated_at = NOW()
WHERE network = 'algorand:testnet'
  AND flat_premium_micro_algos = 1000000
  AND imputed_cost_micro_algos >= 10000000;

UPDATE endpoints
SET
  flat_premium_micro_algos = 10000,
  updated_at = NOW()
WHERE network = 'algorand:testnet'
  AND flat_premium_micro_algos = 1000000
  AND imputed_cost_micro_algos < 10000000;

UPDATE endpoints
SET
  imputed_cost_micro_algos = 100000,
  updated_at = NOW()
WHERE network = 'algorand:testnet'
  AND imputed_cost_micro_algos = 10000000
  AND flat_premium_micro_algos <> 1000000;
