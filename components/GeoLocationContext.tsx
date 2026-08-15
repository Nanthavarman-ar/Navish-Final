import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: number;
  name?: string; // For saved locations
}

interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
  visibility: number;
  uvIndex?: number;
}

interface LocationHistory {
  id: string;
  location: GeoLocation;
  timestamp: number;
  weather?: WeatherData;
}

interface SunPathData {
  azimuth: number;
  elevation: number;
  intensity: number;
}

interface GeoLocationContextProps {
  scene: BABYLON.Scene;
  onLocationChange?: (location: GeoLocation) => void;
  onSunPathUpdate?: (sunPath: SunPathData) => void;
}

const GeoLocationContext: React.FC<GeoLocationContextProps> = ({
  scene,
  onLocationChange,
  onSunPathUpdate
}) => {
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [sunPath, setSunPath] = useState<SunPathData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [useRealTime, setUseRealTime] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const sunLightRef = useRef<BABYLON.DirectionalLight | null>(null);

  // New state for enhancements
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [favoriteLocations, setFavoriteLocations] = useState<GeoLocation[]>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherApiKey, setWeatherApiKey] = useState<string>('YOUR_API_KEY'); // Should be from env/config

  // Initialize sun light
  useEffect(() => {
    const sunLight = new BABYLON.DirectionalLight("sunLight", new BABYLON.Vector3(-1, -1, -1), scene);
    sunLight.intensity = 1.0;
    sunLightRef.current = sunLight;

    return () => {
      sunLight.dispose();
    };
  }, [scene]);

  // Calculate sun position based on location and time
  const calculateSunPosition = (location: GeoLocation, date: Date): SunPathData => {
    const lat = location.latitude * Math.PI / 180;
    const lng = location.longitude;

    // Calculate day of year
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    // Calculate solar declination
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180) * Math.PI / 180;

    // Calculate equation of time (simplified)
    const equationOfTime = 4 * (0.000075 + 0.001868 * Math.cos((360 * dayOfYear / 365) * Math.PI / 180) -
                               0.032077 * Math.sin((360 * dayOfYear / 365) * Math.PI / 180) -
                               0.014615 * Math.cos(2 * (360 * dayOfYear / 365) * Math.PI / 180) -
                               0.040849 * Math.sin(2 * (360 * dayOfYear / 365) * Math.PI / 180));

    // Calculate solar time
    const solarTime = date.getHours() + date.getMinutes() / 60 + equationOfTime / 60 + (lng - 0) / 15;

    // Calculate hour angle
    const hourAngle = (solarTime - 12) * 15 * Math.PI / 180;

    // Calculate solar elevation
    const elevation = Math.asin(Math.sin(lat) * Math.sin(declination) +
                               Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle));

    // Calculate solar azimuth
    const azimuth = Math.atan2(Math.sin(hourAngle),
                              Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat));

    // Calculate solar intensity (simplified)
    const airMass = 1 / (Math.cos(Math.PI / 2 - elevation) + 0.50572 * Math.pow(96.07995 - elevation * 180 / Math.PI, -1.6364));
    const intensity = Math.max(0, Math.exp(-0.000118 * 2100 * airMass) * Math.sin(elevation));

    return {
      azimuth: azimuth * 180 / Math.PI,
      elevation: elevation * 180 / Math.PI,
      intensity: Math.max(0.1, intensity)
    };
  };

  // Update sun light position and intensity
  const updateSunLight = (sunPathData: SunPathData) => {
    if (!sunLightRef.current) return;

    const azimuthRad = sunPathData.azimuth * Math.PI / 180;
    const elevationRad = sunPathData.elevation * Math.PI / 180;

    // Convert to Cartesian coordinates
    const x = -Math.cos(elevationRad) * Math.sin(azimuthRad);
    const y = Math.sin(elevationRad);
    const z = -Math.cos(elevationRad) * Math.cos(azimuthRad);

    sunLightRef.current.direction = new BABYLON.Vector3(x, y, z);
    sunLightRef.current.intensity = sunPathData.intensity;

    // Update shadow generator if it exists
    const shadowGenerator = sunLightRef.current.getShadowGenerator();
    if (shadowGenerator) {
      (shadowGenerator as any).darkness = Math.max(0.1, 1 - sunPathData.intensity);
    }
  };

  // Load weather data from OpenWeatherMap API
  const loadWeatherData = async (location: GeoLocation) => {
    if (!weatherApiKey || weatherApiKey === 'YOUR_API_KEY') return;

    setIsLoadingWeather(true);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${weatherApiKey}&units=metric`
      );

      if (!response.ok) throw new Error('Weather API request failed');

      const data = await response.json();

      const weather: WeatherData = {
        temperature: data.main.temp,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        windSpeed: data.wind.speed,
        windDirection: data.wind.deg,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        visibility: data.visibility / 1000, // Convert to km
        uvIndex: data.uvi || undefined
      };

      setWeatherData(weather);

      // Add to location history
      const historyEntry: LocationHistory = {
        id: Date.now().toString(),
        location: { ...location, timestamp: Date.now() },
        timestamp: Date.now(),
        weather
      };

      setLocationHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10 entries

    } catch (error) {
      console.error('Error loading weather data:', error);
      setWeatherData(null);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Add location to favorites
  const addToFavorites = (location: GeoLocation, name?: string) => {
    const favoriteLocation = { ...location, name: name || `Location ${favoriteLocations.length + 1}` };
    setFavoriteLocations(prev => [...prev, favoriteLocation]);
  };

  // Remove from favorites
  const removeFromFavorites = (index: number) => {
    setFavoriteLocations(prev => prev.filter((_, i) => i !== index));
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setIsTracking(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: GeoLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };

        setCurrentLocation(location);
        onLocationChange?.(location);

        // Load weather data
        loadWeatherData(location);

        // Calculate and update sun path
        if (useRealTime) {
          const newSunPath = calculateSunPosition(location, currentTime);
          setSunPath(newSunPath);
          updateSunLight(newSunPath);
          onSunPathUpdate?.(newSunPath);
        }

        setIsTracking(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Error getting location: ' + error.message);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  // Start location tracking
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location: GeoLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };

        setCurrentLocation(location);
        onLocationChange?.(location);

        // Load weather data periodically
        if (locationHistory.length === 0 || Date.now() - locationHistory[0].timestamp > 300000) { // 5 minutes
          loadWeatherData(location);
        }

        // Update sun path continuously
        if (useRealTime) {
          const newSunPath = calculateSunPosition(location, currentTime);
          setSunPath(newSunPath);
          updateSunLight(newSunPath);
          onSunPathUpdate?.(newSunPath);
        }
      },
      (error) => {
        console.error('Error tracking location:', error);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  // Stop location tracking
  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  // Set manual location
  const setManualLocation = (latitude: number, longitude: number, altitude?: number) => {
    const location: GeoLocation = {
      latitude,
      longitude,
      altitude,
      accuracy: 0,
      timestamp: Date.now()
    };

    setCurrentLocation(location);
    onLocationChange?.(location);

    // Load weather data
    loadWeatherData(location);

    // Calculate sun path for manual location
    const newSunPath = calculateSunPosition(location, currentTime);
    setSunPath(newSunPath);
    updateSunLight(newSunPath);
    onSunPathUpdate?.(newSunPath);
  };

  // Update time for sun path calculation
  const updateTime = (date: Date) => {
    setCurrentTime(date);

    if (currentLocation && useRealTime) {
      const newSunPath = calculateSunPosition(currentLocation, date);
      setSunPath(newSunPath);
      updateSunLight(newSunPath);
      onSunPathUpdate?.(newSunPath);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, []);

  return (
    <div style={{
      padding: '16px',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      color: '#f1f5f9',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Geo-Location Context</h3>

      {/* API Key Configuration */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
          OpenWeatherMap API Key
        </label>
        <input
          type="password"
          value={weatherApiKey}
          onChange={(e) => setWeatherApiKey(e.target.value)}
          placeholder="Enter your API key"
          style={{
            padding: '6px',
            background: '#334155',
            border: '1px solid #475569',
            borderRadius: '4px',
            color: '#f1f5f9',
            fontSize: '12px',
            width: '100%'
          }}
        />
      </div>

      {/* Location Status */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: currentLocation ? '#10b981' : '#ef4444'
          }}></div>
          <span style={{ fontSize: '14px' }}>
            {currentLocation ? 'Location Available' : 'No Location Set'}
          </span>
        </div>

        {currentLocation && (
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            <div>Lat: {currentLocation.latitude.toFixed(6)}</div>
            <div>Lng: {currentLocation.longitude.toFixed(6)}</div>
            {currentLocation.altitude && <div>Alt: {currentLocation.altitude.toFixed(1)}m</div>}
            {currentLocation.accuracy && <div>Accuracy: ±{currentLocation.accuracy.toFixed(1)}m</div>}
          </div>
        )}
      </div>

      {/* Weather Information */}
      {weatherData && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Weather</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                {weatherData.temperature.toFixed(1)}°C
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Temperature</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                {weatherData.humidity}%
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Humidity</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                {weatherData.windSpeed.toFixed(1)} m/s
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Wind Speed</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                {weatherData.description}
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Conditions</div>
            </div>
          </div>
        </div>
      )}

      {/* Location Controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={getCurrentLocation}
          disabled={isTracking}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: '12px',
            cursor: isTracking ? 'not-allowed' : 'pointer',
            opacity: isTracking ? 0.6 : 1
          }}
        >
          {isTracking ? 'Getting Location...' : 'Get Current Location'}
        </button>

        <button
          onClick={isTracking ? stopLocationTracking : startLocationTracking}
          style={{
            padding: '8px 16px',
            background: isTracking ? '#ef4444' : '#10b981',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {isTracking ? 'Stop Tracking' : 'Start Tracking'}
        </button>
      </div>

      {/* Manual Location Input */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Manual Location</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label htmlFor="latitude-input" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Latitude
            </label>
            <input
              id="latitude-input"
              type="number"
              placeholder="Latitude"
              step="0.000001"
              style={{
                padding: '6px',
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '12px',
                width: '100%'
              }}
              onChange={(e) => {
                const lat = parseFloat(e.target.value);
                if (!isNaN(lat) && currentLocation) {
                  setManualLocation(lat, currentLocation.longitude, currentLocation.altitude);
                }
              }}
            />
          </div>
          <div>
            <label htmlFor="longitude-input" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Longitude
            </label>
            <input
              id="longitude-input"
              type="number"
              placeholder="Longitude"
              step="0.000001"
              style={{
                padding: '6px',
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '12px',
                width: '100%'
              }}
              onChange={(e) => {
                const lng = parseFloat(e.target.value);
                if (!isNaN(lng) && currentLocation) {
                  setManualLocation(currentLocation.latitude, lng, currentLocation.altitude);
                }
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              // Default location (San Francisco)
              setManualLocation(37.7749, -122.4194, 0);
            }}
            style={{
              padding: '6px 12px',
              background: '#6b7280',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Set San Francisco
          </button>

          {currentLocation && (
            <button
              onClick={() => addToFavorites(currentLocation)}
              style={{
                padding: '6px 12px',
                background: '#f59e0b',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Add to Favorites
            </button>
          )}
        </div>
      </div>

      {/* Favorites */}
      {favoriteLocations.length > 0 && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Favorite Locations</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {favoriteLocations.map((location, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => setManualLocation(location.latitude, location.longitude, location.altitude)}
                  style={{
                    padding: '4px 8px',
                    background: '#475569',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    fontSize: '11px',
                    cursor: 'pointer',
                    flex: 1,
                    textAlign: 'left'
                  }}
                >
                  {location.name || `Location ${index + 1}`}
                </button>
                <button
                  onClick={() => removeFromFavorites(index)}
                  style={{
                    padding: '4px 8px',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '11px',
                    cursor: 'pointer',
                    marginLeft: '4px'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sun Path Information */}
      {sunPath && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Sun Path</h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                {sunPath.azimuth.toFixed(1)}°
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Azimuth</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                {sunPath.elevation.toFixed(1)}°
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Elevation</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                {(sunPath.intensity * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Intensity</div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Sun position calculated for {currentTime.toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Time Controls */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginTop: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Time Controls</h4>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={useRealTime}
              onChange={(e) => setUseRealTime(e.target.checked)}
            />
            Use Real Time
          </label>
        </div>

        {!useRealTime && (
          <div>
            <label htmlFor="datetime-input" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Custom Date & Time
            </label>
            <input
              id="datetime-input"
              type="datetime-local"
              value={currentTime.toISOString().slice(0, 16)}
              onChange={(e) => updateTime(new Date(e.target.value))}
              style={{
                padding: '6px',
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '12px',
                width: '100%'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GeoLocationContext;
