import {
    parse,
    AST_NODE_TYPES,
    TSESTree,
} from '@typescript-eslint/typescript-estree';
import { BaseChunker, ChunkerConfig, ChunkResult } from './base';
import { FileType, ChunkingError } from '../types';
import { LineChunker, ParagraphChunker } from './base';

/**
 * コードチャンカーの設定
 */
export interface CodeChunkerConfig extends ChunkerConfig {
    /**
     * ASTノードの最小サイズ（行数）
     */
    minNodeSize?: number;

    /**
     * インポート文を含めるかどうか
     */
    includeImports?: boolean;

    /**
     * コメントを含めるかどうか
     */
    includeComments?: boolean;
}

/**
 * コードチャンカー（TypeScript/JavaScript用）
 */
export class CodeChunker extends BaseChunker {
    protected config: CodeChunkerConfig;

    constructor(filePath: string, fileType: FileType, config: CodeChunkerConfig) {
        super(filePath, fileType, config);
        this.config = config;
    }

    async chunk(text: string): Promise<ChunkResult[]> {
        try {
            // ASTを解析
            const ast = parse(text, {
                loc: true,
                range: true,
                tokens: true,
                comment: true,
                jsx: true,
            });

            const chunks: ChunkResult[] = [];

            // インポート文の処理
            if (this.config.includeImports) {
                const imports = ast.body.filter(
                    (node): node is TSESTree.ImportDeclaration =>
                        node.type === AST_NODE_TYPES.ImportDeclaration
                );

                if (imports.length > 0) {
                    const importText = text.slice(
                        imports[0].range[0],
                        imports[imports.length - 1].range[1]
                    );

                    chunks.push({
                        content: importText,
                        metadata: this.createMetadata(
                            imports[0].loc.start.line,
                            imports[imports.length - 1].loc.end.line,
                            this.estimateTokenCount(importText),
                            { nodeType: 'imports' }
                        ),
                    });
                }
            }

            // 各種宣言の処理
            for (const node of ast.body) {
                if (this.isDeclarationNode(node)) {
                    const nodeText = text.slice(node.range[0], node.range[1]);
                    const lines = nodeText.split('\n').length;

                    // 設定された最小サイズよりも大きい場合のみチャンクとして扱う
                    if (lines >= (this.config.minNodeSize || 1)) {
                        let finalContent = nodeText;
                        let leadingComments = '';

                        // コメントの処理
                        if (this.config.includeComments && ast.comments) {
                            const comments = this.findLeadingComments(ast.comments, node.range[0]);
                            if (comments.length > 0) {
                                leadingComments = comments.map((comment) => comment.value).join('\n');
                                finalContent = `/*${leadingComments}*/\n${nodeText}`;
                            }
                        }

                        chunks.push({
                            content: finalContent,
                            metadata: this.createMetadata(
                                node.loc.start.line,
                                node.loc.end.line,
                                this.estimateTokenCount(finalContent),
                                {
                                    nodeType: node.type,
                                    name: this.getNodeName(node),
                                    hasComments: leadingComments.length > 0,
                                }
                            ),
                        });
                    }
                }
            }

            // エクスポート文の処理
            const exports = ast.body.filter(
                (node) =>
                    node.type === AST_NODE_TYPES.ExportNamedDeclaration ||
                    node.type === AST_NODE_TYPES.ExportDefaultDeclaration
            );

            for (const node of exports) {
                const nodeText = text.slice(node.range[0], node.range[1]);
                chunks.push({
                    content: nodeText,
                    metadata: this.createMetadata(
                        node.loc.start.line,
                        node.loc.end.line,
                        this.estimateTokenCount(nodeText),
                        { nodeType: 'export' }
                    ),
                });
            }

            return chunks;
        } catch (error) {
            throw new ChunkingError('Failed to chunk code', error);
        }
    }

    /**
     * ノードが宣言ノードかどうかを判定
     */
    private isDeclarationNode(
        node: TSESTree.Node
    ): node is
        | TSESTree.FunctionDeclaration
        | TSESTree.ClassDeclaration
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration {
        return (
            node.type === AST_NODE_TYPES.FunctionDeclaration ||
            node.type === AST_NODE_TYPES.ClassDeclaration ||
            node.type === AST_NODE_TYPES.TSInterfaceDeclaration ||
            node.type === AST_NODE_TYPES.TSTypeAliasDeclaration
        );
    }

    /**
     * ノードから名前を取得
     */
    private getNodeName(
        node:
            | TSESTree.FunctionDeclaration
            | TSESTree.ClassDeclaration
            | TSESTree.TSInterfaceDeclaration
            | TSESTree.TSTypeAliasDeclaration
    ): string {
        if ('id' in node && node.id && 'name' in node.id) {
            return node.id.name;
        }
        return 'anonymous';
    }

    /**
     * 先行コメントを探す
     */
    private findLeadingComments(
        comments: TSESTree.Comment[],
        nodeStart: number
    ): TSESTree.Comment[] {
        return comments.filter(
            (comment) =>
                comment.range[1] <= nodeStart &&
                !comments.some(
                    (other) =>
                        other !== comment &&
                        other.range[1] <= nodeStart &&
                        other.range[1] > comment.range[1]
                )
        );
    }
}

/**
 * チャンカーファクトリー
 */
export class ChunkerFactory {
    static create(
        filePath: string,
        fileType: FileType,
        config: ChunkerConfig
    ): BaseChunker {
        switch (fileType) {
            case 'typescript':
            case 'javascript':
                return new CodeChunker(filePath, fileType, {
                    ...config,
                    strategy: 'ast',
                    minNodeSize: 3,
                    includeImports: true,
                    includeComments: true,
                });

            case 'markdown':
            case 'text':
                return new ParagraphChunker(filePath, fileType, config);

            case 'json':
            case 'yaml':
                return new LineChunker(filePath, fileType, config);

            default:
                // デフォルトは行ベースのチャンカーを使用
                return new LineChunker(filePath, fileType, config);
        }
    }
}