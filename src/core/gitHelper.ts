import { execSync, spawnSync } from 'child_process';

function runGit(cmd: string[], cwd: string): string | null {
  const workDir = cwd.trim() || undefined;
  try {
    const result = spawnSync(cmd[0], cmd.slice(1), { cwd: workDir, encoding: 'utf8', timeout: 5000 });
    if (result.status !== 0 || result.error) return null;
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

function toHttpsGitUrl(url: string): string | null {
  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}.git`;
  // Already HTTPS
  if (url.startsWith('https://')) return url.endsWith('.git') ? url : url + '.git';
  return null;
}

export function getBranch(cwd: string): string | null {
  return runGit(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd);
}

export function getGitUserEmail(cwd: string): string | null {
  return runGit(['git', 'config', 'user.email'], cwd);
}

export function getGitUserAlias(cwd: string): string | null {
  return runGit(['git', 'config', 'user.name'], cwd);
}

export function getRepoRemote(cwd: string): string | null {
  const ghUrl = runGit(['gh', 'repo', 'view', '--json', 'url', '-q', '.url'], cwd);
  if (ghUrl?.startsWith('https://')) {
    return ghUrl.endsWith('.git') ? ghUrl : ghUrl + '.git';
  }
  const url = runGit(['git', 'remote', 'get-url', 'origin'], cwd);
  return url ? toHttpsGitUrl(url) : null;
}

export function getHeadSha(cwd: string): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function getDiffStat(cwd: string): { filesChanged: number; linesChanged: number } {
  try {
    const out = execSync('git diff --stat HEAD', { cwd, encoding: 'utf8' });
    const files = out.match(/(\d+) files? changed/);
    const lines = out.match(/(\d+) insertions?\(\+\)/);
    return {
      filesChanged: files ? parseInt(files[1]) : 0,
      linesChanged: lines ? parseInt(lines[1]) : 0,
    };
  } catch {
    return { filesChanged: 0, linesChanged: 0 };
  }
}

export function getRisk(files: string[]): 'high' | 'medium' | 'low' {
  const high = /auth|payment|billing|password|secret|token|crypto|security/i;
  const medium = /api|service|controller|route|handler|db|database|migration/i;
  if (files.some(f => high.test(f))) return 'high';
  if (files.some(f => medium.test(f))) return 'medium';
  return 'low';
}
