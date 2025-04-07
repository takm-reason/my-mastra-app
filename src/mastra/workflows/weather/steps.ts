import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { getWeatherCondition } from '../../tools/weather/utils';
import { weatherPlannerInstructions } from './instructions';
import { forecastSchema } from './schemas';

const llm = openai('gpt-4o-mini');

const agent = new Agent({
    name: 'Weather Agent',
    model: llm,
    instructions: weatherPlannerInstructions,
});

export const fetchWeather = new Step({
    id: 'fetch-weather',
    description: 'Fetches weather forecast for a given city',
    inputSchema: z.object({
        city: z.string().describe('The city to get the weather for'),
    }),
    execute: async ({ context }) => {
        const triggerData = context?.getStepResult<{ city: string }>('trigger');

        if (!triggerData) {
            throw new Error('Trigger data not found');
        }

        const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(triggerData.city)}&count=1`;
        const geocodingResponse = await fetch(geocodingUrl);
        const geocodingData = (await geocodingResponse.json()) as {
            results: { latitude: number; longitude: number; name: string }[];
        };

        if (!geocodingData.results?.[0]) {
            throw new Error(`Location '${triggerData.city}' not found`);
        }

        const { latitude, longitude, name } = geocodingData.results[0];

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean,weathercode&timezone=auto`;
        const response = await fetch(weatherUrl);
        const data = (await response.json()) as {
            daily: {
                time: string[];
                temperature_2m_max: number[];
                temperature_2m_min: number[];
                precipitation_probability_mean: number[];
                weathercode: number[];
            };
        };

        const forecast = data.daily.time.map((date: string, index: number) => ({
            date,
            maxTemp: data.daily.temperature_2m_max[index],
            minTemp: data.daily.temperature_2m_min[index],
            precipitationChance: data.daily.precipitation_probability_mean[index],
            condition: getWeatherCondition(data.daily.weathercode[index]!),
            location: name,
        }));

        return forecast;
    },
});

export const planActivities = new Step({
    id: 'plan-activities',
    description: 'Suggests activities based on weather conditions',
    inputSchema: forecastSchema,
    execute: async ({ context, mastra }) => {
        const forecast =
            context?.getStepResult<z.infer<typeof forecastSchema>>('fetch-weather');

        if (!forecast || forecast.length === 0) {
            throw new Error('Forecast data not found');
        }

        const prompt = `Based on the following weather forecast for ${forecast[0]?.location}, suggest appropriate activities:
      ${JSON.stringify(forecast, null, 2)}
      `;

        const response = await agent.stream([
            {
                role: 'user',
                content: prompt,
            },
        ]);

        let activitiesText = '';

        for await (const chunk of response.textStream) {
            process.stdout.write(chunk);
            activitiesText += chunk;
        }

        return {
            activities: activitiesText,
        };
    },
});