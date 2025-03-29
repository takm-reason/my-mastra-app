export interface AnalyzerOptions {
    /**
     * 解析対象のディレクトリパス
     * workspaceからの相対パス (例: "cloned/typescript")
     */
    targetDir: string;

    /**
     * 解析対象の拡張子
     * 例: [".ts", ".js", ".json"]
     */
    includeExtensions?: string[];

    /**
     * 除外する拡張子
     * 例: [".test.ts", ".spec.js"]
     */
    excludeExtensions?: string[];

    /**
     * 詳細な仕様をまとめるかどうか
     * trueの場合、各ファイルの詳細な解析も行います
     */
    detailed?: boolean;

    /**
     * 無視ファイルをチェックするかどうか
     * trueの場合、.gitignoreや.dockerignoreを考慮します
     */
    respectIgnoreFiles?: boolean;

    /**
     * 追加の解析指示
     * 特定の詳細解析を要求する場合に使用
     */
    additionalAnalysis?: AdditionalAnalysisRequest[];
}

export interface DirectoryStructure {
    name: string;
    type: 'file' | 'directory';
    children?: DirectoryStructure[];
    extension?: string;
    path: string;
}

export interface AnalysisResult {
    /**
     * プロジェクト名
     */
    projectName: string;

    /**
     * ディレクトリ構造
     */
    structure: DirectoryStructure;

    /**
     * 主要なファイル/ディレクトリの説明
     */
    keyComponents: {
        path: string;
        description: string;
    }[];

    /**
     * 設計の概要説明
     */
    architecture: {
        overview: string;
        patterns: string[];
        dependencies: {
            name: string;
            version: string;
            purpose: string;
        }[];
    };

    /**
     * 詳細な仕様（detailed = trueの場合のみ）
     */
    specifications?: {
        path: string;
        purpose: string;
        exports: {
            name: string;
            type: string;
            description: string;
        }[];
        dependencies: string[];
    }[];
}

export interface MarkdownOutput {
    /**
     * メインのマークダウンコンテンツ
     */
    main: {
        content: string;
        path: string;
    };

    /**
     * 追加のマークダウンファイル
     */
    additional: {
        title: string;
        content: string;
        path: string;
        status: 'completed' | 'pending' | 'not-started';
    }[];
}

export interface AnalysisState {
    /**
     * 解析対象のプロジェクト名
     */
    projectName: string;

    /**
     * プロジェクトのパス
     */
    projectPath: string;

    /**
     * 生成済みのドキュメント
     */
    documents: {
        title: string;
        path: string;
        type: 'overview' | 'specification' | 'api' | 'dependency' | 'test';
        status: 'completed' | 'pending' | 'not-started';
        description: string;
    }[];

    /**
     * 最終更新日時
     */
    lastUpdated: string;
}

export interface AdditionalAnalysisRequest {
    /**
     * 解析の種類
     */
    type: 'specification' | 'api' | 'dependency' | 'test';

    /**
     * 対象パス（オプション）
     */
    targetPath?: string;

    /**
     * 追加のオプション
     */
    options?: Record<string, unknown>;
}