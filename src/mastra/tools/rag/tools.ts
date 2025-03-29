import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { join } from 'path';
import { FileProcessor } from './processor';
import { VectorStore } from './db';
import { ChunkingError, EmbeddingError } from './types';
import OpenAIEmbedding from './embeddings';

// 共有のインスタンス
const vectorStore = new VectorStore();
const embedding = new OpenAIEmbedding();

/**
 * メタデータをRecord<string, unknown>型に変換
 */
function convertMetadata(metadata: Record<string, any>): Record<string, unknown> {
    return Object.entries(metadata).reduce(
        (acc, [key, value]) => ({
            ...acc,
            [key]: value,
        }),
        {}
    );
}

/**
 * ファイル処理ツール
 */
export const fileProcessorTool = createTool({
    id: 'file-processor',
    description: 'Process files and generate vector embeddings',
    inputSchema: z.object({
        files: z
            .array(z.string())
            .describe('File paths or glob patterns to process'),
        config: z
            .object({
                maxTokens: z.number().optional(),
                overlap: z.number().optional(),
                maxFileSize: z.number().optional(),
                embedding: z
                    .object({
                        batchSize: z.number(),
                        concurrency: z.number(),
                        maxRetries: z.number(),
                        retryDelay: z.number(),
                        apiKey: z.string().optional(),
                    })
                    .optional(),
            })
            .optional()
            .describe('Configuration options for processing'),
    }),
    outputSchema: z.object({
        processedFiles: z.number(),
        totalChunks: z.number(),
        succeeded: z.array(z.string()),
        failed: z.array(
            z.object({
                path: z.string(),
                error: z.string(),
            })
        ),
        processingTime: z.number(),
        summary: z.string(),
    }),
    execute: async ({ context }) => {
        try {
            await vectorStore.initialize();

            const processor = new FileProcessor(vectorStore, {
                maxTokens: context.config?.maxTokens,
                overlap: context.config?.overlap,
                maxFileSize: context.config?.maxFileSize,
                embedding: context.config?.embedding ?? {
                    batchSize: 100,
                    concurrency: 5,
                    maxRetries: 3,
                    retryDelay: 1000,
                    apiKey: process.env.OPENAI_API_KEY,
                },
            });

            const workspacePath = join(process.cwd(), 'src/mastra/workspace');
            const filePaths = context.files.map((f) => join(workspacePath, f));

            const result = await processor.processFiles(filePaths);

            return {
                ...result,
                summary: `処理完了: ${result.processedFiles}ファイル処理、${result.totalChunks
                    }チャンク生成（${result.processingTime}ms）${result.failed.length > 0
                        ? `\n失敗: ${result.failed.length}ファイル`
                        : ''
                    }`,
            };
        } catch (error) {
            if (error instanceof ChunkingError || error instanceof EmbeddingError) {
                throw new Error(`処理エラー: ${error.message}`);
            }
            throw error;
        }
    },
});

/**
 * ベクトル検索ツール
 */
export const vectorQueryTool = createTool({
    id: 'vector-query',
    description: 'Search through vector embeddings',
    inputSchema: z.object({
        query: z.string().describe('Search query text'),
        limit: z
            .number()
            .optional()
            .describe('Maximum number of results to return'),
        threshold: z
            .number()
            .optional()
            .describe('Minimum similarity threshold (0-1)'),
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                content: z.string(),
                metadata: z.record(z.unknown()),
                similarity: z.number(),
            })
        ),
        searchTime: z.number(),
        summary: z.string(),
    }),
    execute: async ({ context }) => {
        try {
            await vectorStore.initialize();

            const startTime = Date.now();

            // クエリをベクトル化
            const queryVector = await embedding.embedQuery(context.query);

            // ベクトル検索を実行
            const searchResults = await vectorStore.search(
                queryVector,
                context.limit || 5
            );

            const searchTime = Date.now() - startTime;

            // 結果を変換
            const results = searchResults
                .filter((r) => r.similarity >= (context.threshold || 0.5))
                .map((r) => ({
                    content: r.chunk.content,
                    metadata: convertMetadata(r.chunk.metadata),
                    similarity: r.similarity,
                }));

            return {
                results,
                searchTime,
                summary: `検索完了: ${results.length}件の結果（${searchTime}ms）`,
            };
        } catch (error) {
            throw new Error(`検索エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
    },
});
