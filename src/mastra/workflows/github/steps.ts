import { Agent } from '@mastra/core/agent';
import { Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { githubAgent } from '../../agents';
import { GitHubWorkflowInput, githubWorkflowInputSchema } from './schemas';

export const cloneRepositoryStep = new Step({
    id: 'clone-repository',
    description: 'Clones the specified GitHub repository',
    inputSchema: githubWorkflowInputSchema,
    execute: async ({ context }) => {
        const triggerData = context?.getStepResult<GitHubWorkflowInput>('trigger');

        if (!triggerData) {
            throw new Error('Trigger data not found');
        }

        const response = await githubAgent.stream([
            {
                role: 'user',
                content: JSON.stringify({
                    command: 'githubCloneTool',
                    params: {
                        repoUrl: triggerData.repoUrl,
                        branch: triggerData.branch,
                    }
                })
            }
        ]);

        let result = '';
        for await (const chunk of response.textStream) {
            process.stdout.write(chunk);
            result += chunk;
        }

        const parsedResult = JSON.parse(result);
        if (!parsedResult.success) {
            throw new Error(`Failed to clone repository: ${parsedResult.message}`);
        }

        return parsedResult;
    },
});

export const analyzeCodeStep = new Step({
    id: 'analyze-code',
    description: 'Analyzes the cloned repository code',
    inputSchema: z.object({
        repoPath: z.string(),
        filePattern: z.string().optional(),
    }),
    execute: async ({ context }) => {
        const cloneResult = context?.getStepResult<{
            repoPath: string;
            success: boolean;
            message: string;
        }>('clone-repository');

        const triggerData = context?.getStepResult<GitHubWorkflowInput>('trigger');

        if (!cloneResult || !cloneResult.success) {
            throw new Error('Repository clone result not found or failed');
        }

        if (!triggerData) {
            throw new Error('Trigger data not found');
        }

        const response = await githubAgent.stream([
            {
                role: 'user',
                content: JSON.stringify({
                    command: 'codeAnalysisTool',
                    params: {
                        repoPath: cloneResult.repoPath,
                        filePattern: triggerData.filePattern,
                    }
                })
            }
        ]);

        let result = '';
        for await (const chunk of response.textStream) {
            process.stdout.write(chunk);
            result += chunk;
        }

        return JSON.parse(result);
    },
});