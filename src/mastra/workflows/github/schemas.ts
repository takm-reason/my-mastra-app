import { z } from 'zod';

export const githubWorkflowInputSchema = z.object({
    repoUrl: z.string().url().describe('GitHub repository URL'),
    branch: z.string().optional().describe('Branch name to analyze'),
    filePattern: z.string().optional().describe('File pattern to analyze (e.g., "**/*.ts")'),
});

export const githubWorkflowOutputSchema = z.object({
    cloneResult: z.object({
        repoPath: z.string(),
        files: z.array(z.string()),
        success: z.boolean(),
        message: z.string(),
    }),
    analysisResult: z.object({
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
});

export type GitHubWorkflowInput = z.infer<typeof githubWorkflowInputSchema>;
export type GitHubWorkflowOutput = z.infer<typeof githubWorkflowOutputSchema>;