const ADDIS_ABABA = {
  latitude: 9.0222,
  longitude: 38.7469,
};

export interface WeatherForecast {
  date: string;
  rainfallMm: number;
  temperatureMax: number;
  temperatureMin: number;
  humidity: number;
  condition: string;
}

export interface WeatherSummary {
  location: string;
  forecast: WeatherForecast[];
  rainExpected: boolean;
  recommendation: string;
}

export async function getWeatherForecast(days: number = 3): Promise<WeatherSummary> {
  const { latitude, longitude } = ADDIS_ABABA;
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=${days}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }
  
  const data = await response.json() as any;
  
  const forecast: WeatherForecast[] = data.daily.time.map((date: string, i: number) => {
    const rainfall = data.daily.precipitation_sum[i] || 0;
    let condition = 'Clear';
    if (rainfall > 15) condition = 'Heavy Rain';
    else if (rainfall > 5) condition = 'Light Rain';
    else if (rainfall > 0) condition = 'Drizzle';
    
    return {
      date,
      rainfallMm: rainfall,
      temperatureMax: data.daily.temperature_2m_max[i],
      temperatureMin: data.daily.temperature_2m_min[i],
      humidity: 0,
      condition,
    };
  });
  
  const totalRainNext24h = forecast.length > 0 ? forecast[0].rainfallMm : 0;
  const rainExpected = totalRainNext24h > 5;
  
  let recommendation = 'Irrigation can proceed normally.';
  if (rainExpected) {
    recommendation = `Rain expected (${totalRainNext24h.toFixed(1)}mm). Consider postponing irrigation.`;
  }
  
  return {
    location: 'Addis Ababa, Ethiopia',
    forecast,
    rainExpected,
    recommendation,
  };
}

export async function getCurrentWeather(): Promise<{
  temperature: number;
  humidity: number;
  condition: string;
}> {
  const { latitude, longitude } = ADDIS_ABABA;
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code`;
  
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json() as any;

  const weatherCode = data.current.weather_code;
  let condition = 'Clear';
  if (weatherCode >= 61 && weatherCode < 65) condition = 'Rain';
  else if (weatherCode >= 65 && weatherCode < 80) condition = 'Rain';
  else if (weatherCode >= 95) condition = 'Thunderstorm';

  return {
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    condition,
  };
}
