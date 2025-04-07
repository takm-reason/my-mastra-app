import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { simpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

// GitHub API client
const octokit = new Octokit();
const git = simpleGit();

// Schemas
const repositoryInfoSchema = z.object({
    name: z.string(),
    fullName: z.string(),
    description: z.string().nullable(),
    defaultBranch: z.string(),
    stars: z.number(),
    forks: z.number(),
    openIssues: z.number(),
    language: z.string().nullable(),
    topics: z.array(z.string()),
    lastUpdated: z.string(),
});

const codeAnalysisSchema = z.object({
    files: z.array(z.string()),
    languages: z.record(z.number()),
    totalSize: z.number(),
    dependencies: z.record(z.string()),
    devDependencies: z.record(z.string()),
    packageManager: z.enum(['npm', 'yarn', 'pnpm']).nullable(),
});

// Cache helper functions
const getCacheDir = () => {
    return path.join(process.cwd(), '.mastra', 'cache', 'github');
};

const getCachePath = (repoUrl: string) => {
    const hash = createHash('md5').update(repoUrl).digest('hex');
    return path.join(getCacheDir(), hash);
};

const ensureCacheDir = async () => {
    const cacheDir = getCacheDir();
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
};

const isCacheValid = async (cachePath: string, maxAge: number = 3600000) => {
    try {
        const stats = await fs.stat(cachePath);
        return Date.now() - stats.mtimeMs < maxAge;
    } catch {
        return false;
    }
};

// Tool implementations
export const githubRepoInfoTool = createTool({
    id: 'github-repo-info',
    description: 'GitHubリポジトリの詳細情報を取得',
    inputSchema: z.object({
        owner: z.string().describe('リポジトリの所有者'),
        repo: z.string().describe('リポジトリ名'),
    }),
    outputSchema: repositoryInfoSchema,
    execute: async ({ context }) => {
        try {
            const { data } = await octokit.repos.get({
                owner: context.owner,
                repo: context.repo,
            });

            return {
                name: data.name,
                fullName: data.full_name,
                description: data.description,
                defaultBranch: data.default_branch,
                stars: data.stargazers_count,
                forks: data.forks_count,
                openIssues: data.open_issues_count,
                language: data.language,
                topics: data.topics || [],
                lastUpdated: data.updated_at,
            };
        } catch (error: any) {
            if (error?.status === 404) {
                throw new Error(`リポジトリが見つかりません: ${context.owner}/${context.repo}`);
            }
            throw new Error(`リポジトリ情報の取得に失敗: ${error?.message || '不明なエラー'}`);
        }
    },
});

export const githubCloneTool = createTool({
    id: 'github-clone',
    description: 'GitHubリポジトリをクローン（キャッシュ機能付き）',
    inputSchema: z.object({
        repoUrl: z.string().describe('GitHubリポジトリのURL'),
        branch: z.string().optional().describe('クローンするブランチ'),
        forceFresh: z.boolean().optional().describe('キャッシュを無視して新規クローン'),
    }),
    outputSchema: z.object({
        path: z.string(),
        branch: z.string(),
        commit: z.string(),
    }),
    execute: async ({ context }) => {
        try {
            await ensureCacheDir();
            const cachePath = getCachePath(context.repoUrl);
            const cacheValid = await isCacheValid(cachePath);

            if (!context.forceFresh && cacheValid) {
                const currentBranch = await git.cwd(cachePath).revparse(['--abbrev-ref', 'HEAD']);
                const commit = await git.cwd(cachePath).revparse(['HEAD']);
                return { path: cachePath, branch: currentBranch.trim(), commit: commit.trim() };
            }

            await fs.rm(cachePath, { recursive: true, force: true });
            await fs.mkdir(path.dirname(cachePath), { recursive: true });

            await git.clone(context.repoUrl, cachePath);
            if (context.branch) {
                await git.cwd(cachePath).checkout(context.branch);
            }

            const branch = await git.cwd(cachePath).revparse(['--abbrev-ref', 'HEAD']);
            const commit = await git.cwd(cachePath).revparse(['HEAD']);

            return {
                path: cachePath,
                branch: branch.trim(),
                commit: commit.trim(),
            };
        } catch (error: any) {
            throw new Error(`リポジトリのクローンに失敗: ${error?.message || '不明なエラー'}`);
        }
    },
});

export const analyzeCodeTool = createTool({
    id: 'analyze-code',
    description: 'リポジトリのコードと依存関係を分析',
    inputSchema: z.object({
        repoPath: z.string().describe('リポジトリのパス'),
    }),
    outputSchema: codeAnalysisSchema,
    execute: async ({ context }) => {
        try {
            if (!context.repoPath) {
                throw new Error('リポジトリのパスが指定されていません');
            }

            const repoExists = await fs.access(context.repoPath)
                .then(() => true)
                .catch(() => false);

            if (!repoExists) {
                throw new Error(`指定されたパスにリポジトリが見つかりません: ${context.repoPath}`);
            }

            const files: string[] = [];
            const languages: Record<string, number> = {};
            let totalSize = 0;

            // Recursively read all files
            const readDir = async (dir: string) => {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (entry.name !== 'node_modules' && entry.name !== '.git') {
                            await readDir(fullPath);
                        }
                    } else {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (ext) {
                            const stats = await fs.stat(fullPath);
                            totalSize += stats.size;
                            files.push(fullPath);
                            languages[ext] = (languages[ext] || 0) + stats.size;
                        }
                    }
                }
            };

            await readDir(context.repoPath);

            // Parse package.json if exists
            let dependencies = {};
            let devDependencies = {};
            let packageManager: 'npm' | 'yarn' | 'pnpm' | null = null;

            try {
                const packageJsonPath = path.join(context.repoPath, 'package.json');
                const packageJsonExists = await fs.access(packageJsonPath)
                    .then(() => true)
                    .catch(() => false);

                if (packageJsonExists) {
                    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
                    const packageJson = JSON.parse(packageJsonContent);

                    dependencies = packageJson.dependencies || {};
                    devDependencies = packageJson.devDependencies || {};

                    if (await fs.access(path.join(context.repoPath, 'yarn.lock')).catch(() => false)) {
                        packageManager = 'yarn';
                    } else if (await fs.access(path.join(context.repoPath, 'pnpm-lock.yaml')).catch(() => false)) {
                        packageManager = 'pnpm';
                    } else if (await fs.access(path.join(context.repoPath, 'package-lock.json')).catch(() => false)) {
                        packageManager = 'npm';
                    }
                }
            } catch (error: any) {
                console.warn(`package.jsonの解析に失敗: ${error?.message || '不明なエラー'}`);
            }

            return {
                files,
                languages,
                totalSize,
                dependencies,
                devDependencies,
                packageManager,
            };
        } catch (error: any) {
            throw new Error(`コード分析に失敗: ${error?.message || '不明なエラー'}`);
        }
    },
});