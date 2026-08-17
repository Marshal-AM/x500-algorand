export class CityNotFoundError extends Error {
  constructor(public readonly city: string) {
    super(`City not found: ${city}`);
    this.name = "CityNotFoundError";
  }
}

export interface CityWeather {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPercent: number;
  precipitationMm: number;
  windSpeedKmh: number;
  weatherDescription: string;
  observedAt: string;
  source: "open-meteo";
}

/** WMO Weather interpretation codes (WW). */
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function wmoDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? "Unknown";
}

interface GeocodingResponse {
  results?: Array<{
    name: string;
    country: string;
    latitude: number;
    longitude: number;
  }>;
}

interface ForecastResponse {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${url}`);
  }
  return (await res.json()) as T;
}

export async function fetchCityWeather(city: string): Promise<CityWeather> {
  const query = city.trim();
  if (!query) {
    throw new Error("City name is required");
  }

  const geoUrl =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const geo = await fetchJson<GeocodingResponse>(geoUrl);
  const place = geo.results?.[0];
  if (!place) {
    throw new CityNotFoundError(query);
  }

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&timezone=auto`;
  const forecast = await fetchJson<ForecastResponse>(forecastUrl);
  const current = forecast.current;
  if (!current) {
    throw new Error(`No current weather data for ${query}`);
  }

  return {
    city: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    temperatureC: current.temperature_2m,
    apparentTemperatureC: current.apparent_temperature,
    humidityPercent: current.relative_humidity_2m,
    precipitationMm: current.precipitation,
    windSpeedKmh: current.wind_speed_10m,
    weatherDescription: wmoDescription(current.weather_code),
    observedAt: current.time,
    source: "open-meteo",
  };
}
