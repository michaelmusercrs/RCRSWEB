/**
 * Weather Service - Real-time weather data using Open-Meteo (free, no API key needed)
 *
 * Features:
 * - 7-day forecast for customer's area
 * - Current conditions with workability assessment
 * - NWS weather alerts integration
 * - Hail reports tracking
 * - Storm risk indicators for scheduling
 * - Zip code support
 */

interface GeoJSONFeature {
  properties: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry: { type: string; coordinates: any[] };
}

// Zip code to coordinates mapping for common Alabama zip codes
const ZIP_CODES: Record<string, { lat: number; lon: number; city: string; state: string }> = {
  // Hartselle area
  '35640': { lat: 34.4434, lon: -86.9353, city: 'Hartselle', state: 'AL' },
  // Decatur area
  '35601': { lat: 34.6059, lon: -86.9833, city: 'Decatur', state: 'AL' },
  '35602': { lat: 34.6059, lon: -86.9833, city: 'Decatur', state: 'AL' },
  '35603': { lat: 34.5765, lon: -87.0217, city: 'Decatur', state: 'AL' },
  // Huntsville area
  '35801': { lat: 34.7304, lon: -86.5861, city: 'Huntsville', state: 'AL' },
  '35802': { lat: 34.6875, lon: -86.5833, city: 'Huntsville', state: 'AL' },
  '35803': { lat: 34.6548, lon: -86.5478, city: 'Huntsville', state: 'AL' },
  '35805': { lat: 34.7195, lon: -86.6264, city: 'Huntsville', state: 'AL' },
  '35806': { lat: 34.7565, lon: -86.6628, city: 'Huntsville', state: 'AL' },
  '35810': { lat: 34.7945, lon: -86.5881, city: 'Huntsville', state: 'AL' },
  '35811': { lat: 34.8215, lon: -86.5261, city: 'Huntsville', state: 'AL' },
  '35816': { lat: 34.7545, lon: -86.5161, city: 'Huntsville', state: 'AL' },
  // Madison area
  '35756': { lat: 34.6993, lon: -86.7483, city: 'Madison', state: 'AL' },
  '35757': { lat: 34.7376, lon: -86.7181, city: 'Madison', state: 'AL' },
  '35758': { lat: 34.7593, lon: -86.7528, city: 'Madison', state: 'AL' },
  // Athens area
  '35611': { lat: 34.8026, lon: -86.9717, city: 'Athens', state: 'AL' },
  '35613': { lat: 34.7348, lon: -87.0217, city: 'Athens', state: 'AL' },
  // Cullman area
  '35055': { lat: 34.1748, lon: -86.8436, city: 'Cullman', state: 'AL' },
  '35057': { lat: 34.1748, lon: -86.8436, city: 'Cullman', state: 'AL' },
  '35058': { lat: 34.1748, lon: -86.8436, city: 'Cullman', state: 'AL' },
  // Birmingham area
  '35203': { lat: 33.5207, lon: -86.8025, city: 'Birmingham', state: 'AL' },
  '35205': { lat: 33.4960, lon: -86.7969, city: 'Birmingham', state: 'AL' },
  '35209': { lat: 33.4784, lon: -86.7994, city: 'Birmingham', state: 'AL' },
  // Florence area
  '35630': { lat: 34.7998, lon: -87.6772, city: 'Florence', state: 'AL' },
  '35633': { lat: 34.7998, lon: -87.6772, city: 'Florence', state: 'AL' },
  // Muscle Shoals area
  '35661': { lat: 34.7445, lon: -87.6675, city: 'Muscle Shoals', state: 'AL' },
  // Albertville area
  '35950': { lat: 34.2673, lon: -86.2086, city: 'Albertville', state: 'AL' },
  '35951': { lat: 34.2673, lon: -86.2086, city: 'Albertville', state: 'AL' },
  // Guntersville area
  '35976': { lat: 34.3582, lon: -86.2947, city: 'Guntersville', state: 'AL' },
  // Scottsboro area
  '35768': { lat: 34.6723, lon: -86.0341, city: 'Scottsboro', state: 'AL' },
  // Moulton area
  '35650': { lat: 34.4812, lon: -87.2919, city: 'Moulton', state: 'AL' },
  // Priceville / Morgan County
  '35671': { lat: 34.5252, lon: -86.8786, city: 'Priceville', state: 'AL' },
  // Tennessee - Nashville area
  '37201': { lat: 36.1627, lon: -86.7816, city: 'Nashville', state: 'TN' },
  '37203': { lat: 36.1531, lon: -86.7935, city: 'Nashville', state: 'TN' },
  '37205': { lat: 36.1178, lon: -86.8644, city: 'Nashville', state: 'TN' },
  '37209': { lat: 36.1561, lon: -86.8753, city: 'Nashville', state: 'TN' },
  '37211': { lat: 36.0786, lon: -86.7294, city: 'Nashville', state: 'TN' },
  '37214': { lat: 36.1661, lon: -86.6639, city: 'Nashville', state: 'TN' },
  '37215': { lat: 36.0839, lon: -86.8136, city: 'Nashville', state: 'TN' },
  '37217': { lat: 36.1181, lon: -86.6372, city: 'Nashville', state: 'TN' },
  '37220': { lat: 36.0539, lon: -86.7817, city: 'Nashville', state: 'TN' },
  // Tennessee - Chattanooga area
  '37402': { lat: 35.0456, lon: -85.3097, city: 'Chattanooga', state: 'TN' },
  '37405': { lat: 35.0659, lon: -85.3542, city: 'Chattanooga', state: 'TN' },
  '37411': { lat: 35.0159, lon: -85.2322, city: 'Chattanooga', state: 'TN' },
  // Tennessee - Murfreesboro area
  '37129': { lat: 35.8456, lon: -86.3903, city: 'Murfreesboro', state: 'TN' },
  '37130': { lat: 35.8785, lon: -86.3656, city: 'Murfreesboro', state: 'TN' },
  // Tennessee - Clarksville
  '37040': { lat: 36.5298, lon: -87.3595, city: 'Clarksville', state: 'TN' },
  '37042': { lat: 36.5298, lon: -87.3595, city: 'Clarksville', state: 'TN' },
  // Tennessee - Franklin / Brentwood
  '37064': { lat: 35.9251, lon: -86.8689, city: 'Franklin', state: 'TN' },
  '37027': { lat: 36.0331, lon: -86.7828, city: 'Brentwood', state: 'TN' },
  // Georgia - Atlanta suburbs (north)
  '30301': { lat: 33.7490, lon: -84.3880, city: 'Atlanta', state: 'GA' },
  '30024': { lat: 34.0707, lon: -84.0739, city: 'Suwanee', state: 'GA' },
  '30043': { lat: 33.9559, lon: -84.0703, city: 'Lawrenceville', state: 'GA' },
};

export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  condition: string;
  icon: string;
  isWorkable: boolean;
  workabilityReason?: string;
}

export interface DayForecast {
  date: string;
  dayOfWeek: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  precipChance: number;
  windSpeed: number;
  windGust?: number;
  humidity?: number;
  uvIndex?: number;
  isWorkable: boolean;
  workabilityReason?: string;
}

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  urgency: string;
  expires: string;
  onset?: string;
  isHailRelated: boolean;
  affectsRoofing: boolean;
  type: 'storm' | 'hail' | 'wind' | 'flood' | 'temperature' | 'tornado' | 'other';
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: DayForecast[];
  alerts: WeatherAlert[];
  location: string;
  lastUpdated: string;
  stormRisk: StormRisk;
}

export interface StormRisk {
  level: 'low' | 'moderate' | 'high' | 'severe';
  message: string;
  hasActiveAlerts: boolean;
  hasHailRisk: boolean;
  nextBadWeatherDay?: string;
}

// Weather code to condition mapping
const WEATHER_CONDITIONS: Record<number, { condition: string; icon: string }> = {
  0: { condition: 'Clear', icon: 'sun' },
  1: { condition: 'Mainly Clear', icon: 'sun' },
  2: { condition: 'Partly Cloudy', icon: 'cloud-sun' },
  3: { condition: 'Overcast', icon: 'cloud' },
  45: { condition: 'Foggy', icon: 'cloud-fog' },
  48: { condition: 'Foggy', icon: 'cloud-fog' },
  51: { condition: 'Light Drizzle', icon: 'cloud-drizzle' },
  53: { condition: 'Drizzle', icon: 'cloud-drizzle' },
  55: { condition: 'Heavy Drizzle', icon: 'cloud-drizzle' },
  61: { condition: 'Light Rain', icon: 'cloud-rain' },
  63: { condition: 'Rain', icon: 'cloud-rain' },
  65: { condition: 'Heavy Rain', icon: 'cloud-rain' },
  71: { condition: 'Light Snow', icon: 'cloud-snow' },
  73: { condition: 'Snow', icon: 'cloud-snow' },
  75: { condition: 'Heavy Snow', icon: 'cloud-snow' },
  77: { condition: 'Snow Grains', icon: 'cloud-snow' },
  80: { condition: 'Light Showers', icon: 'cloud-rain' },
  81: { condition: 'Showers', icon: 'cloud-rain' },
  82: { condition: 'Heavy Showers', icon: 'cloud-rain' },
  85: { condition: 'Snow Showers', icon: 'cloud-snow' },
  86: { condition: 'Heavy Snow Showers', icon: 'cloud-snow' },
  95: { condition: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { condition: 'Thunderstorm with Hail', icon: 'cloud-lightning' },
  99: { condition: 'Severe Thunderstorm', icon: 'cloud-lightning' },
};

// Determine if weather is workable for roofing
function isWorkableWeather(
  precipChance: number,
  windSpeed: number,
  weatherCode: number,
  temp?: number
): { workable: boolean; reason?: string } {
  // Not workable conditions:
  // - Rain/thunderstorms (codes 61-99)
  // - High wind (>25 mph)
  // - High precipitation chance (>40%)
  // - Extreme temperatures (<40F or >100F)
  if (weatherCode >= 95) return { workable: false, reason: 'Thunderstorm conditions' };
  if (weatherCode >= 61 && weatherCode < 95) return { workable: false, reason: 'Precipitation expected' };
  if (windSpeed > 25) return { workable: false, reason: `High winds (${windSpeed} mph)` };
  if (precipChance > 40) return { workable: false, reason: `${precipChance}% chance of precipitation` };
  if (temp !== undefined && temp < 40) return { workable: false, reason: `Too cold (${temp}F)` };
  if (temp !== undefined && temp > 100) return { workable: false, reason: `Too hot (${temp}F)` };
  return { workable: true };
}

// Categorize alert type
function categorizeAlertType(event: string, description: string): 'storm' | 'hail' | 'wind' | 'flood' | 'temperature' | 'tornado' | 'other' {
  const lower = (event + ' ' + description).toLowerCase();
  if (lower.includes('tornado')) return 'tornado';
  if (lower.includes('hail')) return 'hail';
  if (lower.includes('thunder') || lower.includes('storm') || lower.includes('severe')) return 'storm';
  if (lower.includes('wind')) return 'wind';
  if (lower.includes('flood') || lower.includes('flash')) return 'flood';
  if (lower.includes('heat') || lower.includes('cold') || lower.includes('freeze')) return 'temperature';
  return 'other';
}

// Check if alert affects roofing work
function alertAffectsRoofing(event: string, description: string): boolean {
  const lower = (event + ' ' + description).toLowerCase();
  const affectingKeywords = ['hail', 'thunder', 'storm', 'wind', 'rain', 'tornado', 'ice', 'freeze', 'lightning'];
  return affectingKeywords.some(kw => lower.includes(kw));
}

class WeatherService {
  // Geocode zip code to coordinates
  geocodeZipCode(zipcode: string): { lat: number; lon: number; city: string; state: string } | null {
    // Clean zip code
    const cleanZip = zipcode.replace(/\D/g, '').slice(0, 5);

    // Check known zip codes
    if (ZIP_CODES[cleanZip]) {
      return ZIP_CODES[cleanZip];
    }

    // Approximate based on zip code prefix (first 3 digits)
    const prefix = cleanZip.slice(0, 3);
    const zipPrefixMap: Record<string, { lat: number; lon: number; city: string; state: string }> = {
      // Alabama prefixes (350-369)
      '350': { lat: 33.5207, lon: -86.8025, city: 'Birmingham', state: 'AL' },
      '351': { lat: 33.5207, lon: -86.8025, city: 'Birmingham', state: 'AL' },
      '352': { lat: 33.5207, lon: -86.8025, city: 'Birmingham', state: 'AL' },
      '354': { lat: 33.2098, lon: -87.5692, city: 'Tuscaloosa', state: 'AL' },
      '355': { lat: 34.1748, lon: -86.8436, city: 'Cullman', state: 'AL' },
      '356': { lat: 34.4434, lon: -86.9353, city: 'Hartselle', state: 'AL' },
      '357': { lat: 34.7304, lon: -86.5861, city: 'Huntsville', state: 'AL' },
      '358': { lat: 34.7304, lon: -86.5861, city: 'Huntsville', state: 'AL' },
      '359': { lat: 34.2673, lon: -86.2086, city: 'Gadsden', state: 'AL' },
      '360': { lat: 32.3792, lon: -86.3077, city: 'Montgomery', state: 'AL' },
      '361': { lat: 32.3792, lon: -86.3077, city: 'Montgomery', state: 'AL' },
      '362': { lat: 33.4274, lon: -86.0383, city: 'Anniston', state: 'AL' },
      '363': { lat: 31.2279, lon: -85.3905, city: 'Dothan', state: 'AL' },
      '364': { lat: 31.3271, lon: -85.8594, city: 'Enterprise', state: 'AL' },
      '365': { lat: 30.6954, lon: -88.0399, city: 'Mobile', state: 'AL' },
      '366': { lat: 30.6954, lon: -88.0399, city: 'Mobile', state: 'AL' },
      '367': { lat: 31.6520, lon: -87.8886, city: 'Selma', state: 'AL' },
      // Tennessee prefixes (370-385)
      '370': { lat: 36.1627, lon: -86.7816, city: 'Nashville', state: 'TN' },
      '371': { lat: 36.1627, lon: -86.7816, city: 'Nashville', state: 'TN' },
      '372': { lat: 36.1627, lon: -86.7816, city: 'Nashville', state: 'TN' },
      '373': { lat: 35.0456, lon: -85.3097, city: 'Chattanooga', state: 'TN' },
      '374': { lat: 35.0456, lon: -85.3097, city: 'Chattanooga', state: 'TN' },
      '375': { lat: 35.9606, lon: -83.9207, city: 'Knoxville', state: 'TN' },
      '376': { lat: 36.3134, lon: -82.3535, city: 'Johnson City', state: 'TN' },
      '377': { lat: 36.3134, lon: -82.3535, city: 'Johnson City', state: 'TN' },
      '378': { lat: 35.6145, lon: -88.8139, city: 'Jackson', state: 'TN' },
      '380': { lat: 35.1495, lon: -90.0490, city: 'Memphis', state: 'TN' },
      '381': { lat: 35.1495, lon: -90.0490, city: 'Memphis', state: 'TN' },
      '382': { lat: 35.8456, lon: -86.3903, city: 'Murfreesboro', state: 'TN' },
      '383': { lat: 36.5298, lon: -87.3595, city: 'Clarksville', state: 'TN' },
      '384': { lat: 35.3815, lon: -86.2816, city: 'Shelbyville', state: 'TN' },
      '385': { lat: 35.0419, lon: -85.6838, city: 'Cookeville', state: 'TN' },
      // Georgia prefixes (300-319)
      '300': { lat: 33.7490, lon: -84.3880, city: 'Atlanta', state: 'GA' },
      '301': { lat: 33.7490, lon: -84.3880, city: 'Atlanta', state: 'GA' },
      '303': { lat: 33.7490, lon: -84.3880, city: 'Atlanta', state: 'GA' },
      // Mississippi prefixes (386-397)
      '386': { lat: 34.2576, lon: -88.7034, city: 'Tupelo', state: 'MS' },
      '388': { lat: 34.7540, lon: -89.9968, city: 'Olive Branch', state: 'MS' },
      '390': { lat: 32.2988, lon: -90.1848, city: 'Jackson', state: 'MS' },
    };

    if (zipPrefixMap[prefix]) {
      return zipPrefixMap[prefix];
    }

    return null;
  }

  // Geocode address to coordinates (using simple lookup for Alabama cities)
  private geocodeAddress(address: string): { lat: number; lon: number; city: string; state: string } {
    const addressLower = address.toLowerCase();

    // First check if it looks like a zip code
    const zipMatch = address.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const zipResult = this.geocodeZipCode(zipMatch[1]);
      if (zipResult) return zipResult;
    }

    // Alabama city coordinates
    const cities: Record<string, { lat: number; lon: number; name: string }> = {
      'hartselle': { lat: 34.4434, lon: -86.9353, name: 'Hartselle' },
      'decatur': { lat: 34.6059, lon: -86.9833, name: 'Decatur' },
      'huntsville': { lat: 34.7304, lon: -86.5861, name: 'Huntsville' },
      'madison': { lat: 34.6993, lon: -86.7483, name: 'Madison' },
      'athens': { lat: 34.8026, lon: -86.9717, name: 'Athens' },
      'cullman': { lat: 34.1748, lon: -86.8436, name: 'Cullman' },
      'birmingham': { lat: 33.5207, lon: -86.8025, name: 'Birmingham' },
      'florence': { lat: 34.7998, lon: -87.6772, name: 'Florence' },
      'muscle shoals': { lat: 34.7445, lon: -87.6675, name: 'Muscle Shoals' },
      'albertville': { lat: 34.2673, lon: -86.2086, name: 'Albertville' },
      'guntersville': { lat: 34.3582, lon: -86.2947, name: 'Guntersville' },
      'scottsboro': { lat: 34.6723, lon: -86.0341, name: 'Scottsboro' },
      'moulton': { lat: 34.4812, lon: -87.2919, name: 'Moulton' },
      'nashville': { lat: 36.1627, lon: -86.7816, name: 'Nashville' },
      'chattanooga': { lat: 35.0456, lon: -85.3097, name: 'Chattanooga' },
      'murfreesboro': { lat: 35.8456, lon: -86.3903, name: 'Murfreesboro' },
      'clarksville': { lat: 36.5298, lon: -87.3595, name: 'Clarksville' },
      'franklin': { lat: 35.9251, lon: -86.8689, name: 'Franklin' },
      'atlanta': { lat: 33.7490, lon: -84.3880, name: 'Atlanta' },
      'tupelo': { lat: 34.2576, lon: -88.7034, name: 'Tupelo' },
    };

    // Map cities to their correct states
    const cityStateMap: Record<string, string> = {
      'nashville': 'TN', 'chattanooga': 'TN', 'murfreesboro': 'TN',
      'clarksville': 'TN', 'franklin': 'TN',
      'atlanta': 'GA',
      'tupelo': 'MS',
    };

    // Find matching city
    for (const [cityKey, coords] of Object.entries(cities)) {
      if (addressLower.includes(cityKey)) {
        const st = cityStateMap[cityKey] || 'AL';
        return { lat: coords.lat, lon: coords.lon, city: coords.name, state: st };
      }
    }

    // Default to Hartselle (company HQ)
    return { lat: 34.4434, lon: -86.9353, city: 'Hartselle', state: 'AL' };
  }

  // Get weather by zip code
  async getWeatherByZip(zipcode: string): Promise<WeatherData> {
    const location = this.geocodeZipCode(zipcode);
    if (location) {
      return this.getWeatherByCoords(location.lat, location.lon, location.city, location.state);
    }
    // Fall back to address-based lookup
    return this.getWeather(zipcode);
  }

  // Get weather by coordinates
  async getWeatherByCoords(lat: number, lon: number, city: string, state: string): Promise<WeatherData> {
    try {
      // Fetch from Open-Meteo API with more detailed data
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Chicago&forecast_days=7`
      );

      if (!response.ok) {
        throw new Error('Weather API error');
      }

      const data = await response.json();
      return this.parseWeatherResponse(data, lat, lon, city, state);
    } catch (error) {
      console.error('Weather service error:', error);
      return this.getFallbackWeather(city, state);
    }
  }

  // Parse weather API response
  private async parseWeatherResponse(
    data: {
      current: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        weather_code: number;
        wind_speed_10m: number;
        wind_gusts_10m?: number;
      };
      daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
        wind_speed_10m_max: number[];
        wind_gusts_10m_max?: number[];
        uv_index_max?: number[];
      };
    },
    lat: number,
    lon: number,
    city: string,
    state: string
  ): Promise<WeatherData> {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Parse current weather
    const currentCode = data.current.weather_code || 0;
    const currentCondition = WEATHER_CONDITIONS[currentCode] || { condition: 'Unknown', icon: 'cloud' };
    const currentWorkability = isWorkableWeather(
      0,
      data.current.wind_speed_10m,
      currentCode,
      data.current.temperature_2m
    );

    const current: CurrentWeather = {
      temp: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      humidity: Math.round(data.current.relative_humidity_2m),
      windSpeed: Math.round(data.current.wind_speed_10m),
      windGust: data.current.wind_gusts_10m ? Math.round(data.current.wind_gusts_10m) : undefined,
      condition: currentCondition.condition,
      icon: currentCondition.icon,
      isWorkable: currentWorkability.workable,
      workabilityReason: currentWorkability.reason,
    };

    // Parse forecast
    let nextBadWeatherDay: string | undefined;
    const forecast: DayForecast[] = data.daily.time.map((date: string, i: number) => {
      const weatherCode = data.daily.weather_code[i];
      const conditionData = WEATHER_CONDITIONS[weatherCode] || { condition: 'Unknown', icon: 'cloud' };
      const precipChance = data.daily.precipitation_probability_max[i] || 0;
      const windSpeed = Math.round(data.daily.wind_speed_10m_max[i]);
      const avgTemp = (data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2;
      const workability = isWorkableWeather(precipChance, windSpeed, weatherCode, avgTemp);

      // Track first bad weather day
      if (!workability.workable && !nextBadWeatherDay) {
        nextBadWeatherDay = date;
      }

      const dateObj = new Date(date + 'T12:00:00');
      const isToday = i === 0;

      return {
        date,
        dayOfWeek: isToday ? 'Today' : (i === 1 ? 'Tomorrow' : dayNames[dateObj.getDay()]),
        high: Math.round(data.daily.temperature_2m_max[i]),
        low: Math.round(data.daily.temperature_2m_min[i]),
        condition: conditionData.condition,
        icon: conditionData.icon,
        precipChance,
        windSpeed,
        windGust: data.daily.wind_gusts_10m_max ? Math.round(data.daily.wind_gusts_10m_max[i]) : undefined,
        uvIndex: data.daily.uv_index_max ? Math.round(data.daily.uv_index_max[i]) : undefined,
        isWorkable: workability.workable,
        workabilityReason: workability.reason,
      };
    });

    // Fetch NWS alerts for the area
    const alerts = await this.getAlerts(lat, lon);

    // Calculate storm risk
    const hasActiveAlerts = alerts.length > 0;
    const hasHailRisk = alerts.some(a => a.isHailRelated);
    const severeAlerts = alerts.filter(a => a.severity === 'severe' || a.severity === 'extreme');
    const badWeatherDays = forecast.filter(d => !d.isWorkable).length;

    let stormRiskLevel: StormRisk['level'] = 'low';
    let stormRiskMessage = 'Good conditions for roofing work';

    if (severeAlerts.length > 0) {
      stormRiskLevel = 'severe';
      stormRiskMessage = 'Severe weather alerts active. Avoid outdoor work.';
    } else if (hasHailRisk || alerts.some(a => a.severity === 'moderate')) {
      stormRiskLevel = 'high';
      stormRiskMessage = 'Weather warnings in effect. Monitor conditions closely.';
    } else if (hasActiveAlerts || badWeatherDays >= 3) {
      stormRiskLevel = 'moderate';
      stormRiskMessage = 'Some weather advisories. Plan scheduling accordingly.';
    }

    return {
      current,
      forecast,
      alerts,
      location: `${city}, ${state}`,
      lastUpdated: new Date().toISOString(),
      stormRisk: {
        level: stormRiskLevel,
        message: stormRiskMessage,
        hasActiveAlerts,
        hasHailRisk,
        nextBadWeatherDay,
      },
    };
  }

  // Fetch current weather and 7-day forecast by address
  async getWeather(address: string): Promise<WeatherData> {
    const { lat, lon, city, state } = this.geocodeAddress(address);
    return this.getWeatherByCoords(lat, lon, city, state);
  }

  // DEPRECATED: Old parsing - keeping for reference but not used
  private async _parseWeatherOld(address: string): Promise<WeatherData> {
    const { lat, lon, city, state } = this.geocodeAddress(address);

    try {
      // Fetch from Open-Meteo API
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Chicago&forecast_days=7`
      );

      if (!response.ok) {
        throw new Error('Weather API error');
      }

      const data = await response.json();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Parse current weather
      const currentCode = data.current.weather_code || 0;
      const currentCondition = WEATHER_CONDITIONS[currentCode] || { condition: 'Unknown', icon: 'cloud' };
      const workability = isWorkableWeather(0, data.current.wind_speed_10m, currentCode);

      const current: CurrentWeather = {
        temp: Math.round(data.current.temperature_2m),
        feelsLike: Math.round(data.current.apparent_temperature),
        humidity: Math.round(data.current.relative_humidity_2m),
        windSpeed: Math.round(data.current.wind_speed_10m),
        condition: currentCondition.condition,
        icon: currentCondition.icon,
        isWorkable: workability.workable,
        workabilityReason: workability.reason,
      };

      // Parse forecast
      const forecast: DayForecast[] = data.daily.time.map((date: string, i: number) => {
        const weatherCode = data.daily.weather_code[i];
        const conditionData = WEATHER_CONDITIONS[weatherCode] || { condition: 'Unknown', icon: 'cloud' };
        const precipChance = data.daily.precipitation_probability_max[i] || 0;
        const windSpeed = Math.round(data.daily.wind_speed_10m_max[i]);
        const workability = isWorkableWeather(precipChance, windSpeed, weatherCode);

        const dateObj = new Date(date + 'T12:00:00');
        const isToday = i === 0;

        return {
          date,
          dayOfWeek: isToday ? 'Today' : (i === 1 ? 'Tomorrow' : dayNames[dateObj.getDay()]),
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
          condition: conditionData.condition,
          icon: conditionData.icon,
          precipChance,
          windSpeed,
          isWorkable: workability.workable,
          workabilityReason: workability.reason,
        };
      });

      // Fetch NWS alerts for the area
      const alerts = await this.getAlerts(lat, lon);

      return {
        current,
        forecast,
        alerts,
        location: `${city}, ${state}`,
        lastUpdated: new Date().toISOString(),
        stormRisk: {
          level: 'low',
          message: 'Good conditions for roofing work',
          hasActiveAlerts: alerts.length > 0,
          hasHailRisk: alerts.some(a => a.isHailRelated),
        },
      };
    } catch (error) {
      console.error('Weather service error:', error);
      // Return fallback data
      return this.getFallbackWeather(city, state);
    }
  }

  // Fetch NWS weather alerts
  private async getAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
    try {
      // NWS alerts API
      const response = await fetch(
        `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
        {
          headers: {
            'User-Agent': 'RiverCityRoofing (contact@rcrsal.com)',
          },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();

      return (data.features || []).map((feature: Record<string, unknown>, index: number) => {
        const props = feature.properties as Record<string, unknown>;
        const event = (props.event as string) || '';
        const description = (props.description as string) || '';
        const isHailRelated = event.toLowerCase().includes('hail') ||
                             event.toLowerCase().includes('severe thunderstorm') ||
                             description.toLowerCase().includes('hail');

        let severity: WeatherAlert['severity'] = 'minor';
        if (props.severity === 'Extreme') severity = 'extreme';
        else if (props.severity === 'Severe') severity = 'severe';
        else if (props.severity === 'Moderate') severity = 'moderate';

        return {
          id: `alert-${index}-${Date.now()}`,
          event,
          headline: (props.headline as string) || event,
          description,
          severity,
          urgency: (props.urgency as string) || 'Unknown',
          expires: (props.expires as string) || '',
          onset: (props.onset as string) || undefined,
          isHailRelated,
          affectsRoofing: alertAffectsRoofing(event, description),
          type: categorizeAlertType(event, description),
        };
      });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return [];
    }
  }

  // Fetch hail reports from Iowa State Mesonet (free, comprehensive data)
  async getHailReports(
    address: string,
    daysBack: number = 30,
    radiusMiles: number = 50
  ): Promise<HailReport[]> {
    const { lat, lon } = this.geocodeAddress(address);

    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      // NWS offices covering AL, TN, GA, MS, and surrounding areas
      // HUN=Huntsville AL, BMX=Birmingham AL, OHX=Nashville TN,
      // MRX=Morristown TN, MEG=Memphis TN, FFC=Peachtree City GA,
      // JAN=Jackson MS, MOB=Mobile AL
      const response = await fetch(
        `https://mesonet.agron.iastate.edu/geojson/lsr.php?sts=${startStr}T00:00:00Z&ets=${endStr}T23:59:59Z&wfos=HUN,BMX,OHX,MRX,MEG,FFC,JAN,MOB&type=H`
      );

      if (!response.ok) return [];

      const data = await response.json();
      const reports: HailReport[] = [];

      if (data.features) {
        data.features.forEach((feature: GeoJSONFeature, index: number) => {
          const props = feature.properties;
          const coords = feature.geometry.coordinates;

          // Calculate distance
          const distance = this.calculateDistance(lat, lon, coords[1], coords[0]);

          // Only include reports within radius
          if (distance <= radiusMiles) {
            reports.push({
              id: `HAIL-${index}-${Date.now()}`,
              date: props.valid || props.utc_valid,
              location: props.city || 'Unknown Location',
              county: props.county || '',
              distance: Math.round(distance * 10) / 10,
              hailSize: props.magnitude ? `${props.magnitude}"` : 'Unknown',
              hailSizeNum: parseFloat(props.magnitude) || 0,
              source: 'NWS',
              severity: this.getHailSeverity(parseFloat(props.magnitude) || 0),
              latitude: coords[1],
              longitude: coords[0],
              remarks: props.remark || '',
            });
          }
        });
      }

      return reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error fetching hail reports:', error);
      return [];
    }
  }

  // Calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

  private getHailSeverity(size: number): 'minor' | 'moderate' | 'severe' {
    if (!size || size < 1) return 'minor';
    if (size < 1.75) return 'moderate';
    return 'severe';
  }

  // Fallback weather data when API fails
  private getFallbackWeather(city: string, state: string = 'AL'): WeatherData {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();

    return {
      current: {
        temp: 55,
        feelsLike: 53,
        humidity: 65,
        windSpeed: 8,
        condition: 'Partly Cloudy',
        icon: 'cloud-sun',
        isWorkable: true,
      },
      forecast: Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const isRainy = i === 3; // Include one rainy day in fallback forecast
        return {
          date: date.toISOString().slice(0, 10),
          dayOfWeek: i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : dayNames[date.getDay()]),
          high: 55 + Math.floor(Math.random() * 15),
          low: 38 + Math.floor(Math.random() * 10),
          condition: isRainy ? 'Rain' : 'Partly Cloudy',
          icon: isRainy ? 'cloud-rain' : 'cloud-sun',
          precipChance: isRainy ? 70 : Math.floor(Math.random() * 30),
          windSpeed: 5 + Math.floor(Math.random() * 10),
          isWorkable: !isRainy,
          workabilityReason: isRainy ? '70% chance of precipitation' : undefined,
        };
      }),
      alerts: [],
      location: `${city}, ${state}`,
      lastUpdated: new Date().toISOString(),
      stormRisk: {
        level: 'low',
        message: 'Good conditions for roofing work',
        hasActiveAlerts: false,
        hasHailRisk: false,
      },
    };
  }

  // Fetch wind/storm reports from Iowa State Mesonet (complements hail data)
  async getWindReports(
    address: string,
    daysBack: number = 30,
    radiusMiles: number = 50
  ): Promise<{ date: string; event: string; speed: number; location: string; distance: number }[]> {
    const { lat, lon } = this.geocodeAddress(address);

    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      // Type 'G' = wind gust, 'D' = wind damage
      const response = await fetch(
        `https://mesonet.agron.iastate.edu/geojson/lsr.php?sts=${startStr}T00:00:00Z&ets=${endStr}T23:59:59Z&wfos=HUN,BMX,OHX,MRX,MEG,FFC,JAN,MOB&type=G`
      );

      if (!response.ok) return [];
      const data = await response.json();
      const reports: { date: string; event: string; speed: number; location: string; distance: number }[] = [];

      if (data.features) {
        data.features.forEach((feature: GeoJSONFeature) => {
          const props = feature.properties;
          const coords = feature.geometry.coordinates;
          const distance = this.calculateDistance(lat, lon, coords[1], coords[0]);

          if (distance <= radiusMiles) {
            reports.push({
              date: props.valid || props.utc_valid,
              event: 'Wind Gust',
              speed: parseFloat(props.magnitude) || 0,
              location: props.city || 'Unknown Location',
              distance: Math.round(distance * 10) / 10,
            });
          }
        });
      }

      return reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error fetching wind reports:', error);
      return [];
    }
  }

  // Fetch SPC (Storm Prediction Center) convective outlook risk level
  // Returns today's severe weather risk for a given location
  async getSpcOutlook(lat: number, lon: number): Promise<{
    risk: 'TSTM' | 'MRGL' | 'SLGT' | 'ENH' | 'MDT' | 'HIGH' | 'NONE';
    label: string;
    description: string;
  }> {
    try {
      // SPC provides GeoJSON outlook data
      const response = await fetch(
        'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.lyr.geojson',
        { headers: { 'User-Agent': 'RiverCityRoofing (contact@rcrsal.com)' } }
      );

      if (!response.ok) return { risk: 'NONE', label: 'No Data', description: 'Unable to fetch SPC outlook' };

      const data = await response.json();
      // Check if point falls within any outlook polygon
      // The GeoJSON features are ordered from highest to lowest risk
      // We check from highest risk down, so the first match is the highest applicable risk
      const riskLabels: Record<string, { label: string; description: string }> = {
        'HIGH': { label: 'High Risk', description: 'Widespread severe storms likely including large hail and destructive winds' },
        'MDT': { label: 'Moderate Risk', description: 'Significant severe storm outbreak expected with large hail potential' },
        'ENH': { label: 'Enhanced Risk', description: 'Numerous severe storms possible including damaging hail' },
        'SLGT': { label: 'Slight Risk', description: 'Scattered severe storms possible with hail potential' },
        'MRGL': { label: 'Marginal Risk', description: 'Isolated severe storms possible' },
        'TSTM': { label: 'Thunderstorm Risk', description: 'General thunderstorms possible but severe weather not expected' },
      };

      // Simple point-in-polygon check for each feature
      for (const feature of (data.features || [])) {
        const props = feature.properties || {};
        const riskCat = (props.LABEL || props.LABEL2 || '').toUpperCase();
        if (riskLabels[riskCat] && this.pointInFeature(lat, lon, feature)) {
          return { risk: riskCat as 'HIGH' | 'MDT' | 'ENH' | 'SLGT' | 'MRGL' | 'TSTM', ...riskLabels[riskCat] };
        }
      }

      return { risk: 'NONE', label: 'No Risk', description: 'No severe weather risk expected today' };
    } catch {
      return { risk: 'NONE', label: 'No Data', description: 'Unable to fetch SPC outlook' };
    }
  }

  // Simple point-in-polygon test for GeoJSON features
  private pointInFeature(lat: number, lon: number, feature: GeoJSONFeature): boolean {
    try {
      const geometry = feature.geometry;
      if (!geometry) return false;

      const polygons = geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : geometry.type === 'Polygon'
          ? [geometry.coordinates]
          : [];

      for (const polygon of polygons) {
        if (this.pointInPolygon(lat, lon, polygon[0])) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Ray casting algorithm for point-in-polygon
  private pointInPolygon(lat: number, lon: number, ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Get hail reports for a specific zip code
  async getHailReportsByZip(zipcode: string, daysBack: number = 30, radiusMiles: number = 50): Promise<HailReport[]> {
    const location = this.geocodeZipCode(zipcode);
    if (location) {
      // Create an address string for the existing method
      return this.getHailReports(`${location.city}, ${location.state}`, daysBack, radiusMiles);
    }
    return this.getHailReports(zipcode, daysBack, radiusMiles);
  }
}

export interface HailReport {
  id: string;
  date: string;
  location: string;
  county: string;
  distance: number;
  hailSize: string;
  hailSizeNum: number;
  source: string;
  severity: 'minor' | 'moderate' | 'severe';
  latitude: number;
  longitude: number;
  remarks: string;
}

export const weatherService = new WeatherService();
