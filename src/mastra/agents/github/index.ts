import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { githubRepoInfoTool, githubCloneTool, analyzeCodeTool } from '../../tools/github/tool';
import { githubAgentInstructions } from './instructions';

export const githubAgent = new Agent({
    name: 'GitHub Agent',
    model: openai('gpt-4o-mini'),
    instructions: githubAgentInstructions,
    tools: {
        githubRepoInfo: githubRepoInfoTool,
        githubClone: githubCloneTool,
        analyzeCode: analyzeCodeTool,
    },
});