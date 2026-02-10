"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { YMaps, Map, Placemark, useYMaps } from "@iminside/react-yandex-maps";

type AddressModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress: (address: {
    id: number;
    label: string;
    city: string;
    latitude: number;
    longitude: number;
  }) => void;
};

const ANIM_MS = 500;

function AddressModalContent({ isOpen, onClose, onSelectAddress }: AddressModalProps) {
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");

  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);

  const [coords, setCoords] = useState<[number, number]>([55.7558, 37.6173]); // Москва по умолчанию

  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const streetInputRef = useRef<HTMLInputElement | null>(null);

  const mapRef = useRef<any>(null);
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualGeocodeRef = useRef(false);

  const geoRequestedRef = useRef(false);
  const geoWatchIdRef = useRef<number | null>(null);

  const [geoStatus, setGeoStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unavailable" | "timeout" | "insecure"
  >("idle");

  const ymaps = useYMaps(["geocode", "suggest"]);

  // reset при открытии
  useEffect(() => {
    if (!isOpen) return;

    setCity("");
    setStreet("");
    setCitySuggestions([]);
    setStreetSuggestions([]);
    setShowCitySuggestions(false);
    setShowStreetSuggestions(false);
    setCoords([55.7558, 37.6173]);

    geoRequestedRef.current = false;

    if (geoWatchIdRef.current != null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      try {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      } catch {}
      geoWatchIdRef.current = null;
    }

    setGeoStatus("idle");

    setTimeout(() => cityInputRef.current?.focus(), 0);
  }, [isOpen]);

  const hasHouseNumber = (address: string): boolean => {
    if (!address.trim()) return false;
    const housePattern = /\d+|д\.|дом|к\.|корп\.|лит\.|стр\./i;
    return housePattern.test(address);
  };

  // --------- Clear buttons ----------
  const clearCity = useCallback(() => {
    setCity("");
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setTimeout(() => cityInputRef.current?.focus(), 0);
  }, []);

  const clearStreet = useCallback(() => {
    setStreet("");
    setStreetSuggestions([]);
    setShowStreetSuggestions(false);
    setTimeout(() => streetInputRef.current?.focus(), 0);
  }, []);

  // --------- Suggest (город) ----------
  const fetchCitySuggestions = useCallback(
    (query: string) => {
      if (!ymaps || !query.trim() || query.length < 2) {
        setCitySuggestions([]);
        setShowCitySuggestions(false);
        return;
      }

      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);

      suggestTimeoutRef.current = setTimeout(() => {
        ymaps
          ?.geocode(query, { results: 10 })
          .then((res: any) => {
            if (!res?.geoObjects) {
              setCitySuggestions([]);
              setShowCitySuggestions(false);
              return;
            }

            const suggestions: string[] = [];
            res.geoObjects.each((geoObject: any) => {
              const metaData = geoObject.properties.get("metaDataProperty")?.GeocoderMetaData;
              const comps = metaData?.Address?.Components || [];
              comps.forEach((c: any) => {
                if (
                  (c.kind === "locality" || c.kind === "area" || c.kind === "province") &&
                  c.name &&
                  !suggestions.includes(c.name)
                ) {
                  suggestions.push(c.name);
                }
              });
            });

            if (suggestions.length === 0) {
              res.geoObjects.each((geoObject: any) => {
                const text = geoObject.properties.get("text");
                const firstPart = text?.split(",")[0]?.trim();
                if (firstPart && !suggestions.includes(firstPart)) suggestions.push(firstPart);
              });
            }

            const cut = suggestions.slice(0, 7);
            setCitySuggestions(cut);
            setShowCitySuggestions(cut.length > 0);
          })
          .catch(() => {
            setCitySuggestions([]);
            setShowCitySuggestions(false);
          });
      }, 250);
    },
    [ymaps]
  );

  const handleCityChange = useCallback(
    (value: string) => {
      setCity(value);
      if (value.trim().length >= 2) fetchCitySuggestions(value);
      else {
        setCitySuggestions([]);
        setShowCitySuggestions(false);
      }
    },
    [fetchCitySuggestions]
  );

  const handleCitySelect = useCallback(
    (selectedCity: string) => {
      setCity(selectedCity);
      setCitySuggestions([]);
      setShowCitySuggestions(false);

      if (ymaps) {
        ymaps
          .geocode(selectedCity, { results: 1, kind: "locality" })
          .then((res: any) => {
            const first = res?.geoObjects?.get(0);
            if (!first) return;
            const position = first.geometry.getCoordinates() as [number, number];
            setCoords(position);
            if (mapRef.current) mapRef.current.setCenter(position, 11);
          })
          .catch(() => {});
      }

      setTimeout(() => streetInputRef.current?.focus(), 0);
    },
    [ymaps]
  );

  // --------- Suggest (улица) ----------
  const fetchStreetSuggestions = useCallback(
    (query: string, cityName: string) => {
      if (!ymaps || !query.trim() || query.length < 2 || !cityName.trim()) {
        setStreetSuggestions([]);
        setShowStreetSuggestions(false);
        return;
      }

      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);

      suggestTimeoutRef.current = setTimeout(() => {
        const fullQuery = `${cityName}, ${query}`;
        ymaps
          ?.geocode(fullQuery, { results: 10 })
          .then((res: any) => {
            if (!res?.geoObjects) {
              setStreetSuggestions([]);
              setShowStreetSuggestions(false);
              return;
            }

            const suggestions: string[] = [];
            res.geoObjects.each((geoObject: any) => {
              const address = geoObject.properties.get("text");
              if (!address) return;
              const parts = address.split(",");
              if (parts.length < 2) return;
              const streetPart = parts.slice(1).join(",").trim();
              if (streetPart && !suggestions.includes(streetPart)) suggestions.push(streetPart);
            });

            const cut = suggestions.slice(0, 7);
            setStreetSuggestions(cut);
            setShowStreetSuggestions(cut.length > 0);
          })
          .catch(() => {
            setStreetSuggestions([]);
            setShowStreetSuggestions(false);
          });
      }, 250);
    },
    [ymaps]
  );

  const handleStreetChange = useCallback(
    (value: string) => {
      setStreet(value);
      if (value.trim().length >= 2 && city.trim()) fetchStreetSuggestions(value, city);
      else {
        setStreetSuggestions([]);
        setShowStreetSuggestions(false);
      }
    },
    [city, fetchStreetSuggestions]
  );

  const handleStreetSelect = useCallback(
    (selectedStreet: string) => {
      setStreet(selectedStreet);
      setStreetSuggestions([]);
      setShowStreetSuggestions(false);

      const fullAddress = `${city}, ${selectedStreet}`;
      if (!ymaps) return;

      isManualGeocodeRef.current = true;

      ymaps
        .geocode(fullAddress, { results: 1 })
        .then((res: any) => {
          const first = res?.geoObjects?.get(0);
          if (!first) return;
          const position = first.geometry.getCoordinates() as [number, number];
          setCoords(position);
          if (mapRef.current) mapRef.current.setCenter(position, 17);
        })
        .catch(() => {})
        .finally(() => {
          setTimeout(() => {
            isManualGeocodeRef.current = false;
          }, 100);
        });
    },
    [city, ymaps]
  );

  // --------- Reverse geocode (coords -> city/street) ----------
  const handleReverseGeocode = useCallback(
    (coordinates: [number, number]) => {
      if (!ymaps) return;

      isManualGeocodeRef.current = true;

      ymaps
        .geocode(coordinates, { results: 1 })
        .then((res: any) => {
          const first = res?.geoObjects?.get(0);
          if (!first) return;

          const comps =
            first.properties.get("metaDataProperty")?.GeocoderMetaData?.Address?.Components || [];

          let foundCity = "";
          let foundStreet = "";

          comps.forEach((c: any) => {
            if (c.kind === "locality" || c.kind === "area") foundCity = c.name;
            if (c.kind === "street" || c.kind === "route") foundStreet = c.name;
            if (c.kind === "house") foundStreet = `${foundStreet} ${c.name}`.trim();
          });

          if (!foundCity) {
            const text = first.properties.get("text") || "";
            const p = text.split(",");
            if (p.length > 0) foundCity = p[0].trim();
          }

          if (!foundStreet) {
            const text = first.properties.get("text") || "";
            const p = text.split(",");
            if (p.length > 1) foundStreet = p.slice(1).join(",").trim();
          }

          if (foundCity) setCity(foundCity);
          if (foundStreet) setStreet(foundStreet);
        })
        .catch(() => {})
        .finally(() => {
          setTimeout(() => {
            isManualGeocodeRef.current = false;
          }, 100);
        });
    },
    [ymaps]
  );

  // --------- Geolocation ----------
  const requestAndApplyGeolocation = useCallback(() => {
    if (geoStatus === "requesting") return;
    if (geoRequestedRef.current) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoStatus("insecure");
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("unavailable");
      return;
    }

    geoRequestedRef.current = true;
    setGeoStatus("requesting");

    const perms = (navigator as any).permissions;
    if (perms?.query) {
      perms
        .query({ name: "geolocation" })
        .then((p: any) => {
          if (p?.state === "denied") {
            setGeoStatus("denied");
            return;
          }

          if (p?.state === "granted" && geoWatchIdRef.current == null) {
            try {
              const watchId = navigator.geolocation.watchPosition(
                (pos) => {
                  const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                  setGeoStatus("granted");
                  setCoords(next);
                  if (mapRef.current) mapRef.current.setCenter(next, 16);
                  handleReverseGeocode(next);
                  if (geoWatchIdRef.current != null) {
                    navigator.geolocation.clearWatch(geoWatchIdRef.current);
                    geoWatchIdRef.current = null;
                  }
                },
                () => {
                  if (geoWatchIdRef.current != null) {
                    navigator.geolocation.clearWatch(geoWatchIdRef.current);
                    geoWatchIdRef.current = null;
                  }
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
              );
              geoWatchIdRef.current = watchId;
            } catch {}
          }
        })
        .catch(() => {});
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setGeoStatus("granted");
        setCoords(next);
        if (mapRef.current) mapRef.current.setCenter(next, 16);
        handleReverseGeocode(next);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("denied");
          return;
        }
        setGeoStatus(err.code === err.TIMEOUT ? "timeout" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [geoStatus, handleReverseGeocode]);

  useEffect(() => {
    if (!isOpen) return;
    requestAndApplyGeolocation();
  }, [isOpen, requestAndApplyGeolocation]);

  // --------- Click on map ----------
  const handleMapClick = useCallback(
    (event: any) => {
      if (!event) return;
      const coordinates = event.get("coords") as [number, number];
      if (!coordinates || coordinates.length !== 2) return;

      setCoords(coordinates);
      handleReverseGeocode(coordinates);
      if (mapRef.current) mapRef.current.setCenter(coordinates, 17);
    },
    [handleReverseGeocode]
  );

  // --------- Auto geocode when typing street (debounced) ----------
  const handleGeocode = useCallback(() => {
    const fullAddress = `${city}, ${street}`.trim();
    if (!ymaps || fullAddress.length < 5) return;

    ymaps
      .geocode(fullAddress, { results: 1 })
      .then((res: any) => {
        const first = res?.geoObjects?.get(0);
        if (!first) return;
        const position = first.geometry.getCoordinates() as [number, number];
        setCoords(position);
        if (mapRef.current) mapRef.current.setCenter(position, 15);
      })
      .catch(() => {});
  }, [city, street, ymaps]);

  useEffect(() => {
    if (!isOpen) return;
    if (!ymaps) return;
    if (!city.trim() || !street.trim()) return;
    if (isManualGeocodeRef.current) return;

    if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);

    geocodeTimeoutRef.current = setTimeout(() => {
      handleGeocode();
    }, 700);

    return () => {
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
    };
  }, [city, street, ymaps, isOpen, handleGeocode]);

  const handleSaveNewAddress = async () => {
    const addressLine = street.trim().length > 0 ? `${street.trim()}, ${city.trim()}` : `${city.trim()}`;

    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address_line: addressLine,
          city: city.trim(),
          latitude: coords[0],
          longitude: coords[1],
          set_default: true,
        }),
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: number };
        const id = Number(data?.id);
        if (!Number.isFinite(id)) {
          alert("Адрес сохранён, но сервер не вернул id. Обновите страницу и попробуйте снова.");
          return;
        }

        onSelectAddress({
          id,
          label: addressLine,
          city: city.trim(),
          latitude: coords[0],
          longitude: coords[1],
        });
        onClose();
        return;
      }

      const errorData = await res.json().catch(() => ({}));
      if (res.status === 401) {
        alert("Необходимо авторизоваться для сохранения адреса");
      } else {
        alert(`Не удалось сохранить адрес: ${errorData.error || "Неизвестная ошибка"}`);
      }
    } catch (e) {
      alert("Ошибка при сохранении адреса. Проверьте консоль для деталей.");
      console.error(e);
    }
  };

  const canSave = !!city.trim() && !!street.trim() && hasHouseNumber(street);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6">
      {/* MAP */}
      <div className="relative min-h-[360px] overflow-hidden rounded-[28px] bg-slate-100 ring-1 ring-slate-200 lg:min-h-0">
        {(geoStatus === "requesting" ||
          geoStatus === "denied" ||
          geoStatus === "unavailable" ||
          geoStatus === "timeout" ||
          geoStatus === "insecure") && (
          <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-32px)] rounded-2xl bg-white/95 px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm">
            {geoStatus === "requesting"
              ? "Определяем ваше местоположение…"
              : geoStatus === "denied"
              ? "Геопозиция запрещена — можно выбрать точку на карте вручную."
              : geoStatus === "timeout"
              ? "Не удалось получить геопозицию (таймаут). Можно выбрать точку на карте вручную."
              : geoStatus === "insecure"
              ? "Геопозиция требует HTTPS (или localhost). Можно выбрать точку на карте вручную."
              : "Геопозиция недоступна — можно выбрать точку на карте вручную."}
          </div>
        )}

        <Map
          instanceRef={(ref: any) => {
            mapRef.current = ref;
          }}
          defaultState={{ center: coords, zoom: 12 }}
          state={{ center: coords }}
          width="100%"
          height="100%"
          onClick={handleMapClick}
        >
          <Placemark geometry={coords} />
        </Map>
      </div>

      {/* RIGHT */}
      <div className="flex h-full min-h-0 flex-col px-1 sm:px-2">
        <div className="mb-6 mt-1 text-center text-[28px] font-semibold tracking-tight text-slate-900">
          Добавить адрес
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          {/* CITY */}
          <div className="relative">
            <div className="relative">
              <input
                ref={cityInputRef}
                id="city-input"
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                onFocus={() => {
                  requestAndApplyGeolocation();
                  if (city.trim().length >= 2) setShowCitySuggestions(true);
                }}
                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                placeholder=" "
                className={[
                  "peer h-14 w-full rounded-full bg-slate-100 px-5 pr-12",
                  "pt-6 pb-2 text-[15px] font-semibold text-slate-900",
                  "border border-transparent outline-none transition",
                  "focus:bg-white focus:border-emerald-300",
                ].join(" ")}
              />

              <label
                htmlFor="city-input"
                className={[
                  "pointer-events-none absolute left-5",
                  "top-3 translate-y-0",
                  "text-[12px] font-semibold text-slate-400 transition-all",
                  "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px]",
                  "peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[12px]",
                ].join(" ")}
              >
                Город
              </label>

              {city.trim().length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearCity}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-200/60 text-slate-700 hover:bg-slate-200"
                  aria-label="Очистить город"
                  title="Очистить"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {showCitySuggestions && citySuggestions.length > 0 && (
              <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-lg">
                {citySuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleCitySelect(s)}
                    className="w-full px-5 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* STREET */}
          <div className="relative mt-4">
            <div className="relative">
              <input
                ref={streetInputRef}
                id="street-input"
                value={street}
                onChange={(e) => handleStreetChange(e.target.value)}
                onFocus={() => {
                  requestAndApplyGeolocation();
                  if (street.trim().length >= 2 && city.trim()) setShowStreetSuggestions(true);
                }}
                onBlur={() => setTimeout(() => setShowStreetSuggestions(false), 200)}
                placeholder=" "
                className={[
                  "peer h-14 w-full rounded-full bg-slate-100 px-5 pr-12",
                  "pt-6 pb-2 text-[15px] font-semibold text-slate-900",
                  "border border-transparent outline-none transition",
                  "focus:bg-white focus:border-emerald-300",
                ].join(" ")}
              />

              <label
                htmlFor="street-input"
                className={[
                  "pointer-events-none absolute left-5",
                  "top-3 translate-y-0",
                  "text-[12px] font-semibold text-slate-400 transition-all",
                  "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px]",
                  "peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[12px]",
                ].join(" ")}
              >
                Улица и дом
              </label>

              {street.trim().length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearStreet}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-200/60 text-slate-700 hover:bg-slate-200"
                  aria-label="Очистить адрес"
                  title="Очистить"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {showStreetSuggestions && streetSuggestions.length > 0 && (
              <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-lg">
                {streetSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleStreetSelect(s)}
                    className="w-full px-5 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="text-sm font-semibold text-slate-900">{s}</div>
                    {city ? <div className="text-xs font-semibold text-slate-400">{city}</div> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        <button
          type="button"
          onClick={handleSaveNewAddress}
          disabled={!canSave}
          className={[
            "h-14 w-full rounded-full px-6 text-base font-semibold transition",
            canSave
              ? "bg-[#ff2d55] text-white hover:bg-[#ff1846] active:scale-[0.99]"
              : "cursor-not-allowed bg-slate-200 text-slate-400",
          ].join(" ")}
        >
          Да, всё верно
        </button>
      </div>
    </div>
  );
}

export default function AddressModal(props: AddressModalProps) {
  const { isOpen, onClose } = props;

  const [mounted, setMounted] = useState(false);

  // держим компонент в DOM, пока проигрывается анимация закрытия
  const [shouldRender, setShouldRender] = useState(false);
  const [closing, setClosing] = useState(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  // реагируем на isOpen
  useEffect(() => {
    if (!mounted) return;

    if (isOpen) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setShouldRender(true);
      setClosing(false);
      return;
    }

    if (!isOpen && shouldRender) {
      setClosing(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setShouldRender(false);
        setClosing(false);
      }, ANIM_MS);
    }
  }, [isOpen, mounted, shouldRender]);

  // Esc
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // lock body scroll while modal is rendered (open or closing)
  useEffect(() => {
    if (!shouldRender) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [shouldRender]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!mounted || !shouldRender) return null;

  const yandexApiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "";

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* overlay */}
      <div
        className={["profile-drawer-overlay absolute inset-0 bg-black/45", closing ? "closing" : ""].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel справа */}
      <div
        className={[
          "profile-drawer-panel absolute inset-y-0 right-0 w-full max-w-[980px] p-4 sm:p-5",
          closing ? "closing" : "",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Добавить адрес"
      >
        <div className="relative h-full overflow-hidden rounded-[40px] bg-white shadow-2xl">
          {/* внутренние отступы */}
          <div className="relative h-full p-5 sm:p-6">
            {/* X */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              aria-label="Закрыть"
              title="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>

            <YMaps query={yandexApiKey ? { apikey: yandexApiKey } : undefined}>
              <AddressModalContent {...props} />
            </YMaps>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
