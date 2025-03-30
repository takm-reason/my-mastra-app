import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { minimatch } from 'minimatch';

interface IgnoreRule {
    pattern: string;
    negate: boolean;
}

export class IgnoreParser {
    private rules: IgnoreRule[] = [];

    constructor(basePath: string) {
        // .gitignoreの解析
        const gitignorePath = join(basePath, '.gitignore');
        if (existsSync(gitignorePath)) {
            this.addRulesFromFile(gitignorePath);
        }

        // .dockerignoreの解析
        const dockerignorePath = join(basePath, '.dockerignore');
        if (existsSync(dockerignorePath)) {
            this.addRulesFromFile(dockerignorePath);
        }
    }

    private addRulesFromFile(filePath: string): void {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            // 空行やコメントをスキップ
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            // ネガティブパターンの処理（!で始まるパターン）
            const negate = trimmed.startsWith('!');
            const pattern = negate ? trimmed.slice(1) : trimmed;

            this.rules.push({
                pattern: this.normalizePattern(pattern),
                negate
            });
        }
    }

    private normalizePattern(pattern: string): string {
        // パターンの正規化
        let normalized = pattern.trim();

        // 先頭のスラッシュを削除
        if (normalized.startsWith('/')) {
            normalized = normalized.slice(1);
        }

        // 末尾のスラッシュを削除
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }

        return normalized;
    }

    isIgnored(filePath: string): boolean {
        const normalizedPath = this.normalizePattern(filePath);
        let ignored = false;

        for (const rule of this.rules) {
            if (minimatch(normalizedPath, rule.pattern, { dot: true })) {
                ignored = !rule.negate;
            }
        }

        return ignored;
    }
}