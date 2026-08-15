/**
 * Utility functions for time-based lighting calculations
 */

export interface LightingCalculationResult {
  sunAngle: number;
  intensity: number;
  temperature: number;
}

/**
 * Calculate sun elevation angle based on date, time, and location
 * @param date - Current date and time
 * @param latitude - Latitude in degrees (default: 40.7128 for NYC)
 * @param longitude - Longitude in degrees (default: -74.0060 for NYC)
 * @returns Sun elevation angle in degrees (-90 to 90)
 */
export function calculateSunAngle(
  date: Date,
  latitude: number = 40.7128,
  longitude: number = -74.0060
): number {
  // Calculate day of year
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));

  // Solar declination (simplified)
  const solarDeclination = 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * Math.PI / 180);

  // Hour angle
  const hourAngle = (date.getHours() - 12) * 15 + longitude;

  // Sun elevation angle
  const elevation = Math.asin(
    Math.sin(solarDeclination * Math.PI / 180) * Math.sin(latitude * Math.PI / 180) +
    Math.cos(solarDeclination * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * Math.cos(hourAngle * Math.PI / 180)
  ) * 180 / Math.PI;

  return Math.max(-90, Math.min(90, elevation));
}

/**
 * Calculate sun intensity based on sun elevation angle
 * @param sunAngle - Sun elevation angle in degrees
 * @returns Intensity value (0.05 to 1.0)
 */
export function calculateSunIntensity(sunAngle: number): number {
  if (sunAngle < -6) return 0.05; // Night
  if (sunAngle < 0) return 0.1 + (sunAngle + 6) * 0.05; // Dawn/Dusk
  if (sunAngle < 30) return 0.4 + sunAngle * 0.02; // Morning/Evening
  if (sunAngle < 60) return 0.8 + (sunAngle - 30) * 0.01; // Midday
  return 1.0; // Peak daylight
}

/**
 * Calculate color temperature based on sun elevation angle
 * @param sunAngle - Sun elevation angle in degrees
 * @returns Color temperature in Kelvin (2500-6500)
 */
export function calculateColorTemperature(sunAngle: number): number {
  if (sunAngle < -6) return 2500; // Night - warm
  if (sunAngle < 0) return 3000 + sunAngle * 50; // Dawn/Dusk
  if (sunAngle < 30) return 4000 + sunAngle * 50; // Morning
  if (sunAngle < 60) return 5000 + (sunAngle - 30) * 50; // Midday
  return 6500; // Peak daylight - cool
}

/**
 * Calculate complete lighting parameters for real world time
 * @param date - Current date and time
 * @param latitude - Latitude in degrees
 * @param longitude - Longitude in degrees
 * @returns Complete lighting calculation result
 */
export function calculateRealWorldLighting(
  date: Date,
  latitude: number = 40.7128,
  longitude: number = -74.0060
): LightingCalculationResult {
  const sunAngle = calculateSunAngle(date, latitude, longitude);
  const intensity = calculateSunIntensity(sunAngle);
  const temperature = calculateColorTemperature(sunAngle);

  return {
    sunAngle,
    intensity,
    temperature
  };
}

/**
 * Convert color temperature to RGB values for scene tinting
 * @param temperature - Color temperature in Kelvin
 * @returns RGB color values (0-1 range)
 */
export function temperatureToRGB(temperature: number): { r: number; g: number; b: number } {
  let r = 1.0, g = 1.0, b = 1.0;

  if (temperature < 5000) {
    // Warmer colors
    r = 1.0;
    g = 0.8 + (temperature / 5000) * 0.2;
    b = 0.6 + (temperature / 5000) * 0.4;
  } else {
    // Cooler colors
    r = 0.8 + ((10000 - temperature) / 5000) * 0.2;
    g = 1.0;
    b = 1.0;
  }

  return { r, g, b };
}
