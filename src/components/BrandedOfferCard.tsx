"use client";

import { QuantityControls } from "./QuantityControls";

type BrandedOfferCardProps = {
  itemName: string;
  brand?: string;
  price: number;
  oldPrice?: number;
  tag?: string;
  subtitle?: string;
  imageUrl?: string | null;
  quantity?: number;
  onAdd?: () => void;
  onRemove?: () => void;
};

const BrandedOfferCard = ({
  itemName,
  brand,
  price,
  oldPrice,
  tag,
  subtitle,
  imageUrl,
  quantity = 0,
  onAdd,
  onRemove,
}: BrandedOfferCardProps) => {
  const discount =
    oldPrice && oldPrice > price
      ? `-${Math.round(((oldPrice - price) / oldPrice) * 100)}%`
      : tag;

  const hasImage = !!imageUrl;
  const hasHandlers = !!(onAdd && onRemove);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      {/* Верхняя часть: фото + плашка скидки */}
      <div className="relative h-40 w-full rounded-t-[24px] bg-surface-soft">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl ?? ""}
            alt={itemName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[12px] font-medium text-slate-500">
            пока ещё нет фото!
          </div>
        )}

        {discount && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/85 px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {discount}
          </span>
        )}
      </div>

      {/* Нижняя часть: бренд, название, цена */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        {brand && (
          <div className="line-clamp-1 text-[12px] font-medium text-slate-500">
            {brand}
          </div>
        )}
        <div className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900">
          {itemName}
        </div>
        {subtitle && (
          <div className="mt-1 text-[12px] text-slate-500">
            {subtitle}
          </div>
        )}

        {/* ценовая капсула */}
        <div className="mt-auto flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-2">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              {oldPrice && (
                <span className="text-xs text-slate-400 line-through">
                  {oldPrice} ₽
                </span>
              )}
              <span className="text-lg font-semibold text-slate-900">
                {price} ₽
              </span>
            </div>
          </div>

          {hasHandlers ? (
            <QuantityControls
              quantity={quantity}
              onAdd={onAdd}
              onRemove={onRemove}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center" aria-hidden="true" />
          )}
        </div>
      </div>
    </article>
  );
};

export default BrandedOfferCard;
