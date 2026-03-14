export type PricingInput = {
  entryTime: Date;
  exitTime: Date;
  gracePeriodMinutes: number;
  hourlyRate: number;
};

export type PricingResult = {
  totalMinutes: number;
  billableMinutes: number;
  totalHours: number;
  amount: number;
};

function clampNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateHourlyFractionalPricing(input: PricingInput): PricingResult {
  const diffMs = input.exitTime.getTime() - input.entryTime.getTime();
  const totalMinutes = clampNonNegative(diffMs / (1000 * 60));
  const grace = clampNonNegative(input.gracePeriodMinutes);
  const billableMinutes = clampNonNegative(totalMinutes - grace);

  const perMinute = input.hourlyRate / 60;
  const amount = billableMinutes <= 0 ? 0 : Math.ceil(billableMinutes * perMinute);

  return {
    totalMinutes,
    billableMinutes,
    totalHours: totalMinutes / 60,
    amount,
  };
}
