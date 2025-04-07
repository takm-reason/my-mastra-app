import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { findScreensTool, findApisTool, findSpecificationsTool } from '../../tools/docs/tool';
import { githubCloneTool } from '../../tools/github/tool';
import { docsAgentInstructions } from './instructions';

export const docsAgent = new Agent({
    name: 'Documentation Agent',
    model: openai('gpt-4o-mini'),
    instructions: docsAgentInstructions,
    tools: {
        clone: githubCloneTool,
        findScreens: findScreensTool,
        findApis: findApisTool,
        findSpecs: findSpecificationsTool,
    },
});