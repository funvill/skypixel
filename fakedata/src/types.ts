export interface AverageColor {
  r: number;
  g: number;
  b: number;
}

export type CachePolicy = 'prefer-cache' | 'refresh';
export type SpiralPattern = 'even' | 'vogel';

export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface WeatherResponse {
  timezone: string;
  hourly: {
    time: string[];
    temperature_2m: Array<number | null>;
    relative_humidity_2m: Array<number | null>;
    cloud_cover: Array<number | null>;
    precipitation: Array<number | null>;
    rain: Array<number | null>;
    snowfall: Array<number | null>;
    shortwave_radiation: Array<number | null>;
    weather_code: Array<number | null>;
    visibility: Array<number | null>;
    wind_speed_10m: Array<number | null>;
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

export interface WeatherAtTime {
  weatherCode: number;
  cloudCover: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  shortwaveRadiation: number;
  temperature: number;
  humidity: number;
  visibility: number;
  windSpeed: number;
  solarPhase: number;
  daylightRatio: number;
  dayLengthMinutes: number;
  minutesFromSunrise: number;
  minutesToSunset: number;
}

export interface PreparedWeather {
  raw: WeatherResponse;
  hourlyDates: LocalDateTime[];
  hourlyTicks: number[];
  dayIndex: Map<string, number>;
}

export interface GeneratedRecord {
  timestamp: string;
  average: AverageColor;
  source: 'synthetic-weather';
  confidence: number;
  weather: {
    weatherCode: number;
    cloudCover: number;
    precipitation: number;
    snowfall: number;
    shortwaveRadiation: number;
    temperature: number;
    humidity: number;
    visibility: number;
    windSpeed: number;
    solarPhase: number;
    daylightRatio: number;
    dayLengthMinutes: number;
    minutesFromSunrise: number;
    minutesToSunset: number;
  };
}

export interface SvgConfig {
  inputFile: string;
  outputFile?: string;
  boxSize?: number;
  settings: ProjectSettings;
}

export interface SpiralSvgConfig {
  inputFile: string;
  outputFile?: string;
  pattern?: SpiralPattern;
  settings: ProjectSettings;
}

export interface GeneratorConfig {
  title: string;
  latitude: number;
  longitude: number;
  timezone: string;
  year: number;
  outputRoot: string;
}

export interface ProjectLocationSettings {
  title: string;
  latitude: number;
  longitude: number;
  timezone: string;
  year: number;
}

export interface GeneratorWeatherSettings {
  cachePolicy: CachePolicy;
  apiBaseUrl: string;
  transitionMinutes: number;
  visibilityFallbackMeters: number;
}

export interface GeneratorPaletteSettings {
  preDawn: AverageColor;
  dawnGray: AverageColor;
  sunriseWarm: AverageColor;
  dayBlue: AverageColor;
  dusk: AverageColor;
  twilightGray: AverageColor;
  night: AverageColor;
}

export interface GeneratorLightingSettings {
  radiationStrength: number;
  cloudDarkeningStrength: number;
  moistureDarkeningStrength: number;
  exposureStrength: number;
  summerDayCoreFlatteningStrength: number;
  rendererDayCoreDarkeningStrength: number;
  seasonalSaturationBase: number;
  seasonalSaturationAmplitude: number;
}

export interface GeneratorTransitionSettings {
  dawnDuskJitterStrength: number;
  warmthStrength: number;
  coolStrength: number;
  featherStrength: number;
  occlusionStrength: number;
  ambientStrength: number;
}

export interface GeneratorCameraSettings {
  dayCoolStrength: number;
  twilightCoolStrength: number;
  grayCloudStrength: number;
  lowLightJitterStrength: number;
}

export interface GeneratorMoonSettings {
  brightness: number;
  blueBoost: number;
  flareStrength: number;
}

export interface GeneratorNoiseSettings {
  daylightJitterStrength: number;
  nightJitterMultiplier: number;
}

export interface GeneratorConfidenceSettings {
  min: number;
  max: number;
}

export interface GeneratorModelSettings {
  weather: GeneratorWeatherSettings;
  palette: GeneratorPaletteSettings;
  lighting: GeneratorLightingSettings;
  transition: GeneratorTransitionSettings;
  camera: GeneratorCameraSettings;
  moon: GeneratorMoonSettings;
  noise: GeneratorNoiseSettings;
  confidence: GeneratorConfidenceSettings;
}

export interface DayGridRenderSettings {
  boxSize: number;
  exportPng: boolean;
  leftMarginScale: number;
  topMarginScale: number;
  mirrorLegendBorder: boolean;
  edgeShiftEarlyColumns: number;
  edgeShiftLateColumns: number;
  edgeJitterStrength: number;
  sunriseGlowIntensity: number;
  sunsetGlowIntensity: number;
  sunriseGlowColor: AverageColor;
  sunsetGlowColor: AverageColor;
  sunriseGlowHighlightColor: AverageColor;
  sunsetGlowHighlightColor: AverageColor;
  sunriseGrayColor: AverageColor;
  sunsetGrayColor: AverageColor;
  sunsetGrayAmount: number;
  sunsetGrayBlueStrength: number;
  sunsetAfterglowIntensity: number;
  sunsetAfterglowCenterColumns: number;
  sunsetAfterglowReachColumns: number;
  sunsetAfterglowColor: AverageColor;
}

export interface SpiralEvenRenderSettings {
  circleRadius: number;
  strokeWidth: number;
  strokeColor: string;
  backgroundColor: string;
  b: number;
  maxThetaStep: number;
  chord: number;
}

export interface SpiralVogelRenderSettings {
  circleRadius: number;
  strokeWidth: number;
  strokeColor: string;
  backgroundColor: string;
  spacingFactor: number;
  goldenAngle: number;
}

export interface SpiralRenderSettings {
  defaultPattern: SpiralPattern;
  even: SpiralEvenRenderSettings;
  vogel: SpiralVogelRenderSettings;
}

export interface RenderSettings {
  dayGrid: DayGridRenderSettings;
  spiral: SpiralRenderSettings;
}

export interface ProjectSettings {
  location: ProjectLocationSettings;
  generator: GeneratorModelSettings;
  render: RenderSettings;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};