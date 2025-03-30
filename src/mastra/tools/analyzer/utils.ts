import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { IgnoreParser } from './ignore';
import { AnalysisResult, AnalyzerOptions, DirectoryStructure } from './types';
import json5 from 'json5';
const { parse: parsePackageJson } = json5;

export async function analyzeProject(
    targetPath: string,
    options: AnalyzerOptions
): Promise<AnalysisResult> {
    const {
        includeExtensions = [],
        excludeExtensions = [],
        detailed = false,
        respectIgnoreFiles = true,
    } = options;

    // Ignore設定の読み込み
    const ignoreParser = respectIgnoreFiles ? new IgnoreParser(targetPath) : null;

    // プロジェクト名の取得（package.jsonから、なければディレクトリ名）
    const projectName = getProjectName(targetPath);

    // ディレクトリ構造の解析
    const structure = analyzeDirectory(targetPath, {
        includeExtensions,
        excludeExtensions,
        ignoreParser,
        baseDir: targetPath,
    });

    // 主要コンポーネントの分析
    const keyComponents = analyzeKeyComponents(targetPath, structure);

    // アーキテクチャ情報の収集
    const architecture = analyzeArchitecture(targetPath, structure);

    // 詳細仕様の分析（オプション）
    const specifications = detailed
        ? analyzeSpecifications(targetPath, structure, ignoreParser)
        : undefined;

    return {
        projectName,
        structure,
        keyComponents,
        architecture,
        specifications,
    };
}

function getProjectName(targetPath: string): string {
    try {
        const packageJsonPath = join(targetPath, 'package.json');
        const packageJson = parsePackageJson(readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.name || targetPath.split('/').pop()!;
    } catch {
        return targetPath.split('/').pop()!;
    }
}

function analyzeDirectory(
    dirPath: string,
    options: {
        includeExtensions: string[];
        excludeExtensions: string[];
        ignoreParser: IgnoreParser | null;
        baseDir: string;
    }
): DirectoryStructure {
    const { includeExtensions, excludeExtensions, ignoreParser, baseDir } = options;
    const name = dirPath.split('/').pop()!;
    const relativePath = relative(baseDir, dirPath);

    // ignoreチェック
    if (ignoreParser?.isIgnored(relativePath)) {
        return {
            name,
            type: 'directory',
            path: relativePath,
            children: [],
        };
    }

    const entries = readdirSync(dirPath);
    const children: DirectoryStructure[] = [];

    for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const entryStats = statSync(fullPath);
        const relativePath = relative(baseDir, fullPath);

        if (ignoreParser?.isIgnored(relativePath)) {
            continue;
        }

        if (entryStats.isDirectory()) {
            children.push(
                analyzeDirectory(fullPath, {
                    includeExtensions,
                    excludeExtensions,
                    ignoreParser,
                    baseDir,
                })
            );
        } else {
            const ext = extname(entry);
            if (
                (includeExtensions.length === 0 || includeExtensions.includes(ext)) &&
                !excludeExtensions.includes(ext)
            ) {
                children.push({
                    name: entry,
                    type: 'file',
                    extension: ext,
                    path: relativePath,
                });
            }
        }
    }

    return {
        name,
        type: 'directory',
        path: relativePath,
        children: children.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
        }),
    };
}

function analyzeKeyComponents(
    targetPath: string,
    structure: DirectoryStructure
): { path: string; description: string }[] {
    const components: { path: string; description: string }[] = [];

    // package.jsonの確認
    try {
        const packageJson = parsePackageJson(
            readFileSync(join(targetPath, 'package.json'), 'utf-8')
        );
        components.push({
            path: 'package.json',
            description: `プロジェクトの設定ファイル。主な依存関係: ${Object.keys(
                packageJson.dependencies || {}
            ).join(', ')}`,
        });
    } catch { }

    // README.mdの確認
    try {
        const readme = readFileSync(join(targetPath, 'README.md'), 'utf-8');
        components.push({
            path: 'README.md',
            description: '主なプロジェクト説明ドキュメント',
        });
    } catch { }

    // その他の主要ディレクトリ
    const importantDirs = ['src', 'lib', 'test', 'docs'];
    function checkDirectory(dir: DirectoryStructure) {
        if (importantDirs.includes(dir.name)) {
            components.push({
                path: dir.path,
                description: `${dir.name}ディレクトリ - ${getDirectoryDescription(
                    dir.name
                )}`,
            });
        }
        dir.children?.forEach((child) => {
            if (child.type === 'directory') checkDirectory(child);
        });
    }
    checkDirectory(structure);

    return components;
}

function getDirectoryDescription(dirName: string): string {
    const descriptions: Record<string, string> = {
        src: 'ソースコードのメインディレクトリ',
        lib: 'ライブラリコードや共通モジュール',
        test: 'テストコード',
        docs: 'ドキュメント',
    };
    return descriptions[dirName] || '';
}

function analyzeArchitecture(
    targetPath: string,
    structure: DirectoryStructure
): AnalysisResult['architecture'] {
    const patterns: string[] = [];
    const dependencies: { name: string; version: string; purpose: string }[] = [];

    // package.jsonの解析
    try {
        const packageJson = parsePackageJson(
            readFileSync(join(targetPath, 'package.json'), 'utf-8')
        );
        const deps = packageJson.dependencies || {};
        for (const [name, version] of Object.entries(deps)) {
            dependencies.push({
                name,
                version: version as string,
                purpose: getDependencyPurpose(name),
            });
        }
    } catch { }

    // ディレクトリ構造から設計パターンを推測
    if (findDirectory(structure, 'components')) {
        patterns.push('Component-Based Architecture');
    }
    if (findDirectory(structure, 'services')) {
        patterns.push('Service Layer Pattern');
    }
    if (findDirectory(structure, 'models')) {
        patterns.push('Model-View-Controller (MVC)');
    }

    return {
        overview: generateArchitectureOverview(structure),
        patterns,
        dependencies,
    };
}

function findDirectory(structure: DirectoryStructure, name: string): boolean {
    if (structure.name === name) return true;
    return structure.children?.some((child) =>
        child.type === 'directory' ? findDirectory(child, name) : false
    ) || false;
}

function generateArchitectureOverview(structure: DirectoryStructure): string {
    // ディレクトリ構造から概要を生成
    const topLevelDirs = structure.children?.filter(
        (child) => child.type === 'directory'
    );
    if (!topLevelDirs?.length) return 'シンプルなプロジェクト構造';

    return `プロジェクトは${topLevelDirs
        .map((dir) => `「${dir.name}」`)
        .join('、')}の主要ディレクトリで構成されています。`;
}

function getDependencyPurpose(name: string): string {
    const purposes: Record<string, string> = {
        react: 'UIフレームワーク',
        typescript: '型安全な JavaScript 開発',
        jest: 'テストフレームワーク',
        express: 'Webアプリケーションフレームワーク',
        '@types/node': 'Node.js 型定義',
    };
    return purposes[name] || '補助ライブラリ';
}

function analyzeSpecifications(
    targetPath: string,
    structure: DirectoryStructure,
    ignoreParser: IgnoreParser | null
): AnalysisResult['specifications'] {
    const specifications: NonNullable<AnalysisResult['specifications']> = [];

    function analyzeFile(filePath: string, relativePath: string) {
        if (ignoreParser?.isIgnored(relativePath)) return;

        try {
            const content = readFileSync(filePath, 'utf-8');
            const exports: { name: string; type: string; description: string }[] = [];
            const dependencies: string[] = [];

            // エクスポートの検出
            const exportMatches = content.match(/export\s+(const|class|interface|type|function)\s+(\w+)/g);
            exportMatches?.forEach((match) => {
                const [, type, name] = match.match(/export\s+(const|class|interface|type|function)\s+(\w+)/) || [];
                if (type && name) {
                    exports.push({
                        name,
                        type,
                        description: getExportDescription(content, name),
                    });
                }
            });

            // インポートの検出
            const importMatches = content.match(/import\s+.*?from\s+['"](.+?)['"]/g);
            importMatches?.forEach((match) => {
                const [, path] = match.match(/from\s+['"](.+?)['"]/) || [];
                if (path) {
                    dependencies.push(path);
                }
            });

            if (exports.length > 0 || dependencies.length > 0) {
                specifications.push({
                    path: relativePath,
                    purpose: getFilePurpose(content, relativePath),
                    exports,
                    dependencies,
                });
            }
        } catch { }
    }

    function traverseDirectory(dir: DirectoryStructure, baseDir: string) {
        const fullPath = join(targetPath, dir.path);
        if (dir.type === 'file') {
            analyzeFile(fullPath, dir.path);
        } else {
            dir.children?.forEach((child) => traverseDirectory(child, baseDir));
        }
    }

    traverseDirectory(structure, targetPath);
    return specifications;
}

function getExportDescription(content: string, exportName: string): string {
    // コメントから説明を抽出
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`export`) && lines[i].includes(exportName)) {
            let description = '';
            // 直前のコメントを探す
            for (let j = i - 1; j >= 0; j--) {
                const line = lines[j].trim();
                if (line.startsWith('//')) {
                    description = line.slice(2).trim() + ' ' + description;
                } else if (line.startsWith('/*') || line.startsWith('*')) {
                    description = line.replace(/^\/\*|\*\/$|\*/, '').trim() + ' ' + description;
                } else {
                    break;
                }
            }
            return description || `${exportName}の実装`;
        }
    }
    return `${exportName}の実装`;
}

function getFilePurpose(content: string, path: string): string {
    // ファイル先頭のコメントから目的を抽出
    const firstComment = content.match(/^\/\*\*([\s\S]*?)\*\/|^\/\/(.*)/);
    if (firstComment) {
        return firstComment[1]?.trim().replace(/\*\s*/g, '') || firstComment[2]?.trim() || getDefaultPurpose(path);
    }
    return getDefaultPurpose(path);
}

function getDefaultPurpose(path: string): string {
    if (path.endsWith('.test.ts') || path.endsWith('.spec.ts')) {
        return 'テストケースの実装';
    }
    if (path.endsWith('.d.ts')) {
        return '型定義ファイル';
    }
    if (path.endsWith('types.ts')) {
        return '型定義の集約';
    }
    return 'プロジェクトのソースコード';
}