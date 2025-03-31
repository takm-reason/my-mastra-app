import { Agent } from '@mastra/core/agent';
import { Step } from '@mastra/core/workflows';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { githubAgent } from '../../agents';
import { GitHubWorkflowInput, githubWorkflowInputSchema } from './schemas';

interface CodeAnalysisResult {
    files: string[];
    dependencies: string[];
    codeMetrics: {
        totalFiles: number;
        totalLines: number;
        languageStats: Record<string, number>;
    };
    analysis: {
        complexity: number;
        maintainability: number;
        documentation: number;
    };
}

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

        return JSON.parse(result) as CodeAnalysisResult;
    },
});

export const generateReportStep = new Step({
    id: 'generate-report',
    description: 'Generates a markdown report of the analysis results',
    inputSchema: z.object({
        repoPath: z.string(),
        analysis: z.object({
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
    }),
    execute: async ({ context }) => {
        const cloneResult = context?.getStepResult<{
            repoPath: string;
            success: boolean;
        }>('clone-repository');

        const analysisResult = context?.getStepResult<CodeAnalysisResult>('analyze-code');
        const triggerData = context?.getStepResult<GitHubWorkflowInput>('trigger');

        if (!cloneResult || !analysisResult || !triggerData) {
            throw new Error('Required step results not found');
        }

        const repoName = triggerData.repoUrl.split('/').pop()?.replace('.git', '') || 'unknown-repo';

        const report = generateMarkdownReport(repoName, analysisResult);

        // レポートをファイルに保存
        const reportPath = path.join(process.cwd(), 'reports');
        await fs.mkdir(reportPath, { recursive: true });

        const reportFile = path.join(reportPath, `${repoName}-analysis.md`);
        await fs.writeFile(reportFile, report, 'utf-8');

        return {
            reportPath: reportFile,
            report,
        };
    },
});

function generateMarkdownReport(repoName: string, analysis: CodeAnalysisResult): string {
    const {
        files,
        dependencies,
        codeMetrics,
        analysis: codeAnalysis,
    } = analysis;

    const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
    const formatNumber = (value: number) => value.toFixed(2);

    return `# Repository Analysis Report: ${repoName}

## Overview
- Total Files: ${codeMetrics.totalFiles}
- Total Lines of Code: ${codeMetrics.totalLines}

## Language Distribution
${Object.entries(codeMetrics.languageStats)
            .map(([ext, count]) => `- ${ext || 'No Extension'}: ${count} files`)
            .join('\n')}

## Code Quality Metrics
- Complexity Score: ${formatNumber(codeAnalysis.complexity)}
- Maintainability Index: ${formatPercentage(codeAnalysis.maintainability)}
- Documentation Coverage: ${formatPercentage(codeAnalysis.documentation)}

## Dependencies
${dependencies.length > 0
            ? dependencies.map((dep: string) => `- ${dep}`).join('\n')
            : '- No dependencies found'}

## File Structure
\`\`\`
${files.map((file: string) => `- ${file}`).join('\n')}
\`\`\`

## Analysis Summary
${generateAnalysisSummary(codeAnalysis)}
`;
}

function generateAnalysisSummary(analysis: CodeAnalysisResult['analysis']): string {
    const summaries = [];

    // 複雑度の評価
    if (analysis.complexity < 10) {
        summaries.push('✅ コードの複雑度は良好です。保守が容易である可能性が高いです。');
    } else if (analysis.complexity < 20) {
        summaries.push('⚠️ コードの複雑度は中程度です。一部のモジュールでリファクタリングを検討してください。');
    } else {
        summaries.push('❌ コードの複雑度が高いです。リファクタリングを推奨します。');
    }

    // 保守性の評価
    if (analysis.maintainability > 0.8) {
        summaries.push('✅ 保守性は優れています。コードは整理されており、変更が容易です。');
    } else if (analysis.maintainability > 0.6) {
        summaries.push('⚠️ 保守性は許容範囲内ですが、改善の余地があります。');
    } else {
        summaries.push('❌ 保守性に課題があります。コードの構造を見直すことを推奨します。');
    }

    // ドキュメント化の評価
    if (analysis.documentation > 0.3) {
        summaries.push('✅ ドキュメント化は十分です。');
    } else if (analysis.documentation > 0.1) {
        summaries.push('⚠️ ドキュメント化が不足しています。主要な機能の説明を追加することを推奨します。');
    } else {
        summaries.push('❌ ドキュメントが著しく不足しています。コードの理解と保守が困難になる可能性があります。');
    }

    return summaries.join('\n');
}