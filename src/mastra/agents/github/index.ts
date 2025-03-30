import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import {
    githubCloneTool,
    codeAnalyzerTool,
    fileProcessorTool,
    vectorQueryTool
} from '../../tools';
import { githubAgentInstructions } from './instructions';

export const githubAgent = new Agent({
    name: 'GitHub Analysis Agent',
    instructions: githubAgentInstructions,
    model: openai('gpt-4o-mini'),
    tools: {
        githubCloneTool,
        codeAnalyzerTool,
        fileProcessorTool,
        vectorQueryTool
    },
});