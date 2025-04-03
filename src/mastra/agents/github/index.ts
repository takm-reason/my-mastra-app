import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { githubCloneTool, codeAnalysisTool, specificationAnalysisTool } from '../../tools/github/tool';
import { githubAgentInstructions } from './instructions';

export const githubAgent = new Agent({
    name: 'GitHub Repository Analyzer',
    instructions: githubAgentInstructions,
    model: openai('gpt-4o-mini'),
    tools: {
        githubCloneTool,
        codeAnalysisTool,
        specificationAnalysisTool,
    },
});