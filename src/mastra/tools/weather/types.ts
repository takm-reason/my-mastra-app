export interface GeocodingResponse {
    results: {
        latitude: number;
        longitude: number;
        name: string;
    }[];
}

export interface WeatherResponse {
    current: {
        time: string;
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
        wind_gusts_10m: number;
        weather_code: number;
    };
}