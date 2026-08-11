# Billing rounding: round money, never quantities

`calculateMeterReading` used to round the raw meter-usage figure (`currentMeter - previousMeter`) to 2dp *and* round the resulting money amount, rounding twice on the way from a meter reading to a charge. We decided usage is a physical quantity, not currency, and only money gets rounded: `usage = currentMeter - previousMeter` (unrounded), `amount = round(usage * rate, 2dp)`. Every other monetary aggregate (`subtotal`, `total`, `otherChargesTotal`) already rounded to 2dp and is unaffected.

## Considered Options

- **Round money only (chosen)** — one rounding pass per value, usage stays exact.
- **Keep double-rounding** — no code change, but two rounding rules to remember and no clean statement of "the" rounding rule.
- **Force integer meter readings** — reject decimal meter input at validation, since electricity/water meters are physically whole units. Rejected as an unrelated, stricter validation change bundled into what should be a pure rounding fix.
