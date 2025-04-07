import { Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { Step } from '@mastra/core/workflows';
import { docsAgent } from '../../agents/docs';

const docsWorkflowInputSchema = z.object({
    repoUrl: z.string().describe('GitHubリポジトリのURL'),
    branch: z.string().optional().describe('対象ブランチ'),
    outputFormat: z.enum(['markdown', 'json']).default('markdown').describe('出力形式'),
});

interface DocumentSection {
    id: string;
    title: string;
    prompt: string;
}

// ドキュメントセクションを定義
const sections: DocumentSection[] = [
    {
        id: 'project-overview',
        title: 'プロジェクト概要',
        prompt: 'プロジェクトの概要、目的、主要機能について分析してください。',
    },
    {
        id: 'system-architecture',
        title: 'システム構成',
        prompt: 'システムのアーキテクチャ、コンポーネント構成について分析してください。',
    },
    {
        id: 'screens',
        title: '画面仕様',
        prompt: 'findScreensツールを使用して画面一覧と構成を分析してください。',
    },
    {
        id: 'apis',
        title: 'API仕様',
        prompt: 'findApisツールを使用してAPIエンドポイントを分析してください。',
    },
    {
        id: 'specifications',
        title: '機能仕様',
        prompt: 'findSpecsツールを使用して機能仕様を分析してください。',
    },
];

export const generateDocs = new Step({
    id: 'generate-docs',
    description: 'プロジェクトの包括的なドキュメントを生成',
    inputSchema: docsWorkflowInputSchema,
    async execute({ context }) {
        if (!context.inputData) {
            throw new Error('入力データが提供されていません');
        }

        const { repoUrl, branch, outputFormat } = context.inputData;

        // リポジトリのクローン指示
        const cloneResponse = await docsAgent.stream([
            {
                role: 'user',
                content: `リポジトリをクローンしてください：
リポジトリURL: ${repoUrl}
ブランチ: ${branch || 'デフォルト'}`,
            },
        ]);

        let clonePath = '';
        for await (const chunk of cloneResponse.textStream) {
            clonePath += chunk;
        }

        // 各セクションのドキュメントを生成
        const documentSections: Record<string, string> = {};

        for (const section of sections) {
            const response = await docsAgent.stream([
                {
                    role: 'user',
                    content: `以下のセクションを生成してください：
セクション: ${section.title}
対象パス: ${clonePath}

${section.prompt}

注意：
- 簡潔で具体的な説明を心がけてください
- コードや設定は必要な部分のみ抜粋してください
- 図表は必要最小限にしてください
- 1セクションあたり1000文字程度を目安にしてください`,
                },
            ]);

            let sectionContent = '';
            for await (const chunk of response.textStream) {
                sectionContent += chunk;
            }
            documentSections[section.id] = sectionContent;

            // トークン制限を考慮して少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 出力形式に応じた整形
        if (outputFormat === 'json') {
            return {
                format: 'json',
                content: {
                    リポジトリ: repoUrl,
                    ブランチ: branch || 'デフォルト',
                    生成日時: new Date().toISOString(),
                    セクション: documentSections,
                },
            };
        }

        // Markdown形式の場合
        return {
            format: 'markdown',
            content: `# プロジェクトドキュメント

## 基本情報
- リポジトリ: ${repoUrl}
- ブランチ: ${branch || 'デフォルト'}
- 生成日時: ${new Date().toLocaleString('ja-JP')}

${sections
                    .map(section => `## ${section.title}\n\n${documentSections[section.id]}\n`)
                    .join('\n')}

---
このドキュメントは自動生成されています。
更新日時: ${new Date().toLocaleString('ja-JP')}
`,
        };
    },
});

export const docsWorkflow = new Workflow({
    name: 'docs-workflow',
    triggerSchema: docsWorkflowInputSchema,
})
    .step(generateDocs);

docsWorkflow.commit();