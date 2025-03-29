import { ChunkResult } from './chunkers/base';
import { Chunk } from './types';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { config } from 'dotenv';

// 開発用の環境変数を読み込み
config({ path: '.env.development' });

/**
 * 埋め込みの設定
 */
export interface EmbeddingConfig {
    /**
     * バッチサイズ
     */
    batchSize: number;

    /**
     * 同時実行数
     */
    concurrency: number;

    /**
     * リトライ回数
     */
    maxRetries: number;

    /**
     * リトライ時の待機時間（ミリ秒）
     */
    retryDelay: number;

    /**
     * OpenAI API Key
     */
    apiKey?: string;

    /**
     * OpenAIのモデル
     */
    model?: string;
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
 * OpenAI Embedding APIを使用した埋め込みジェネレーター
 */
export class OpenAIEmbedding {
    private config: EmbeddingConfig;
    private openai: OpenAI;

    constructor(config: Partial<EmbeddingConfig> = {}) {
        this.config = {
            batchSize: 100,
            concurrency: 5,
            maxRetries: 3,
            retryDelay: 1000,
            model: 'text-embedding-ada-002',
            apiKey: process.env.OPENAI_API_KEY,
            ...config,
        };

        if (!this.config.apiKey) {
            throw new EmbeddingError('OpenAI API key is required');
        }

        this.openai = new OpenAI({
            apiKey: this.config.apiKey,
        });
    }

    /**
     * テキストを埋め込みベクトルに変換
     */
    async embedText(text: string): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: this.config.model!,
                input: text,
            });

            return response.data[0].embedding;
        } catch (error) {
            throw new EmbeddingError('Failed to generate embedding', error);
        }
    }

    /**
     * チャンクIDを生成
     */
    private generateChunkId(chunk: ChunkResult): string {
        const data = `${chunk.content}:${JSON.stringify(chunk.metadata)}`;
        return createHash('sha256').update(data).digest('hex');
    }

    /**
     * チャンクを埋め込みベクトルに変換
     */
    async embedChunks(chunks: ChunkResult[]): Promise<Chunk[]> {
        const results: Chunk[] = [];
        const batches = this.createBatches(chunks, this.config.batchSize);

        for (const batch of batches) {
            const batchResults = await Promise.all(
                batch.map((chunk) => this.embedChunkWithRetry(chunk))
            );
            results.push(...batchResults);
        }

        return results;
    }

    /**
     * チャンクをバッチに分割
     */
    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * リトライ機能付きのチャンク埋め込み
     */
    private async embedChunkWithRetry(
        chunk: ChunkResult,
        retryCount = 0
    ): Promise<Chunk> {
        try {
            const embedding = await this.embedText(chunk.content);
            return {
                id: this.generateChunkId(chunk),
                content: chunk.content,
                metadata: chunk.metadata,
                embedding,
            };
        } catch (error) {
            if (retryCount < this.config.maxRetries) {
                await new Promise((resolve) =>
                    setTimeout(resolve, this.config.retryDelay)
                );
                return this.embedChunkWithRetry(chunk, retryCount + 1);
            }
            throw new EmbeddingError(
                `Failed to embed chunk after ${this.config.maxRetries} retries`,
                error
            );
        }
    }

    /**
     * クエリテキストを埋め込みベクトルに変換
     */
    async embedQuery(query: string): Promise<number[]> {
        try {
            return await this.embedText(query);
        } catch (error) {
            throw new EmbeddingError('Failed to embed query', error);
        }
    }
}

// エクスポートするデフォルトの埋め込みクラスを変更
export { OpenAIEmbedding as default };