import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { analyzeProject } from './utils';
import { generateMarkdown } from './markdown';
import { AnalysisStateManager } from './state';

export const codeAnalyzerTool = createTool({
    id: 'code-analyzer',
    description: 'Analyze code structure and generate documentation',
    inputSchema: z.object({
        targetDir: z
            .string()
            .describe('Target directory name in workspace (e.g., "cloned/typescript")'),
        includeExtensions: z
            .array(z.string())
            .optional()
            .describe('File extensions to include (e.g., [".ts", ".js"])'),
        excludeExtensions: z
            .array(z.string())
            .optional()
            .describe('File extensions to exclude (e.g., [".test.ts", ".d.ts"])'),
        detailed: z
            .boolean()
            .optional()
            .describe('Whether to include detailed specifications'),
        respectIgnoreFiles: z
            .boolean()
            .optional()
            .describe('Whether to respect .gitignore and .dockerignore files'),
        additionalAnalysis: z
            .array(
                z.object({
                    type: z.enum(['specification', 'api', 'dependency', 'test']),
                    targetPath: z.string().optional(),
                    options: z.record(z.unknown()).optional(),
                })
            )
            .optional()
            .describe('Additional analysis requests'),
    }),
    outputSchema: z.object({
        projectName: z.string(),
        mainAnalysisPath: z.string(),
        additionalFiles: z.array(
            z.object({
                title: z.string(),
                path: z.string(),
                status: z.enum(['completed', 'pending', 'not-started']),
            })
        ),
        summary: z.string(),
    }),
    execute: async ({ context }) => {
        // workspaceディレクトリのパスを構築
        const workspacePath = join(process.cwd(), 'src/mastra/workspace');
        // workspaceディレクトリが存在しない場合は作成
        mkdirSync(workspacePath, { recursive: true });

        const targetPath = join(workspacePath, context.targetDir);
        // 対象ディレクトリが存在しない場合は作成
        mkdirSync(targetPath, { recursive: true });

        // プロジェクトを解析
        const analysis = await analyzeProject(targetPath, {
            targetDir: context.targetDir,
            includeExtensions: context.includeExtensions,
            excludeExtensions: context.excludeExtensions,
            detailed: context.detailed,
            respectIgnoreFiles: context.respectIgnoreFiles,
            additionalAnalysis: context.additionalAnalysis,
        });

        // 状態管理を初期化
        const stateManager = new AnalysisStateManager(
            targetPath,
            analysis.projectName
        );

        // マークダウンを生成
        const markdown = generateMarkdown(analysis, stateManager);

        // 状態を取得
        const state = stateManager.getState();

        return {
            projectName: analysis.projectName,
            mainAnalysisPath: markdown.main.path,
            additionalFiles: state.documents.map(doc => ({
                title: doc.title,
                path: doc.path,
                status: doc.status,
            })),
            summary: `解析が完了しました。メインドキュメントが ${markdown.main.path} に生成されました。\n追加の解析オプションについてはドキュメント内を確認してください。`,
        };
    },
});