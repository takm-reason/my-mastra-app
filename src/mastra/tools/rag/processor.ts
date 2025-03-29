import { readFileSync, statSync } from 'fs';
import { extname } from 'path';
import { ChunkerFactory } from './chunkers/code';
import { FileType } from './types';
import { VectorStore } from './db';
import { EmbeddingError } from './embeddings';
import OpenAIEmbedding from './embeddings';
import { ChunkingError } from './types';

/**
 * ファイル処理の設定
 */
export interface ProcessorConfig {
    /**
     * チャンクの最大サイズ（トークン数）
     */
    maxTokens: number;

    /**
     * チャンク間のオーバーラップ（トークン数）
     */
    overlap: number;

    /**
     * ファイルの最大サイズ（バイト）
     */
    maxFileSize: number;

    /**
     * 埋め込みの設定
     */
    embedding: {
        batchSize: number;
        concurrency: number;
        maxRetries: number;
        retryDelay: number;
        apiKey?: string;
    };
}

/**
 * 処理結果
 */
export interface ProcessResult {
    /**
     * 処理したファイル数
     */
    processedFiles: number;

    /**
     * 生成されたチャンク数
     */
    totalChunks: number;

    /**
     * 成功したファイル
     */
    succeeded: string[];

    /**
     * 失敗したファイル
     */
    failed: Array<{
        path: string;
        error: string;
    }>;

    /**
     * 処理時間（ミリ秒）
     */
    processingTime: number;
}

/**
 * ファイル処理エラー
 */
export class ProcessorError extends Error {
    constructor(message: string, public cause?: unknown) {
        super(message);
        this.name = 'ProcessorError';
    }
}

/**
 * ファイルプロセッサー
 */
export class FileProcessor {
    private config: ProcessorConfig;
    private vectorStore: VectorStore;
    private embedding: OpenAIEmbedding;

    constructor(
        vectorStore: VectorStore,
        config: Partial<ProcessorConfig> = {}
    ) {
        this.config = {
            maxTokens: 1000,
            overlap: 200,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            embedding: {
                batchSize: 100,
                concurrency: 5,
                maxRetries: 3,
                retryDelay: 1000,
                apiKey: process.env.OPENAI_API_KEY,
            },
            ...config,
        };

        this.vectorStore = vectorStore;
        this.embedding = new OpenAIEmbedding(this.config.embedding);
    }

    /**
     * ファイルを処理してベクトル化
     */
    async processFile(filePath: string): Promise<ProcessResult> {
        const startTime = Date.now();
        const result: ProcessResult = {
            processedFiles: 0,
            totalChunks: 0,
            succeeded: [],
            failed: [],
            processingTime: 0,
        };

        try {
            // ファイルの存在とサイズをチェック
            const stats = statSync(filePath);
            if (stats.size > this.config.maxFileSize) {
                throw new ProcessorError(
                    `File size exceeds limit: ${stats.size} > ${this.config.maxFileSize}`
                );
            }

            // ファイルの内容を読み込み
            const content = readFileSync(filePath, 'utf-8');
            if (!content.trim()) {
                throw new ProcessorError('File is empty');
            }

            // ファイルタイプを判定
            const fileType = this.detectFileType(filePath);

            // チャンカーを作成
            const chunker = ChunkerFactory.create(filePath, fileType, {
                strategy: fileType === 'typescript' || fileType === 'javascript'
                    ? 'ast'
                    : 'paragraph',
                maxTokens: this.config.maxTokens,
                overlap: this.config.overlap,
            });

            // チャンクに分割
            const chunks = await chunker.chunk(content);

            // チャンクを埋め込みベクトルに変換
            const embeddedChunks = await this.embedding.embedChunks(chunks);

            // ベクトルストアに保存
            await this.vectorStore.saveChunks(embeddedChunks);

            result.processedFiles = 1;
            result.totalChunks = chunks.length;
            result.succeeded.push(filePath);

        } catch (error) {
            if (
                error instanceof ChunkingError ||
                error instanceof EmbeddingError ||
                error instanceof ProcessorError
            ) {
                result.failed.push({
                    path: filePath,
                    error: error.message,
                });
            } else {
                result.failed.push({
                    path: filePath,
                    error: 'Unknown error occurred',
                });
            }
        } finally {
            result.processingTime = Date.now() - startTime;
        }

        return result;
    }

    /**
     * 複数のファイルを処理
     */
    async processFiles(filePaths: string[]): Promise<ProcessResult> {
        const startTime = Date.now();
        const result: ProcessResult = {
            processedFiles: 0,
            totalChunks: 0,
            succeeded: [],
            failed: [],
            processingTime: 0,
        };

        // 並行処理で各ファイルを処理
        const results = await Promise.all(
            filePaths.map((path) => this.processFile(path))
        );

        // 結果を集計
        for (const r of results) {
            result.processedFiles += r.processedFiles;
            result.totalChunks += r.totalChunks;
            result.succeeded.push(...r.succeeded);
            result.failed.push(...r.failed);
        }

        result.processingTime = Date.now() - startTime;
        return result;
    }

    /**
     * ファイルの種類を判定
     */
    private detectFileType(filePath: string): FileType {
        const ext = extname(filePath).toLowerCase();
        switch (ext) {
            case '.ts':
            case '.tsx':
                return 'typescript';
            case '.js':
            case '.jsx':
                return 'javascript';
            case '.md':
                return 'markdown';
            case '.json':
                return 'json';
            case '.yaml':
            case '.yml':
                return 'yaml';
            default:
                return 'text';
        }
    }
}