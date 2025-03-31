import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function cloneRepo(repoUrl: string, branch?: string): Promise<{
    repoPath: string;
    files: string[];
    success: boolean;
    message: string;
}> {
    try {
        // リポジトリ名を抽出
        const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
        const repoPath = path.join(process.cwd(), 'temp', repoName);

        // クローン先ディレクトリの作成
        await fs.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });

        // 既存のリポジトリを削除（存在する場合）
        try {
            await fs.rm(repoPath, { recursive: true, force: true });
        } catch (err) {
            // ディレクトリが存在しない場合は無視
        }

        // リポジトリをクローン
        const cloneCommand = branch
            ? `git clone -b ${branch} ${repoUrl} ${repoPath}`
            : `git clone ${repoUrl} ${repoPath}`;

        await execAsync(cloneCommand);

        // ファイル一覧を取得
        const files = await listFiles(repoPath);

        return {
            repoPath,
            files,
            success: true,
            message: 'Repository cloned successfully',
        };
    } catch (error) {
        return {
            repoPath: '',
            files: [],
            success: false,
            message: `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

export async function analyzeCode(repoPath: string, filePattern?: string): Promise<{
    files: string[];
    dependencies: string[];
    codeMetrics: {
        totalFiles: number;
        totalLines: number;
        languageStats: Record<string, number>;
    };
    analysis: {
        complexity: number;
        maintainability: number;
        documentation: number;
    };
}> {
    try {
        // ファイル一覧を取得
        const files = await listFiles(repoPath, filePattern);

        // 依存関係を解析
        const dependencies = await analyzeDependencies(repoPath);

        // コードメトリクスを計算
        const metrics = await calculateMetrics(files, repoPath);

        // コード品質分析
        const analysis = await analyzeCodeQuality(files, repoPath);

        return {
            files,
            dependencies,
            codeMetrics: metrics,
            analysis,
        };
    } catch (error) {
        throw new Error(`Failed to analyze code: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function listFiles(dir: string, pattern?: string): Promise<string[]> {
    const files: string[] = [];

    async function scan(directory: string) {
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.')) { // 隠しディレクトリをスキップ
                    await scan(fullPath);
                }
            } else if (entry.isFile()) {
                if (!pattern || fullPath.match(new RegExp(pattern))) {
                    files.push(fullPath);
                }
            }
        }
    }

    await scan(dir);
    return files;
}

async function analyzeDependencies(repoPath: string): Promise<string[]> {
    const dependencies: string[] = [];

    try {
        // package.jsonが存在する場合はnpm依存関係を解析
        const packageJsonPath = path.join(repoPath, 'package.json');
        const packageJsonExists = await fs.access(packageJsonPath)
            .then(() => true)
            .catch(() => false);

        if (packageJsonExists) {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            dependencies.push(...Object.keys(packageJson.dependencies || {}));
            dependencies.push(...Object.keys(packageJson.devDependencies || {}));
        }
    } catch (error) {
        console.error('Error analyzing dependencies:', error);
    }

    return dependencies;
}

async function calculateMetrics(files: string[], repoPath: string): Promise<{
    totalFiles: number;
    totalLines: number;
    languageStats: Record<string, number>;
}> {
    let totalLines = 0;
    const languageStats: Record<string, number> = {};

    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n').length;
            totalLines += lines;

            const ext = path.extname(file).toLowerCase();
            languageStats[ext] = (languageStats[ext] || 0) + 1;
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    }

    return {
        totalFiles: files.length,
        totalLines,
        languageStats,
    };
}

async function analyzeCodeQuality(files: string[], repoPath: string): Promise<{
    complexity: number;
    maintainability: number;
    documentation: number;
}> {
    // シンプルなコード品質分析の実装
    let totalComplexity = 0;
    let totalMaintainability = 0;
    let totalDocumentation = 0;
    let fileCount = 0;

    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');

            // 循環的複雑度の簡易計算（if, for, while, switch, catch文の数をカウント）
            const complexity = (content.match(/\b(if|for|while|switch|catch)\b/g) || []).length;

            // メンテナンス性（行の長さ、関数の長さなどを考慮）
            const maintainability = calculateMaintainability(lines);

            // ドキュメント化率（コメント行の割合）
            const documentation = (content.match(/\/\*[\s\S]*?\*\/|\/\/.*/g) || []).length / lines.length;

            totalComplexity += complexity;
            totalMaintainability += maintainability;
            totalDocumentation += documentation;
            fileCount++;
        } catch (error) {
            console.error(`Error analyzing file ${file}:`, error);
        }
    }

    return {
        complexity: fileCount > 0 ? totalComplexity / fileCount : 0,
        maintainability: fileCount > 0 ? totalMaintainability / fileCount : 0,
        documentation: fileCount > 0 ? totalDocumentation : 0,
    };
}

function calculateMaintainability(lines: string[]): number {
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    const longLines = lines.filter(line => line.length > 80).length;
    const maintainabilityScore = 100 - (avgLineLength * 0.2) - (longLines / lines.length * 20);
    return Math.max(0, Math.min(100, maintainabilityScore)) / 100;
}