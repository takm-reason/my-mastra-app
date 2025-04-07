import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow, githubWorkflow, docsWorkflow } from './workflows';
import { weatherAgent, githubAgent, docsAgent } from './agents';

export const mastra = new Mastra({
  workflows: { weatherWorkflow, githubWorkflow, docsWorkflow },
  agents: { weatherAgent, githubAgent, docsAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
