import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AnalysisState } from './types';

export class AnalysisStateManager {
    private statePath: string;
    private state: AnalysisState;

    constructor(projectPath: string, projectName: string) {
        const docsDir = join(process.cwd(), 'docs');
        const stateDir = join(docsDir, projectName);

        // ディレクトリが存在しない場合は作成
        mkdirSync(stateDir, { recursive: true });

        this.statePath = join(stateDir, '.analysis-state.json');

        // 既存の状態をロードするか、新しい状態を作成
        if (existsSync(this.statePath)) {
            this.state = JSON.parse(readFileSync(this.statePath, 'utf-8'));
        } else {
            this.state = {
                projectName,
                projectPath,
                documents: [
                    {
                        title: '概要',
                        path: join(docsDir, projectName, 'analysis.md'),
                        type: 'overview',
                        status: 'not-started',
                        description: 'プロジェクトの概要とアーキテクチャの説明',
                    },
                    {
                        title: '詳細仕様',
                        path: join(docsDir, projectName, 'specifications.md'),
                        type: 'specification',
                        status: 'not-started',
                        description: '各モジュールの詳細な仕様',
                    },
                    {
                        title: 'API仕様',
                        path: join(docsDir, projectName, 'api.md'),
                        type: 'api',
                        status: 'not-started',
                        description: '公開APIの仕様とサンプル',
                    },
                    {
                        title: '依存関係',
                        path: join(docsDir, projectName, 'dependencies.md'),
                        type: 'dependency',
                        status: 'not-started',
                        description: '外部依存関係の詳細',
                    },
                    {
                        title: 'テスト仕様',
                        path: join(docsDir, projectName, 'tests.md'),
                        type: 'test',
                        status: 'not-started',
                        description: 'テストケースとカバレッジ',
                    },
                ],
                lastUpdated: new Date().toISOString(),
            };
            this.save();
        }
    }

    /**
     * ドキュメントの状態を更新
     */
    updateDocumentStatus(type: AnalysisState['documents'][0]['type'], status: 'completed' | 'pending' | 'not-started'): void {
        const doc = this.state.documents.find(d => d.type === type);
        if (doc) {
            doc.status = status;
            this.state.lastUpdated = new Date().toISOString();
            this.save();
        }
    }

    /**
     * 新しいドキュメントを追加
     */
    addDocument(doc: AnalysisState['documents'][0]): void {
        this.state.documents.push(doc);
        this.state.lastUpdated = new Date().toISOString();
        this.save();
    }

    /**
     * 状態を取得
     */
    getState(): AnalysisState {
        return this.state;
    }

    /**
     * 特定のタイプのドキュメントのパスを取得
     */
    getDocumentPath(type: AnalysisState['documents'][0]['type']): string | null {
        const doc = this.state.documents.find(d => d.type === type);
        return doc?.path || null;
    }

    /**
     * 状態を保存
     */
    private save(): void {
        writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    }
}