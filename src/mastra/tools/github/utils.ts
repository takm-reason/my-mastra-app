import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { mkdirSync } from 'fs';
import { CloneOptions, CloneResult } from './types';

// このツールのディレクトリを基準に相対パスでクローンディレクトリを指定
const CLONES_DIR = join(__dirname, 'clones');

export async function cloneRepository(options: CloneOptions): Promise<CloneResult> {
    const { repository, branch, shallow } = options;

    // リポジトリ名を取得
    const repoName = repository.split('/').pop()!;

    // クローン先のディレクトリを決定
    const targetDir = join(CLONES_DIR, repoName);

    // クローン先のディレクトリが存在しない場合は作成
    mkdirSync(CLONES_DIR, { recursive: true });

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