import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow, githubWorkflow } from './workflows';
import { weatherAgent, githubAgent } from './agents';

export const mastra = new Mastra({
  workflows: { weatherWorkflow, githubWorkflow },
  agents: { weatherAgent, githubAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
