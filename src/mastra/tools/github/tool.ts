import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { cloneRepo, analyzeCode } from './utils';

export const githubCloneTool = createTool({
    id: 'github-clone',
    description: 'Clone a GitHub repository and analyze its code',
    inputSchema: z.object({
        repoUrl: z.string().describe('GitHub repository URL'),
        branch: z.string().optional().describe('Branch name to clone (defaults to main)'),
    }),
    outputSchema: z.object({
        repoPath: z.string(),
        files: z.array(z.string()),
        success: z.boolean(),
        message: z.string(),
    }),
    execute: async ({ context }) => {
        return await cloneRepo(context.repoUrl, context.branch);
    },
});

export const codeAnalysisTool = createTool({
    id: 'code-analysis',
    description: 'Analyze code in a repository',
    inputSchema: z.object({
        repoPath: z.string().describe('Path to the cloned repository'),
        filePattern: z.string().optional().describe('File pattern to analyze (e.g., "**/*.ts")'),
    }),
    outputSchema: z.object({
        files: z.array(z.string()),
        dependencies: z.array(z.string()),
        codeMetrics: z.object({
            totalFiles: z.number(),
            totalLines: z.number(),
            languageStats: z.record(z.number()),
        }),
        analysis: z.object({
            complexity: z.number(),
            maintainability: z.number(),
            documentation: z.number(),
        }),
    }),
    execute: async ({ context }) => {
        return await analyzeCode(context.repoPath, context.filePattern);
    },
});