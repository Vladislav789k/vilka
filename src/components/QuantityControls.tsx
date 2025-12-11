"use client";

type QuantityControlsProps = {
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Shared quantity control component for add/remove buttons with quantity display.
 * Used in both BrandedOfferCard and AnonymousOfferCard for consistency.
 */
export function QuantityControls({
  quantity,
  onAdd,
  onRemove,
  size = "md",
  className = "",
}: QuantityControlsProps) {
  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onAdd();
  };

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRemove();
  };

  const sizeClasses = {
    sm: {
      button: "h-7 w-7 text-sm",
      quantity: "text-sm",
    },
    md: {
      button: "h-8 w-8 text-base",
      quantity: "text-sm",
    },
  };

  const classes = sizeClasses[size];

  if (quantity > 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={handleRemove}
          aria-label="Уменьшить количество"
          className={`flex ${classes.button} items-center justify-center rounded-full bg-white font-semibold leading-none text-slate-700 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1`}
        >
          –
        </button>
        <span
          className={`${classes.quantity} min-w-[1.5rem] text-center font-semibold text-slate-900`}
          aria-label={`Количество: ${quantity}`}
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={handleAdd}
          aria-label="Увеличить количество"
          className={`flex ${classes.button} items-center justify-center rounded-full bg-white font-semibold leading-none text-emerald-500 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1`}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      aria-label="Добавить в корзину"
      className={`flex ${classes.button} items-center justify-center rounded-full bg-white font-semibold leading-none text-emerald-500 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${className}`}
    >
      +
    </button>
  );
}

