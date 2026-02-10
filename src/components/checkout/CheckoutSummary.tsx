"use client";

import type { CartTotals } from "@/modules/cart/types";

type CheckoutSummaryProps = {
  totals: CartTotals;
  deliveryFee?: number | null;
};

export default function CheckoutSummary({ totals, deliveryFee = 0 }: CheckoutSummaryProps) {
  const formatMoney = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // Placeholder values - can be extended later
  const discount = 0;

  const subtotal = totals.totalPrice;
  const effectiveDelivery = deliveryFee ?? 0;
  const total = subtotal + effectiveDelivery - discount;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between text-slate-600">
        <span>Товары ({totals.totalCount})</span>
        <span className="tabular-nums">{formatMoney.format(subtotal)} ₽</span>
      </div>
      
      {discount > 0 && (
        <div className="flex items-center justify-between text-emerald-600">
          <span>Скидка</span>
          <span className="tabular-nums">-{formatMoney.format(discount)} ₽</span>
        </div>
      )}
      
      <div className="flex items-center justify-between text-slate-600">
        <span>Доставка</span>
        <span className="tabular-nums">
          {deliveryFee == null ? "—" : deliveryFee === 0 ? "Бесплатно" : `${formatMoney.format(deliveryFee)} ₽`}
        </span>
      </div>
      
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
        <span>Итого</span>
        <span className="tabular-nums">{formatMoney.format(total)} ₽</span>
      </div>
    </div>
  );
}

