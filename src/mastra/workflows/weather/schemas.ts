import { z } from 'zod';

export const forecastSchema = z.array(
    z.object({
        date: z.string(),
        maxTemp: z.number(),
        minTemp: z.number(),
        precipitationChance: z.number(),
        condition: z.string(),
        location: z.string(),
    }),
);

export const triggerSchema = z.object({
    city: z.string().describe('The city to get the weather for'),
});