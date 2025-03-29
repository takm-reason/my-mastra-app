/**
 * チャンクのメタデータ
 */
export interface ChunkMetadata {
    /**
     * ファイルパス
     */
    filePath: string;

    /**
     * ファイル形式
     */
    fileType: FileType;

    /**
     * チャンクの開始位置（行番号または文字位置）
     */
    startPosition: number;

    /**
     * チャンクの終了位置（行番号または文字位置）
     */
    endPosition: number;

    /**
     * チャンク内のトークン数
     */
    tokenCount: number;

    /**
     * チャンクの生成時刻
     */
    createdAt: string;

    /**
     * 追加のメタデータ
     */
    additionalMetadata?: Record<string, unknown>;
}

/**
 * サポートされるファイル形式
 */
export type FileType =
    | 'markdown'
    | 'text'
    | 'typescript'
    | 'javascript'
    | 'json'
    | 'html'
    | 'css'
    | 'yaml'
    | 'unknown';

/**
 * チャンキング方式
 */
export type ChunkingStrategy =
    | 'line'      // 行単位
    | 'paragraph' // 段落単位
    | 'token'     // トークン数単位
    | 'ast';      // ASTベース

/**
 * チャンクデータ
 */
export interface Chunk {
    /**
     * チャンクの一意なID
     */
    id: string;

    /**
     * チャンクのテキスト内容
     */
    content: string;

    /**
     * チャンクのメタデータ
     */
    metadata: ChunkMetadata;

    /**
     * チャンクの埋め込みベクトル
     */
    embedding?: number[];
}

/**
 * ベクトル検索結果
 */
export interface SearchResult {
    /**
     * 検索クエリ
     */
    query: string;

    /**
     * 類似チャンクのリスト
     */
    chunks: Array<{
        /**
         * チャンクの内容
         */
        chunk: Chunk;

        /**
         * 類似度スコア（0-1）
         */
        similarity: number;
    }>;

    /**
     * 検索にかかった時間（ミリ秒）
     */
    searchTime: number;
}

/**
 * データベースエラー
 */
export class DatabaseError extends Error {
    constructor(message: string, public cause?: unknown) {
        super(message);
        this.name = 'DatabaseError';
    }
}

/**
 * 埋め込み処理エラー
 */
export class EmbeddingError extends Error {
    constructor(message: string, public cause?: unknown) {
        super(message);
        this.name = 'EmbeddingError';
    }
}

/**
 * チャンキングエラー
 */
export class ChunkingError extends Error {
    constructor(message: string, public cause?: unknown) {
        super(message);
        this.name = 'ChunkingError';
    }
}