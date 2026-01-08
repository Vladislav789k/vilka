"use client";

type BrandedOfferCardProps = {
  itemName: string;
  brand?: string;
  price: number;
  oldPrice?: number;
  tag?: string;
  subtitle?: string;
  imageUrl?: string | null;
  quantity?: number;
  isSoldOut?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  key?: string | number; // React special prop, not passed to component
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
  isSoldOut = false,
  onAdd,
  onRemove,
}: BrandedOfferCardProps) => {
  const discount =
    oldPrice && oldPrice > price
      ? `-${Math.round(((oldPrice - price) / oldPrice) * 100)}%`
      : tag;

  const hasImage = !!imageUrl;
  const hasHandlers = !!(onAdd && onRemove);
  const showOldPrice = oldPrice && oldPrice > price && quantity === 0;

  const handleCardClick = () => {
    if (hasHandlers && quantity === 0 && !isSoldOut) {
      onAdd();
    }
  };

  return (
    <article 
      onClick={handleCardClick}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-150 hover:shadow-md ${hasHandlers && quantity === 0 ? 'cursor-pointer active:scale-[0.98]' : ''}`}
    >
      {/* Изображение с оверлеем */}
      <div className="relative h-40 w-full bg-surface-soft">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl ?? ""}
            alt={itemName}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            style={{ color: "transparent" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[12px] font-medium text-slate-500">
            пока ещё нет фото!
          </div>
        )}

        {/* Оверлей: либо большой счётчик, либо "Товар закончился" */}
        {(quantity > 0 || isSoldOut) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            {isSoldOut ? (
              <span
                className="text-2xl font-bold text-white drop-shadow-lg text-center"
                style={{ color: "rgb(255, 255, 255)" }}
              >
                Товар закончился
              </span>
            ) : (
              <span
                className="text-6xl font-bold text-white drop-shadow-lg"
                style={{ color: "rgb(255, 255, 255)" }}
              >
                {quantity}
              </span>
            )}
          </div>
        )}

        {/* Плашка скидки/тега */}
        {discount && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/85 px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {discount}
          </span>
        )}
      </div>

      {/* Контент: название, спецификация, цена и действия */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        {/* Детали: название и спецификация */}
        <div className="mb-3 flex-1">
          {/* Название */}
          <div
            className="line-clamp-2 text-sm font-semibold leading-snug"
            title={itemName}
            style={{ color: "rgb(89, 89, 89)" }}
          >
            {itemName}
          </div>

          {/* Спецификация: вес */}
          {subtitle && (
            <div className="mt-1.5 text-sm font-semibold" style={{ color: "rgb(166, 166, 166)" }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Действия: зеленая кнопка с ценой и плюсом (справа, растягивается влево) */}
        {hasHandlers ? (
          quantity > 0 ? (
            <div className="flex justify-end">
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2.5 transition hover:opacity-90"
                style={{ backgroundColor: "#00B749" }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove();
                    }
                  }}
                  className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-white transition hover:bg-white/20"
                  aria-label="Уменьшить количество"
                >
                  <span className="text-sm font-bold">−</span>
                </div>
                <span className="text-base font-semibold text-white">{price} ₽</span>
                {!isSoldOut && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd();
                    }}
                    className="flex items-center justify-center text-white transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-500"
                    aria-label="Увеличить количество"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="none"
                      viewBox="0 0 16 16"
                      className="min-w-[16px] min-h-[16px] shrink-0"
                      style={{ color: "#FFFFFF" }}
                    >
                      <path
                        fill="currentColor"
                        d="M8 0c.43 0 .778.348.778.778v5.444a1 1 0 0 0 1 1h5.444a.778.778 0 1 1 0 1.556H9.778a1 1 0 0 0-1 1v5.444a.778.778 0 1 1-1.556 0V9.778a1 1 0 0 0-1-1H.778a.778.778 0 0 1 0-1.556h5.444a1 1 0 0 0 1-1V.778C7.222.348 7.57 0 8 0"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              {isSoldOut ? (
                <div
                  className="flex items-center gap-2 rounded-full px-4 py-2.5 opacity-80"
                  style={{ backgroundColor: "#00B749" }}
                >
                  {showOldPrice && (
                    <span className="text-sm font-semibold text-white/70 line-through">
                      {oldPrice} ₽
                    </span>
                  )}
                  <span className="text-base font-semibold text-white">{price} ₽</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                  className="flex items-center gap-2 rounded-full px-4 py-2.5 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ backgroundColor: "#00B749" }}
                >
                  {showOldPrice && (
                    <span className="text-sm font-semibold text-white/70 line-through">
                      {oldPrice} ₽
                    </span>
                  )}
                  <span className="text-base font-semibold text-white">{price} ₽</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 16 16"
                    className="min-w-[16px] min-h-[16px] shrink-0"
                    style={{ color: "#FFFFFF" }}
                  >
                    <path
                      fill="currentColor"
                      d="M8 0c.43 0 .778.348.778.778v5.444a1 1 0 0 0 1 1h5.444a.778.778 0 1 1 0 1.556H9.778a1 1 0 0 0-1 1v5.444a.778.778 0 1 1-1.556 0V9.778a1 1 0 0 0-1-1H.778a.778.778 0 0 1 0-1.556h5.444a1 1 0 0 0 1-1V.778C7.222.348 7.57 0 8 0"
                    />
                  </svg>
                </button>
              )}
            </div>
          )
        ) : (
          <div className="flex justify-end">
            <div className="flex items-center gap-2 rounded-full px-4 py-2.5" style={{ backgroundColor: "#00B749" }}>
              <span className="text-base font-semibold text-white">{price} ₽</span>
              <div className="flex h-8 w-8 items-center justify-center" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export default BrandedOfferCard;
