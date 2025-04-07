import { Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { Step } from '@mastra/core/workflows';
import { githubAgent } from '../../agents/github';

const githubWorkflowInputSchema = z.object({
    repoUrl: z.string().describe('GitHub repository URL'),
    branch: z.string().optional().describe('分析対象のブランチ名'),
});

export const analyzeRepo = new Step({
    id: 'analyze-repo',
    description: 'GitHubリポジトリの分析を実行',
    inputSchema: githubWorkflowInputSchema,
    async execute({ context }) {
        if (!context.inputData) {
            throw new Error('入力データが提供されていません');
        }

        const { repoUrl, branch } = context.inputData;

        // リポジトリ名の形式を検証
        const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!urlMatch) {
            throw new Error('無効なGitHubリポジトリURLです');
        }

        const prompt = `
以下のGitHubリポジトリを分析してください：

リポジトリ: ${repoUrl}
${branch ? `ブランチ: ${branch}` : ''}

以下の観点から総合的な分析と提案を行ってください：

1. コードベースの評価
   - コードの構造と整理
   - 命名規則とコーディング規約
   - 実装の品質とベストプラクティス

2. プロジェクトの健全性
   - コミュニティの活動状況
   - イシューとプルリクエストの管理
   - メンテナンスの状態

3. 技術的な特徴
   - 使用技術とフレームワーク
   - 依存関係の管理
   - ビルドと開発環境

4. 具体的な改善提案
   - 優先度の高い改善点
   - 実装の推奨事項
   - セキュリティと性能の考慮点

※分析結果は日本語で、具体的な数値や例を含めて説明してください。`;

        const response = await githubAgent.stream([
            {
                role: 'user',
                content: prompt,
            },
        ]);

        let analysisText = '';
        for await (const chunk of response.textStream) {
            analysisText += chunk;
        }

        return {
            分析結果: analysisText,
            メタデータ: {
                リポジトリURL: repoUrl,
                ブランチ: branch,
                分析実行日時: new Date().toISOString(),
            },
        };
    },
});

export const githubWorkflow = new Workflow({
    name: 'github-workflow',
    triggerSchema: githubWorkflowInputSchema,
})
    .step(analyzeRepo);

githubWorkflow.commit();