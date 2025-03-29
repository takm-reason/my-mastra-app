import { createClient } from '@libsql/client';
import { join } from 'path';
import { Chunk, SearchResult, DatabaseError } from './types';

export class VectorStore {
    private client;
    private initialized = false;

    constructor(dbPath: string = join(process.cwd(), 'vector_store.db')) {
        this.client = createClient({
            url: `file:${dbPath}`,
        });
    }

    /**
     * データベースの初期化
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // チャンクテーブルの作成
            await this.client.execute(`
        CREATE TABLE IF NOT EXISTS chunks (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata JSON NOT NULL,
          embedding BLOB,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

            // ベクトル類似度検索のためのインデックスを作成
            await this.client.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
          content,
          metadata UNINDEXED,
          content='chunks'
        );
      `);

            this.initialized = true;
        } catch (error) {
            throw new DatabaseError('Failed to initialize database', error);
        }
    }

    /**
     * チャンクの保存
     */
    async saveChunks(chunks: Chunk[]): Promise<void> {
        await this.initialize();

        try {
            // トランザクション開始
            await this.client.execute('BEGIN TRANSACTION');

            for (const chunk of chunks) {
                await this.client.execute({
                    sql: `
            INSERT OR REPLACE INTO chunks (id, content, metadata, embedding)
            VALUES (?, ?, ?, ?);
          `,
                    args: [
                        chunk.id,
                        chunk.content,
                        JSON.stringify(chunk.metadata),
                        chunk.embedding ? Buffer.from(new Float32Array(chunk.embedding).buffer) : null,
                    ],
                });

                // 全文検索用のインデックスも更新
                await this.client.execute({
                    sql: `
            INSERT OR REPLACE INTO chunks_fts (rowid, content, metadata)
            VALUES ((SELECT rowid FROM chunks WHERE id = ?), ?, ?);
          `,
                    args: [chunk.id, chunk.content, JSON.stringify(chunk.metadata)],
                });
            }

            // トランザクション確定
            await this.client.execute('COMMIT');
        } catch (error) {
            // エラー時はロールバック
            await this.client.execute('ROLLBACK');
            throw new DatabaseError('Failed to save chunks', error);
        }
    }

    /**
     * ベクトル検索
     */
    async search(queryVector: number[], limit: number = 5): Promise<SearchResult['chunks']> {
        await this.initialize();

        try {
            const queryBuffer = Buffer.from(new Float32Array(queryVector).buffer);

            // コサイン類似度を計算して上位のチャンクを取得
            const results = await this.client.execute({
                sql: `
          WITH similarities AS (
            SELECT
              id,
              content,
              metadata,
              (
                embedding * ? /
                (SQRT(embedding * embedding) * SQRT(? * ?))
              ) as similarity
            FROM chunks
            WHERE embedding IS NOT NULL
            ORDER BY similarity DESC
            LIMIT ?
          )
          SELECT id, content, metadata, similarity
          FROM similarities
          WHERE similarity > 0;
        `,
                args: [queryBuffer, queryBuffer, queryBuffer, limit],
            });

            return results.rows.map((row: any) => ({
                chunk: {
                    id: row.id,
                    content: row.content,
                    metadata: JSON.parse(row.metadata),
                },
                similarity: row.similarity,
            }));
        } catch (error) {
            throw new DatabaseError('Failed to perform vector search', error);
        }
    }

    /**
     * キーワード検索（フォールバック用）
     */
    async searchByKeywords(query: string, limit: number = 5): Promise<SearchResult['chunks']> {
        await this.initialize();

        try {
            const results = await this.client.execute({
                sql: `
          SELECT 
            c.id,
            c.content,
            c.metadata,
            bm25(chunks_fts) as score
          FROM chunks_fts
          JOIN chunks c ON chunks_fts.rowid = c.rowid
          WHERE chunks_fts MATCH ?
          ORDER BY score DESC
          LIMIT ?;
        `,
                args: [query, limit],
            });

            return results.rows.map((row: any) => ({
                chunk: {
                    id: row.id,
                    content: row.content,
                    metadata: JSON.parse(row.metadata),
                },
                similarity: 1 / (1 + Math.exp(-row.score)), // スコアを0-1の範囲に正規化
            }));
        } catch (error) {
            throw new DatabaseError('Failed to perform keyword search', error);
        }
    }

    /**
     * チャンクの取得
     */
    async getChunk(id: string): Promise<Chunk | null> {
        await this.initialize();

        try {
            const result = await this.client.execute({
                sql: 'SELECT * FROM chunks WHERE id = ?;',
                args: [id],
            });

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0] as any;
            return {
                id: row.id,
                content: row.content,
                metadata: JSON.parse(row.metadata),
                embedding: row.embedding
                    ? Array.from(new Float32Array(row.embedding))
                    : undefined,
            };
        } catch (error) {
            throw new DatabaseError('Failed to get chunk', error);
        }
    }

    /**
     * データベースの統計情報を取得
     */
    async getStats(): Promise<{
        totalChunks: number;
        totalFiles: number;
        averageChunkSize: number;
    }> {
        await this.initialize();

        try {
            const stats = await this.client.execute(`
        SELECT
          COUNT(*) as total_chunks,
          COUNT(DISTINCT json_extract(metadata, '$.filePath')) as total_files,
          AVG(length(content)) as avg_chunk_size
        FROM chunks;
      `);

            const row = stats.rows[0] as any;
            return {
                totalChunks: Number(row.total_chunks) || 0,
                totalFiles: Number(row.total_files) || 0,
                averageChunkSize: Number(row.avg_chunk_size) || 0,
            };
        } catch (error) {
            throw new DatabaseError('Failed to get database statistics', error);
        }
    }
}