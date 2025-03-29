export interface CloneOptions {
    /**
     * リポジトリの所有者/名前 (例: "owner/repo")
     */
    repository: string;

    /**
     * ブランチ名
     * 指定しない場合はデフォルトブランチを使用します
     */
    branch?: string;

    /**
     * 浅いクローンを行うかどうか
     * trueの場合は最新のコミットのみを取得します
     */
    shallow?: boolean;
}

export interface CloneResult {
    /**
     * クローンしたディレクトリの絶対パス
     * 例: "/Users/takumi/tuyotuyo/my-mastra-app/src/mastra/tools/github/clones/repo"
     */
    directory: string;

    /**
     * クローンしたリポジトリのURL
     * 例: "https://github.com/owner/repo"
     */
    repositoryUrl: string;

    /**
     * クローンしたブランチ名
     * 例: "main"
     */
    branch: string;
}