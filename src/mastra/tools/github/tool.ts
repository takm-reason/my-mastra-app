import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { cloneRepository } from './utils';

export const githubCloneTool = createTool({
    id: 'github-clone',
    description: 'Clone a GitHub repository into src/mastra/tools/github/clones directory',
    inputSchema: z.object({
        repository: z
            .string()
            .describe('Repository name in format owner/repo (e.g., "microsoft/typescript")'),
        branch: z
            .string()
            .optional()
            .describe('Branch to clone (optional)'),
        shallow: z
            .boolean()
            .optional()
            .describe('Whether to perform a shallow clone (optional)'),
    }),
    outputSchema: z.object({
        directory: z.string().describe('Absolute path of the cloned repository'),
        repositoryUrl: z.string().describe('GitHub repository URL'),
        branch: z.string().describe('Cloned branch name'),
    }),
    execute: async ({ context }) => {
        return await cloneRepository({
            repository: context.repository,
            branch: context.branch,
            shallow: context.shallow,
        });
    },
});