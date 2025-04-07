import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

// ファイルの最大サイズ（バイト）
const MAX_FILE_SIZE = 100 * 1024; // 100KB
const MAX_TOTAL_SIZE = 1024 * 1024; // 1MB

// 型定義
interface Screen {
    name: string;
    path: string;
    components: string[];
    description: string;
}

interface ApiParameter {
    name: string;
    type: string;
    required: boolean;
    description: string;
}

interface ApiResponse {
    description: string;
    schema: unknown;
}

interface Api {
    path: string;
    method: string;
    description: string;
    parameters: ApiParameter[];
    responses: Record<string, ApiResponse>;
}

interface Specification {
    name: string;
    path: string;
    summary: string;
    type: string;
    size: number;
}

// スキーマ定義
const screenSchema = z.object({
    name: z.string(),
    path: z.string(),
    components: z.array(z.string()),
    description: z.string(),
});

const apiSchema = z.object({
    path: z.string(),
    method: z.string(),
    description: z.string(),
    parameters: z.array(z.object({
        name: z.string(),
        type: z.string(),
        required: z.boolean(),
        description: z.string(),
    })),
    responses: z.record(z.string(), z.object({
        description: z.string(),
        schema: z.unknown(),
    })),
});

const specificationSchema = z.object({
    name: z.string(),
    path: z.string(),
    summary: z.string(),
    type: z.string(),
    size: z.number(),
});

// ツール実装
export const findScreensTool = createTool({
    id: 'find-screens',
    description: '画面一覧を抽出',
    inputSchema: z.object({
        repoPath: z.string().describe('リポジトリのパス'),
    }),
    outputSchema: z.array(screenSchema),
    execute: async ({ context }) => {
        const screens: Screen[] = [];
        const fileExtensions = ['.tsx', '.jsx', '.vue'];
        let totalSize = 0;

        const processFile = async (filePath: string) => {
            const stats = await fs.stat(filePath);
            if (stats.size > MAX_FILE_SIZE) return;
            if (totalSize + stats.size > MAX_TOTAL_SIZE) return;
            totalSize += stats.size;

            const content = await fs.readFile(filePath, 'utf-8');
            const componentMatches = content.match(/export\s+(?:default\s+)?(?:class|function|const)\s+(\w+)/g);
            if (componentMatches) {
                const routeMatch = content.match(/path:\s*['"]([^'"]+)['"]/);
                const descriptionMatch = content.match(/\/\*\*\s*(.*?)\s*\*\//s);
                screens.push({
                    name: path.basename(filePath, path.extname(filePath)),
                    path: routeMatch?.[1] || '',
                    components: [],
                    description: descriptionMatch?.[1]?.replace(/\s*\*\s*/g, ' ').trim() || '説明なし',
                });
            }
        };

        const scanDir = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (totalSize > MAX_TOTAL_SIZE) break;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                        await scanDir(fullPath);
                    }
                } else if (fileExtensions.includes(path.extname(entry.name))) {
                    await processFile(fullPath);
                }
            }
        };

        await scanDir(context.repoPath);
        return screens;
    },
});

export const findApisTool = createTool({
    id: 'find-apis',
    description: 'API仕様一覧を抽出',
    inputSchema: z.object({
        repoPath: z.string().describe('リポジトリのパス'),
    }),
    outputSchema: z.array(apiSchema),
    execute: async ({ context }) => {
        const apis: Api[] = [];
        const fileExtensions = ['.ts', '.js', '.yaml', '.json'];
        let totalSize = 0;

        const processFile = async (filePath: string) => {
            const stats = await fs.stat(filePath);
            if (stats.size > MAX_FILE_SIZE) return;
            if (totalSize + stats.size > MAX_TOTAL_SIZE) return;
            totalSize += stats.size;

            const content = await fs.readFile(filePath, 'utf-8');
            const ext = path.extname(filePath);

            if (ext === '.yaml' || ext === '.json') {
                try {
                    const spec = ext === '.yaml'
                        ? require('yaml').parse(content)
                        : JSON.parse(content);

                    if (spec?.paths) {
                        for (const [pathStr, methods] of Object.entries(spec.paths)) {
                            for (const [method, details] of Object.entries(methods as Record<string, any>)) {
                                apis.push({
                                    path: pathStr,
                                    method: method.toUpperCase(),
                                    description: (details as any).description || (details as any).summary || '',
                                    parameters: ((details as any).parameters || []).map((p: any) => ({
                                        name: p.name,
                                        type: p.type || p.schema?.type || 'unknown',
                                        required: p.required || false,
                                        description: p.description || '',
                                    })),
                                    responses: (details as any).responses || {},
                                });
                            }
                        }
                    }
                } catch {
                    // API仕様ファイルではない可能性があるため、スキップ
                }
            }
        };

        const scanDir = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (totalSize > MAX_TOTAL_SIZE) break;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                        await scanDir(fullPath);
                    }
                } else if (fileExtensions.includes(path.extname(entry.name))) {
                    await processFile(fullPath);
                }
            }
        };

        await scanDir(context.repoPath);
        return apis;
    },
});

export const findSpecificationsTool = createTool({
    id: 'find-specifications',
    description: '仕様ドキュメントを抽出',
    inputSchema: z.object({
        repoPath: z.string().describe('リポジトリのパス'),
    }),
    outputSchema: z.array(specificationSchema),
    execute: async ({ context }) => {
        const specs: Specification[] = [];
        const docExtensions = ['.md', '.txt'];
        const docDirs = ['docs', 'doc', 'specifications', 'spec', 'specs'];
        let totalSize = 0;

        const processFile = async (filePath: string) => {
            const stats = await fs.stat(filePath);
            if (stats.size > MAX_FILE_SIZE) {
                specs.push({
                    name: path.basename(filePath, path.extname(filePath)),
                    path: path.relative(context.repoPath, filePath),
                    summary: 'ファイルサイズが大きすぎるため、概要のみ記録',
                    type: path.extname(filePath).slice(1),
                    size: stats.size,
                });
                return;
            }
            if (totalSize + stats.size > MAX_TOTAL_SIZE) return;
            totalSize += stats.size;

            const content = await fs.readFile(filePath, 'utf-8');
            const relativePath = path.relative(context.repoPath, filePath);

            specs.push({
                name: path.basename(filePath, path.extname(filePath)),
                path: relativePath,
                summary: content.slice(0, 1000) + (content.length > 1000 ? '...' : ''),
                type: path.extname(filePath).slice(1),
                size: stats.size,
            });
        };

        const scanDir = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (totalSize > MAX_TOTAL_SIZE) break;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                        if (docDirs.includes(entry.name.toLowerCase())) {
                            const docEntries = await fs.readdir(fullPath, { withFileTypes: true });
                            for (const docEntry of docEntries) {
                                if (!docEntry.isDirectory()) {
                                    await processFile(path.join(fullPath, docEntry.name));
                                }
                            }
                        } else {
                            await scanDir(fullPath);
                        }
                    }
                } else if (docExtensions.includes(path.extname(entry.name))) {
                    await processFile(fullPath);
                }
            }
        };

        await scanDir(context.repoPath);
        return specs;
    },
});