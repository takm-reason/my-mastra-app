export interface CloneOptions {
    /**
     * リポジトリの所有者/名前 (例: "owner/repo")
     */
    repository: string;

    /**
     * クローン先のディレクトリパス
     * 指定しない場合はリポジトリ名のディレクトリが作成されます
     */
    directory?: string;

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
     * クローンしたディレクトリのパス
     */
    directory: string;

    /**
     * クローンしたリポジトリのURL
     */
    repositoryUrl: string;

    /**
     * クローンしたブランチ名
     */
    branch: string;
}