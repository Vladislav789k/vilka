"use client";

import { useState } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import type { CheckoutDraft } from "./types";
import type { CartTotals } from "@/modules/cart/types";

type AddressPaymentStepProps = {
  draft: CheckoutDraft;
  onUpdateDraft: (updates: Partial<CheckoutDraft>) => void;
  onOpenAddressModal: () => void;
  totals: CartTotals;
  deliveryFee?: number | null;
};

export default function AddressPaymentStep({
  draft,
  onUpdateDraft,
  onOpenAddressModal,
  totals,
  deliveryFee = 0,
}: AddressPaymentStepProps) {
  const formatMoney = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const discount = 0;
  const subtotal = totals.totalPrice;
  const effectiveDelivery = deliveryFee ?? 0;
  const total = subtotal + effectiveDelivery - discount;

  return (
    <div className="flex flex-col gap-6">
      {/* Address Section */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Адрес доставки</h3>
        <button
          type="button"
          onClick={onOpenAddressModal}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-slate-500" />
            <span className={draft.addressLabel ? "text-sm font-medium text-slate-900" : "text-sm text-slate-500"}>
              {draft.addressLabel || "Указать адрес доставки"}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Address Details Form */}
      {draft.addressLabel && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Квартира/офис</label>
              <input
                type="text"
                value={draft.apartment}
                onChange={(e) => onUpdateDraft({ apartment: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Этаж</label>
              <input
                type="text"
                value={draft.floor}
                onChange={(e) => onUpdateDraft({ floor: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Подъезд</label>
              <input
                type="text"
                value={draft.entrance}
                onChange={(e) => onUpdateDraft({ entrance: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Домофон</label>
              <input
                type="text"
                value={draft.intercom}
                onChange={(e) => onUpdateDraft({ intercom: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Комментарий</label>
            <textarea
              value={draft.comment}
              onChange={(e) => onUpdateDraft({ comment: e.target.value })}
              placeholder="Дополнительная информация для курьера"
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="leaveAtDoor"
              checked={draft.leaveAtDoor}
              onChange={(e) => onUpdateDraft({ leaveAtDoor: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0"
            />
            <label htmlFor="leaveAtDoor" className="text-sm font-medium text-slate-700 cursor-pointer">
              Оставить у двери
            </label>
          </div>
        </div>
      )}

      {/* Payment Section */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Оплата</h3>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="text-sm font-medium text-slate-900">+ Оплата новой картой</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Total Summary */}
      <div className="border-t border-slate-200 pt-4">
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
      </div>
    </div>
  );
}

