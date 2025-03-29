import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { cloneRepository } from './utils';

export const githubCloneTool = createTool({
    id: 'github-clone',
    description: 'Clone a GitHub repository',
    inputSchema: z.object({
        repository: z
            .string()
            .describe('Repository name in format owner/repo (e.g., "microsoft/typescript")'),
        directory: z
            .string()
            .optional()
            .describe('Directory to clone into (optional)'),
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
        directory: z.string(),
        repositoryUrl: z.string(),
        branch: z.string(),
    }),
    execute: async ({ context }) => {
        return await cloneRepository({
            repository: context.repository,
            directory: context.directory,
            branch: context.branch,
            shallow: context.shallow,
        });
    },
});