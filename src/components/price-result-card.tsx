const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function getUpdateLabel(updatedAt: string) {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return { label: "Data de atualização não disponível", isOld: false };
  }

  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY_IN_MS));

  if (days > 30) {
    return {
      label: `Atualizado há ${days} dias — o preço pode ter mudado`,
      isOld: true,
    };
  }

  if (days === 0) return { label: "Atualizado hoje", isOld: false };
  if (days === 1) return { label: "Atualizado há 1 dia", isOld: false };

  return {
    label: `Atualizado em ${dateFormatter.format(date)}`,
    isOld: false,
  };
}

type PriceResultCardProps = {
  material: string;
  imageUrl: string | null;
  store: string;
  city: string;
  price: number;
  updatedAt: string;
  isBestPrice: boolean;
};

export function PriceResultCard({
  material,
  imageUrl,
  store,
  city,
  price,
  updatedAt,
  isBestPrice,
}: PriceResultCardProps) {
  const update = getUpdateLabel(updatedAt);

  return (
    <li
      className={`relative flex min-h-44 flex-col justify-between border border-mist bg-paper p-4 sm:p-5 ${
        isBestPrice ? "border-l-[3px] border-l-best" : ""
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-mist bg-bone sm:h-24 sm:w-24">
          {imageUrl ? (
            // The image host is the project's configurable Supabase URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`Imagem de ${material}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-ash"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-label="Imagem não disponível"
              role="img"
            >
              <path d="M4 5.5h16v13H4z" />
              <circle cx="9" cy="10" r="1.5" />
              <path d="m5 17 4.5-4 3 2.5 2.5-2 4 3.5" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
            <h3 className="text-base font-bold leading-snug text-carbon">
              {material}
            </h3>
            {isBestPrice && (
              <span className="shrink-0 border border-best px-2 py-1 text-xs font-bold text-best">
                Melhor preço
              </span>
            )}
          </div>
          <p className="mt-3 text-sm text-ash">
            <span className="font-bold text-carbon">{store}</span>
            <span aria-hidden="true"> · </span>
            {city}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-1 border-t border-mist pt-3">
        <p
          className={`text-xl font-bold leading-snug ${isBestPrice ? "text-best" : "text-carbon"}`}
        >
          {Number.isFinite(price) ? currency.format(price) : "Preço indisponível"}
        </p>
        <p className="text-xs leading-relaxed text-ash">
          {update.label}
          {update.isOld && <span className="sr-only">. Preço desatualizado.</span>}
        </p>
      </div>
    </li>
  );
}
