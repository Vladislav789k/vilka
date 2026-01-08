"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ArrowLeft, X } from "lucide-react";
import { YMaps, Map, Placemark, useYMaps } from "@iminside/react-yandex-maps";

type Address = {
  id: number;
  label: string | null;
  address_line: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  comment: string | null;
};

type AddressModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress: (label: string) => void;
};

// Внутренний компонент, который использует useYMaps внутри YMaps провайдера
const AddressModalContent = ({
  isOpen,
  onClose,
  onSelectAddress,
}: AddressModalProps) => {
  const [step, setStep] = useState<"list" | "add">("list");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);
  const [selectedCityCoords, setSelectedCityCoords] = useState<[number, number] | null>(null);
  const [currentStep, setCurrentStep] = useState<"city" | "street">("city"); // Текущий шаг ввода

  const [coords, setCoords] = useState<[number, number]>([
    55.7558, // Москва по умолчанию
    37.6173,
  ]);

  const mapRef = useRef<any>(null);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualGeocodeRef = useRef(false); // Флаг, чтобы не вызывать геокодирование при программном обновлении полей
  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const streetInputRef = useRef<HTMLInputElement | null>(null);

  // хук из библиотеки, чтобы иметь доступ к ymaps API после загрузки
  const ymaps = useYMaps(["geocode", "suggest"]);

  // Загрузка адресов из БД
  const loadAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/addresses");
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses || []);
        if (data.addresses && data.addresses.length > 0) {
          const defaultAddr = data.addresses.find((a: Address) => a.is_default) || data.addresses[0];
          setSelectedId(defaultAddr.id);
        }
      }
    } catch (e) {
      console.error("Failed to load addresses:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep("list");
      setCity("");
      setStreet("");
      setSelectedCityCoords(null);
      setCitySuggestions([]);
      setStreetSuggestions([]);
      setShowCitySuggestions(false);
      setShowStreetSuggestions(false);
      setCurrentStep("city");
      loadAddresses();
    }
  }, [isOpen, loadAddresses]);

  // Проверка, содержит ли адрес дом (число в адресе)
  const hasHouseNumber = (address: string): boolean => {
    if (!address.trim()) return false;
    // Проверяем наличие чисел или паттернов типа "д.", "дом", "к.", "корп."
    const housePattern = /\d+|д\.|дом|к\.|корп\.|лит\.|стр\./i;
    return housePattern.test(address);
  };

  // Проверка доступности Yandex Maps API
  useEffect(() => {
    if (step === "add" && ymaps === null) {
      console.warn("Yandex Maps API is not loaded yet. Waiting for initialization...");
    } else if (step === "add" && ymaps) {
      console.log("Yandex Maps API is ready");
    }
  }, [ymaps, step]);

  // Функция для получения подсказок городов
  const fetchCitySuggestions = useCallback((query: string) => {
    if (!ymaps || !query.trim() || query.length < 2) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }

    // Очищаем предыдущий таймаут
    if (suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current);
    }

    suggestTimeoutRef.current = setTimeout(() => {
      // Используем геокодирование для поиска городов
      ymaps
        ?.geocode(query, { results: 10 })
        .then((res: any) => {
          if (res && res.geoObjects) {
            const suggestions: string[] = [];
            res.geoObjects.each((geoObject: any) => {
              const metaData = geoObject.properties.get("metaDataProperty")?.GeocoderMetaData;
              const addressComponents = metaData?.Address?.Components || [];
              
              // Ищем город в компонентах адреса
              addressComponents.forEach((component: any) => {
                if ((component.kind === "locality" || component.kind === "area" || component.kind === "province") && 
                    component.name && 
                    !suggestions.includes(component.name)) {
                  suggestions.push(component.name);
                }
              });
            });
            
            // Если не нашли через компоненты, пытаемся извлечь из названия
            if (suggestions.length === 0) {
              res.geoObjects.each((geoObject: any) => {
                const name = geoObject.properties.get("name");
                const text = geoObject.properties.get("text");
                const firstPart = text?.split(",")[0]?.trim() || name;
                if (firstPart && !suggestions.includes(firstPart)) {
                  suggestions.push(firstPart);
                }
              });
            }
            
            setCitySuggestions(suggestions.slice(0, 7));
            setShowCitySuggestions(suggestions.length > 0);
          }
        })
        .catch(() => {
          setCitySuggestions([]);
          setShowCitySuggestions(false);
        });
    }, 300);
  }, [ymaps]);

  // Функция для получения подсказок улиц
  const fetchStreetSuggestions = useCallback((query: string, cityName: string) => {
    if (!ymaps || !query.trim() || query.length < 2 || !cityName) {
      setStreetSuggestions([]);
      setShowStreetSuggestions(false);
      return;
    }

    // Очищаем предыдущий таймаут
    if (suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current);
    }

    suggestTimeoutRef.current = setTimeout(() => {
      const fullQuery = `${cityName}, ${query}`;
      
      ymaps
        ?.geocode(fullQuery, { results: 10 })
        .then((res: any) => {
          if (res && res.geoObjects) {
            const suggestions: string[] = [];
            res.geoObjects.each((geoObject: any) => {
              const address = geoObject.properties.get("text");
              if (address) {
                // Извлекаем улицу и дом из адреса
                const parts = address.split(",");
                if (parts.length > 1) {
                  const streetPart = parts.slice(1).join(",").trim();
                  if (streetPart && !suggestions.includes(streetPart)) {
                    suggestions.push(streetPart);
                  }
                }
              }
            });
            setStreetSuggestions(suggestions.slice(0, 7));
            setShowStreetSuggestions(suggestions.length > 0);
          }
        })
        .catch(() => {
          setStreetSuggestions([]);
          setShowStreetSuggestions(false);
        });
    }, 300);
  }, [ymaps]);

  // Обработчик изменения города
  const handleCityChange = useCallback((value: string) => {
    setCity(value);
    setStreet(""); // Очищаем улицу при изменении города
    setShowStreetSuggestions(false);
    
    if (value.trim().length >= 2) {
      fetchCitySuggestions(value);
    } else {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  }, [fetchCitySuggestions]);

  // Обработчик выбора города из подсказок
  const handleCitySelect = useCallback((selectedCity: string) => {
    setCity(selectedCity);
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    
    // Геокодируем выбранный город для получения координат
    if (ymaps) {
      ymaps
        .geocode(selectedCity, { results: 1, kind: "locality" })
        .then((res: any) => {
          if (res && res.geoObjects) {
            const firstGeoObject = res.geoObjects.get(0);
            if (firstGeoObject) {
              const position = firstGeoObject.geometry.getCoordinates();
              setSelectedCityCoords(position as [number, number]);
              setCoords(position as [number, number]);
              
              // Обновляем центр карты
              if (mapRef.current) {
                mapRef.current.setCenter(position, 11);
              }
            }
          }
        })
        .catch(() => {});
    }
    
    // Переходим к вводу улицы
    setCurrentStep("street");
    
    // Фокусируемся на поле улицы
    setTimeout(() => {
      streetInputRef.current?.focus();
    }, 100);
  }, [ymaps]);

  // Обработчик изменения улицы
  const handleStreetChange = useCallback((value: string) => {
    setStreet(value);
    
    if (value.trim().length >= 2 && city) {
      fetchStreetSuggestions(value, city);
    } else {
      setStreetSuggestions([]);
      setShowStreetSuggestions(false);
    }
  }, [city, fetchStreetSuggestions]);

  // Обработчик выбора улицы из подсказок
  const handleStreetSelect = useCallback((selectedStreet: string) => {
    setStreet(selectedStreet);
    setStreetSuggestions([]);
    setShowStreetSuggestions(false);
    
    // Геокодируем полный адрес
    const fullAddress = `${city}, ${selectedStreet}`;
    if (ymaps) {
      isManualGeocodeRef.current = true;
      ymaps
        .geocode(fullAddress, { results: 1 })
        .then((res: any) => {
          if (res && res.geoObjects) {
            const firstGeoObject = res.geoObjects.get(0);
            if (firstGeoObject) {
              const position = firstGeoObject.geometry.getCoordinates();
              setCoords(position as [number, number]);
              
              // Обновляем центр карты
              if (mapRef.current) {
                mapRef.current.setCenter(position, 17);
              }
            }
          }
          setTimeout(() => {
            isManualGeocodeRef.current = false;
          }, 100);
        })
        .catch(() => {
          isManualGeocodeRef.current = false;
        });
    }
  }, [city, ymaps]);

  const handleSelect = (addr: Address) => {
    setSelectedId(addr.id);
    onSelectAddress(addr.address_line);
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>, addrId: number) => {
    e.stopPropagation();
    if (!confirm("Удалить этот адрес?")) return;

    try {
      console.log("[AddressModal] Deleting address with id:", addrId);
      const res = await fetch(`/api/addresses/${addrId}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        console.log("[AddressModal] Address deleted successfully");
        await loadAddresses();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("[AddressModal] Failed to delete address:", res.status, errorData);
        alert(`Не удалось удалить адрес: ${errorData.error || "Неизвестная ошибка"}`);
      }
    } catch (err) {
      console.error("[AddressModal] Failed to delete address:", err);
      alert("Ошибка при удалении адреса. Проверьте консоль для деталей.");
    }
  };

  // Функция геокодирования (из адреса в координаты)
  const handleGeocode = useCallback((showAlert = false) => {
    const fullAddress = `${city}, ${street}`.trim();

    if (!ymaps) {
      if (showAlert) {
        console.error("Yandex Maps API is not available");
        alert("Карты Яндекс не загружены. Пожалуйста, подождите немного и попробуйте снова.");
      }
      return;
    }

    if (fullAddress.length === 0) {
      if (showAlert) {
        alert("Введите адрес для поиска");
      }
      return;
    }

    try {
      ymaps
        .geocode(fullAddress, { results: 1 })
        .then((res: any) => {
          if (!res || !res.geoObjects) {
            if (showAlert) {
              console.warn("Geocoding response is invalid:", res);
              alert("Не удалось найти адрес. Попробуйте уточнить адрес.");
            }
            return;
          }

          const firstGeoObject = res.geoObjects.get(0);
          if (firstGeoObject) {
            const position = firstGeoObject.geometry.getCoordinates();
            setCoords(position as [number, number]);
            
            // Обновляем центр карты
            if (mapRef.current) {
              mapRef.current.setCenter(position, 15);
            }
          } else {
            if (showAlert) {
              console.warn("No geo objects found for address:", fullAddress);
              alert("Адрес не найден. Попробуйте уточнить адрес.");
            }
          }
        })
        .catch((error: any) => {
          if (showAlert) {
            console.error("Geocoding error:", error);
            alert("Не удалось найти адрес. Проверьте правильность ввода или попробуйте позже.");
          }
        });
    } catch (error: any) {
      if (showAlert) {
        console.error("Unexpected error in handleGeocode:", error);
        alert("Произошла неожиданная ошибка при поиске адреса.");
      }
    }
  }, [city, street, ymaps]);

  // Функция обратного геокодирования (из координат в адрес)
  const handleReverseGeocode = useCallback((coordinates: [number, number]) => {
    if (!ymaps) {
      console.error("Yandex Maps API is not available");
      return;
    }

    try {
      isManualGeocodeRef.current = true; // Устанавливаем флаг, чтобы не вызвать автоматическое геокодирование
      
      ymaps
        .geocode(coordinates, { results: 1 })
        .then((res: any) => {
          if (!res || !res.geoObjects) {
            console.warn("Reverse geocoding response is invalid:", res);
            return;
          }

          const firstGeoObject = res.geoObjects.get(0);
          if (firstGeoObject) {
            const addressComponents = firstGeoObject.properties.get("metaDataProperty")?.GeocoderMetaData?.Address?.Components || [];
            
            // Парсим компоненты адреса
            let foundCity = "";
            let foundStreet = "";
            
            addressComponents.forEach((component: any) => {
              if (component.kind === "locality" || component.kind === "area") {
                foundCity = component.name;
              } else if (component.kind === "street" || component.kind === "route") {
                foundStreet = component.name;
              } else if (component.kind === "house") {
                foundStreet = `${foundStreet} ${component.name}`.trim();
              }
            });

            // Если не нашли город, используем из полного адреса
            if (!foundCity) {
              const fullAddress = firstGeoObject.properties.get("text") || "";
              const parts = fullAddress.split(",");
              if (parts.length > 0) {
                foundCity = parts[0].trim();
              }
            }

            // Если не нашли улицу, пытаемся извлечь из полного адреса
            if (!foundStreet) {
              const fullAddress = firstGeoObject.properties.get("text") || "";
              const parts = fullAddress.split(",");
              if (parts.length > 1) {
                foundStreet = parts.slice(1).join(",").trim();
              }
            }

            // Обновляем поля формы
            if (foundCity) setCity(foundCity);
            if (foundStreet) setStreet(foundStreet);

            setTimeout(() => {
              isManualGeocodeRef.current = false; // Сбрасываем флаг через небольшую задержку
            }, 100);
          }
        })
        .catch((error: any) => {
          console.error("Reverse geocoding error:", error);
          isManualGeocodeRef.current = false;
        });
    } catch (error: any) {
      console.error("Unexpected error in handleReverseGeocode:", error);
      isManualGeocodeRef.current = false;
    }
  }, [ymaps]);

  // Обработчик клика на карту
  const handleMapClick = useCallback((event: any) => {
    if (!ymaps || !event) return;
    
    const coordinates = event.get("coords") as [number, number];
    if (coordinates && coordinates.length === 2) {
      setCoords(coordinates);
      handleReverseGeocode(coordinates);
      
      // Обновляем центр карты и приближаем
      if (mapRef.current) {
        mapRef.current.setCenter(coordinates, 17);
      }
    }
  }, [ymaps, handleReverseGeocode]);

  // Обновление центра карты при изменении координат и настройка обработчика клика
  useEffect(() => {
    if (mapRef.current && step === "add") {
      // Обновляем центр карты
      mapRef.current.setCenter(coords, 15);
      
      // Добавляем обработчик клика, если его еще нет
      if (mapRef.current.events && !mapRef.current._clickHandlerAdded) {
        mapRef.current.events.add("click", handleMapClick);
        mapRef.current._clickHandlerAdded = true;
      }
    }
    
    return () => {
      // Очищаем обработчик при размонтировании
      if (mapRef.current?.events && mapRef.current._clickHandlerAdded) {
        mapRef.current.events.remove("click", handleMapClick);
        mapRef.current._clickHandlerAdded = false;
      }
    };
  }, [coords, step, handleMapClick]);

  // Автоматическое геокодирование при изменении улицы (только если город выбран)
  useEffect(() => {
    if (step !== "add" || !ymaps || !city || !street) return;
    
    // Пропускаем, если это программное обновление полей
    if (isManualGeocodeRef.current) return;

    // Очищаем предыдущий таймаут
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    // Устанавливаем новый таймаут для debounce (800мс) - больше, чем для подсказок
    geocodeTimeoutRef.current = setTimeout(() => {
      const fullAddress = `${city}, ${street}`.trim();
      if (fullAddress.length > 5) { // Минимум 5 символов для поиска
        handleGeocode(false); // Не показываем alert при автоматическом поиске
      }
    }, 800);

    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, [street, city, step, ymaps, handleGeocode]);

  const handleSaveNewAddress = async () => {
    // Формируем полный адрес: улица и дом, город
    const addressLine = street.trim().length > 0 
      ? `${street.trim()}, ${city.trim()}`
      : `${city.trim()}`;

    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address_line: addressLine,
          city: city.trim(),
          latitude: coords[0],
          longitude: coords[1],
        }),
      });

      if (res.ok) {
        await loadAddresses();
        onSelectAddress(addressLine);
        onClose();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to save address:", res.status, errorData);
        
        if (res.status === 401) {
          alert("Необходимо авторизоваться для сохранения адреса");
        } else {
          alert(`Не удалось сохранить адрес: ${errorData.error || "Неизвестная ошибка"}`);
        }
      }
    } catch (e: any) {
      console.error("Failed to save address:", e);
      alert("Ошибка при сохранении адреса. Проверьте консоль для деталей.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-3xl rounded-[32px] bg-white p-6 sm:p-8 shadow-vilka-soft">
        {/* Верхняя панель */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === "list" ? onClose() : setStep("list"))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-900">
            {step === "list" ? "Выбрать адрес" : "Добавить адрес"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "list" ? (
          <>
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Загрузка адресов...
              </div>
            ) : addresses.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                У вас пока нет сохраненных адресов
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {addresses.map((addr) => {
                  const selected = addr.id === selectedId;
                  return (
                    <div
                      key={addr.id}
                      className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 transition ${
                        selected ? "bg-surface-soft" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(addr)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {addr.address_line}
                        </div>
                        {(addr.city || addr.comment) && (
                          <div className="text-xs text-slate-500">
                            {[addr.city, addr.comment].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleDelete(e, addr.id)}
                        className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Удалить адрес"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep("add")}
              className="vilka-btn-primary mt-6 w-full py-3 text-sm font-semibold"
            >
              Новый адрес
            </button>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              {/* Карта */}
              <div className="relative h-72 rounded-3xl">
                  <Map
                    instanceRef={(ref: any) => {
                      mapRef.current = ref;
                    }}
                    defaultState={{
                      center: coords,
                      zoom: 12,
                    }}
                    width="100%"
                    height="100%"
                  >
                    <Placemark geometry={coords} />
                  </Map>
              </div>

              {/* Форма */}
              <div className="flex flex-col gap-3">
                {/* Шаг 1: Ввод города */}
                {currentStep === "city" && (
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-500">
                      Город
                    </label>
                    <div className="relative">
                      <input
                        ref={cityInputRef}
                        type="text"
                        value={city}
                        onChange={(e: { target: { value: string } }) => handleCityChange(e.target.value)}
                        onFocus={() => {
                          if (city.length >= 2) {
                            setShowCitySuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          // Задержка, чтобы клик по подсказке успел сработать
                          setTimeout(() => setShowCitySuggestions(false), 200);
                        }}
                        placeholder="Введите город"
                        className="mt-1 w-full rounded-2xl bg-surface-soft px-3 py-2 text-sm text-slate-900"
                        autoFocus
                      />
                    </div>
                    {showCitySuggestions && citySuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-2xl bg-white shadow-lg border border-slate-200 max-h-48 overflow-y-auto">
                        {citySuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleCitySelect(suggestion)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-surface-soft transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                          >
                            <div className="font-semibold text-slate-900">{suggestion}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Шаг 2: Ввод улицы */}
                {currentStep === "street" && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep("city");
                        setStreet("");
                        setStreetSuggestions([]);
                        setShowStreetSuggestions(false);
                      }}
                      className="mb-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Изменить город: {city}</span>
                    </button>
                    <label className="text-xs font-semibold text-slate-500">
                      Улица и дом
                    </label>
                    <div className="relative">
                      <input
                        ref={streetInputRef}
                        type="text"
                        value={street}
                        onChange={(e: { target: { value: string } }) => handleStreetChange(e.target.value)}
                        onFocus={() => {
                          if (street.length >= 2 && city) {
                            setShowStreetSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowStreetSuggestions(false), 200);
                        }}
                        placeholder="Введите улицу и дом"
                        className="mt-1 w-full rounded-2xl bg-surface-soft px-3 py-2 text-sm text-slate-900"
                        autoFocus
                      />
                    </div>
                    {showStreetSuggestions && streetSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-2xl bg-white shadow-lg border border-slate-200 max-h-48 overflow-y-auto">
                        {streetSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleStreetSelect(suggestion)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-surface-soft transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                          >
                            <div className="font-semibold text-slate-900">{suggestion}</div>
                            <div className="text-xs text-slate-500">{city}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveNewAddress}
              disabled={!city || !street || !hasHouseNumber(street)}
              className={`mt-6 w-full py-3 text-sm font-semibold rounded-full transition-colors ${
                city && street && hasHouseNumber(street)
                  ? "vilka-btn-primary"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              Сохранить адрес
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const AddressModal: React.FC<AddressModalProps> = (props) => {
  if (!props.isOpen) return null;

  // Получаем API ключ из переменной окружения или используем пустую строку
  const yandexApiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "";

  return (
    <YMaps 
      query={yandexApiKey ? { apikey: yandexApiKey } : undefined}
      onError={(error: any) => {
        // Детальное логирование ошибки
        console.error("Yandex Maps initialization error:", {
          error,
          errorType: typeof error,
          errorString: String(error),
          errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          hasApiKey: !!yandexApiKey,
        });
      }}
    >
      <AddressModalContent {...props} />
    </YMaps>
  );
};

export default AddressModal;
