import { execSync } from 'child_process';
import { resolve } from 'path';
import { CloneOptions, CloneResult } from './types';

export async function cloneRepository(options: CloneOptions): Promise<CloneResult> {
    const { repository, directory, branch, shallow } = options;

    // リポジトリ名を取得
    const repoName = repository.split('/').pop()!;

    // クローン先のディレクトリを決定
    const targetDir = directory || repoName;
    const absolutePath = resolve(process.cwd(), targetDir);

    // git cloneコマンドを構築
    let command = `git clone https://github.com/${repository}.git`;

    // オプションを追加
    if (directory) {
        command += ` ${directory}`;
    }
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
            cwd: absolutePath,
            encoding: 'utf-8',
        }).trim();

        return {
            directory: absolutePath,
            repositoryUrl: `https://github.com/${repository}`,
            branch: branch || currentBranch,
        };
    } catch (error) {
        throw new Error(`Failed to clone repository: ${(error as Error).message}`);
    }
}