import { execSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { CloneOptions, CloneResult } from './types';

// プロジェクトルートからの相対パスでworkspaceディレクトリを指定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../../..');
const WORKSPACE_DIR = join(PROJECT_ROOT, 'src/mastra/workspace');
const CLONED_DIR = join(WORKSPACE_DIR, 'cloned');

export async function cloneRepository(options: CloneOptions): Promise<CloneResult> {
    const { repository, branch, shallow } = options;

    // リポジトリ名を取得
    const repoName = repository.split('/').pop()!;

    // クローン先のディレクトリを決定
    const targetDir = join(CLONED_DIR, repoName);

    // 必要なディレクトリを作成
    mkdirSync(WORKSPACE_DIR, { recursive: true });
    mkdirSync(CLONED_DIR, { recursive: true });

    // 既存のディレクトリが存在する場合は削除
    if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
    }

    // git cloneコマンドを構築
    let command = `git clone https://github.com/${repository}.git ${targetDir}`;

    // オプションを追加
    if (branch) {
        command += ` -b ${branch}`;
    }
    if (shallow) {
        command += ' --depth 1';
    }

    try {
        // git cloneを実行
        execSync(command, { stdio: 'inherit' });

        // ブランチ名を取得
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: targetDir,
            encoding: 'utf-8',
        }).trim();

        return {
            directory: targetDir,
            repositoryUrl: `https://github.com/${repository}`,
            branch: branch || currentBranch,
        };
    } catch (error) {
        throw new Error(`Failed to clone repository: ${(error as Error).message}`);
    }
}