import { ChunkMetadata, ChunkingStrategy, FileType } from '../types';

/**
 * チャンカーの設定
 */
export interface ChunkerConfig {
    /**
     * チャンキング方式
     */
    strategy: ChunkingStrategy;

    /**
     * 最大チャンクサイズ（トークン数）
     */
    maxTokens?: number;

    /**
     * チャンク間のオーバーラップ（トークン数）
     */
    overlap?: number;

    /**
     * 追加の設定オプション
     */
    options?: Record<string, unknown>;
}

/**
 * チャンカーの結果
 */
export interface ChunkResult {
    /**
     * チャンクの内容
     */
    content: string;

    /**
     * チャンクのメタデータ
     */
    metadata: ChunkMetadata;
}

/**
 * チャンカーのベースクラス
 */
export abstract class BaseChunker {
    protected config: ChunkerConfig;
    protected filePath: string;
    protected fileType: FileType;

    constructor(filePath: string, fileType: FileType, config: ChunkerConfig) {
        this.filePath = filePath;
        this.fileType = fileType;
        this.config = config;
    }

    /**
     * テキストをチャンクに分割
     */
    abstract chunk(text: string): Promise<ChunkResult[]>;

    /**
     * トークン数を推定
     */
    protected estimateTokenCount(text: string): number {
        // 簡易的なトークン数推定（英数字は1トークン、その他の文字は2トークン）
        const alphanumeric = text.replace(/[^a-zA-Z0-9]/g, '').length;
        const others = text.length - alphanumeric;
        return alphanumeric + others * 2;
    }

    /**
     * メタデータを生成
     */
    protected createMetadata(
        startPosition: number,
        endPosition: number,
        tokenCount: number,
        additionalMetadata?: Record<string, unknown>
    ): ChunkMetadata {
        return {
            filePath: this.filePath,
            fileType: this.fileType,
            startPosition,
            endPosition,
            tokenCount,
            createdAt: new Date().toISOString(),
            additionalMetadata,
        };
    }
}

/**
 * 行ベースのチャンカー
 */
export class LineChunker extends BaseChunker {
    async chunk(text: string): Promise<ChunkResult[]> {
        const lines = text.split('\n');
        const chunks: ChunkResult[] = [];
        let currentChunk: string[] = [];
        let currentTokens = 0;
        let startLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineTokens = this.estimateTokenCount(line);

            if (currentTokens + lineTokens > (this.config.maxTokens || 1000)) {
                // 現在のチャンクを保存
                if (currentChunk.length > 0) {
                    const content = currentChunk.join('\n');
                    chunks.push({
                        content,
                        metadata: this.createMetadata(startLine, i - 1, currentTokens),
                    });

                    // オーバーラップを考慮して次のチャンクの開始位置を調整
                    const overlap = this.config.overlap || 0;
                    const overlapLines = Math.min(
                        overlap,
                        currentChunk.length
                    );
                    currentChunk = currentChunk.slice(-overlapLines);
                    startLine = i - overlapLines;
                    currentTokens = currentChunk.reduce(
                        (sum, line) => sum + this.estimateTokenCount(line),
                        0
                    );
                }
            }

            currentChunk.push(line);
            currentTokens += lineTokens;
        }

        // 残りのチャンクを保存
        if (currentChunk.length > 0) {
            const content = currentChunk.join('\n');
            chunks.push({
                content,
                metadata: this.createMetadata(
                    startLine,
                    lines.length - 1,
                    currentTokens
                ),
            });
        }

        return chunks;
    }
}

/**
 * 段落ベースのチャンカー
 */
export class ParagraphChunker extends BaseChunker {
    async chunk(text: string): Promise<ChunkResult[]> {
        const paragraphs = text.split(/\n\s*\n/);
        const chunks: ChunkResult[] = [];
        let currentChunk: string[] = [];
        let currentTokens = 0;
        let startPosition = 0;
        let currentPosition = 0;

        for (const paragraph of paragraphs) {
            const paragraphTokens = this.estimateTokenCount(paragraph);
            currentPosition += paragraph.length + 2; // +2 for the newlines

            if (currentTokens + paragraphTokens > (this.config.maxTokens || 1000)) {
                // 現在のチャンクを保存
                if (currentChunk.length > 0) {
                    const content = currentChunk.join('\n\n');
                    chunks.push({
                        content,
                        metadata: this.createMetadata(startPosition, currentPosition - 2, currentTokens),
                    });

                    currentChunk = [];
                    startPosition = currentPosition - paragraph.length - 2;
                    currentTokens = 0;
                }
            }

            currentChunk.push(paragraph);
            currentTokens += paragraphTokens;
        }

        // 残りのチャンクを保存
        if (currentChunk.length > 0) {
            const content = currentChunk.join('\n\n');
            chunks.push({
                content,
                metadata: this.createMetadata(
                    startPosition,
                    currentPosition,
                    currentTokens
                ),
            });
        }

        return chunks;
    }
}