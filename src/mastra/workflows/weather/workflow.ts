import { Workflow } from '@mastra/core/workflows';
import { fetchWeather, planActivities } from './steps';
import { triggerSchema } from './schemas';

export const weatherWorkflow = new Workflow({
    name: 'weather-workflow',
    triggerSchema,
})
    .step(fetchWeather)
    .then(planActivities);

weatherWorkflow.commit();