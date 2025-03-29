import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { AnalysisResult, DirectoryStructure, MarkdownOutput } from './types';
import { AnalysisStateManager } from './state';

export function generateMarkdown(
    result: AnalysisResult,
    stateManager: AnalysisStateManager
): MarkdownOutput {
    // メインの概要ドキュメントを生成
    const mainContent = generateOverviewMarkdown(result);
    const mainPath = stateManager.getDocumentPath('overview')!;

    // 概要ドキュメントを保存
    writeFileSync(mainPath, mainContent, 'utf-8');
    stateManager.updateDocumentStatus('overview', 'completed');

    // 追加ドキュメントのリストを作成
    const additional = result.specifications
        ? [generateSpecificationsMarkdown(result, stateManager)]
        : [];

    // 他の可能な解析の状態を更新
    stateManager.updateDocumentStatus('specification', result.specifications ? 'completed' : 'not-started');
    stateManager.updateDocumentStatus('api', 'not-started');
    stateManager.updateDocumentStatus('dependency', 'not-started');
    stateManager.updateDocumentStatus('test', 'not-started');

    return {
        main: {
            content: mainContent,
            path: mainPath,
        },
        additional,
    };
}

function generateOverviewMarkdown(result: AnalysisResult): string {
    let content = `# ${result.projectName} プロジェクト解析\n\n`;

    // ディレクトリ構造
    content += '## ディレクトリ構造\n\n```\n';
    content += formatDirectoryStructure(result.structure, '');
    content += '```\n\n';

    // 主要コンポーネントの説明
    content += '## 主要コンポーネント\n\n';
    for (const component of result.keyComponents) {
        content += `### ${component.path}\n${component.description}\n\n`;
    }

    // アーキテクチャ概要
    content += '## アーキテクチャ概要\n\n';
    content += `${result.architecture.overview}\n\n`;

    // 設計パターン
    if (result.architecture.patterns.length > 0) {
        content += '### 使用されている設計パターン\n\n';
        for (const pattern of result.architecture.patterns) {
            content += `- ${pattern}\n`;
        }
        content += '\n';
    }

    // 依存関係
    content += '### 主要な依存関係\n\n';
    content += '| パッケージ名 | バージョン | 用途 |\n';
    content += '|------------|------------|------|\n';
    for (const dep of result.architecture.dependencies) {
        content += `| ${dep.name} | ${dep.version} | ${dep.purpose} |\n`;
    }
    content += '\n';

    // 追加の解析可能項目
    content += '## 追加の解析可能項目\n\n';
    content += '以下の詳細な解析が可能です：\n\n';
    content += '1. 📋 **詳細仕様** - 各モジュールの詳細な実装仕様\n';
    content += '2. 📚 **API仕様** - 公開APIの詳細なドキュメント\n';
    content += '3. 🔗 **依存関係詳細** - プロジェクトの依存関係の詳細分析\n';
    content += '4. 🧪 **テスト仕様** - テストケースとカバレッジ情報\n\n';
    content += '必要な項目の解析を指示してください。\n';

    return content;
}

function generateSpecificationsMarkdown(
    result: AnalysisResult,
    stateManager: AnalysisStateManager
): MarkdownOutput['additional'][0] {
    const content = generateDetailedSpecifications(result);
    const path = stateManager.getDocumentPath('specification')!;

    // 詳細仕様を保存
    writeFileSync(path, content, 'utf-8');

    return {
        title: '詳細仕様',
        content,
        path,
        status: 'completed',
    };
}

function generateDetailedSpecifications(result: AnalysisResult): string {
    let content = `# ${result.projectName} 詳細仕様\n\n`;

    if (!result.specifications) {
        return content + '詳細仕様は生成されていません。';
    }

    for (const spec of result.specifications) {
        content += `## ${spec.path}\n\n`;
        content += `**目的**: ${spec.purpose}\n\n`;

        if (spec.exports.length > 0) {
            content += '### エクスポート\n\n';
            content += '| 名前 | 種類 | 説明 |\n';
            content += '|------|------|------|\n';
            for (const exp of spec.exports) {
                content += `| ${exp.name} | ${exp.type} | ${exp.description} |\n`;
            }
            content += '\n';
        }

        if (spec.dependencies.length > 0) {
            content += '### 依存モジュール\n\n';
            for (const dep of spec.dependencies) {
                content += `- ${dep}\n`;
            }
            content += '\n';
        }
    }

    return content;
}

function formatDirectoryStructure(
    structure: DirectoryStructure,
    indent: string
): string {
    let result = `${indent}${structure.name}${structure.type === 'file' ? ` (${structure.extension})` : ''
        }\n`;

    if (structure.children) {
        for (const child of structure.children) {
            result += formatDirectoryStructure(child, indent + '  ');
        }
    }

    return result;
}