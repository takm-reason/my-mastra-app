import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { weatherTool } from '../../tools';
import { weatherAgentInstructions } from './instructions';

export const weatherAgent = new Agent({
    name: 'Weather Agent',
    instructions: weatherAgentInstructions,
    model: openai('gpt-4o-mini'),
    tools: { weatherTool },
});