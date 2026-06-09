import * as vscode from 'vscode';
import { httpRequest } from './client';
import { getEventsUrl } from '../config/settings';
import { AuthManager } from '../auth/authManager';
import { logger } from '../core/logger';
import { getBranch, getRepoRemote, getGitUserEmail, getGitUserAlias } from '../core/gitHelper';

export interface ToolUseEvent {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResponse: string;
  cwd: string;
}

export interface EventResponse {
  run_id?: string;
  plan_id?: string;
  report_url?: string;
  report?: unknown;
  [key: string]: unknown;
}

interface EventEnvelope {
  received_at: string;
  hook_event_name: string;
  payload: Record<string, unknown>;
  metadata: {
    account_id: string;
    git_repo: string | null;
    git_branch: string | null;
    git_user: string | null;
    session_manifest: {
      session_id: string;
      cwd: string;
      source: string;
      last_hook: string;
      grouping_keys: {
        git_repo: string | null;
        git_branch: string | null;
        git_user: string | null;
        git_name: string | null;
      };
    };
  };
}

export class EventsClient {
  constructor(private context: vscode.ExtensionContext, private auth: AuthManager) {}

  private async buildEnvelope(
    hookEventName: string,
    payload: Record<string, unknown>,
    cwd: string,
  ): Promise<EventEnvelope> {
    const gitRepo = getRepoRemote(cwd);
    const gitBranch = getBranch(cwd);
    const gitUserEmail = getGitUserEmail(cwd);
    const gitUserAlias = getGitUserAlias(cwd);
    return {
      received_at: new Date().toISOString(),
      hook_event_name: hookEventName,
      payload: { ...payload, hook_event_name: hookEventName },
      metadata: {
        account_id: this.auth.store.getState().accountId,
        git_repo: gitRepo,
        git_branch: gitBranch,
        git_user: gitUserEmail,
        session_manifest: {
          session_id: (payload.session_id as string) ?? '',
          cwd,
          source: 'cursor',
          last_hook: hookEventName,
          grouping_keys: {
            git_repo: gitRepo,
            git_branch: gitBranch,
            git_user: gitUserEmail,
            git_name: gitUserAlias,
          },
        },
      },
    };
  }

  private async post(envelope: EventEnvelope, throwOnError = false): Promise<EventResponse> {
    const creds = await this.auth.getValidAccessToken();
    if (!creds) {
      const msg = 'Arcus: not signed in. Run "Arcus: Sign In".';
      if (throwOnError) throw new Error(msg);
      logger.info('Skipping event post — not signed in.');
      return {};
    }

    const url = getEventsUrl();
    logger.info(`POST ${url} body=${JSON.stringify(envelope)}`);

    const send = (token: string) =>
      httpRequest({ method: 'POST', url, body: envelope, apiKey: token });

    try {
      let res = await send(creds.accessToken);

      if (res.status === 401) {
        // Reactive refresh + single replay.
        const ok = await this.auth.refresh();
        if (ok) {
          const accessToken = await this.auth.store.getAccessToken();
          if (accessToken) res = await send(accessToken);
        }
      }

      if (res.status === 401) {
        const msg = 'Arcus: session expired. Run "Arcus: Sign In".';
        vscode.window.showErrorMessage(msg);
        if (throwOnError) throw new Error(msg);
        return {};
      }
      if (res.status >= 400 && throwOnError) {
        throw new Error(`Server returned ${res.status}`);
      }

      logger.info(`POST ${url} -> ${res.status} body=${JSON.stringify(res.body)}`);
      return (res.body as EventResponse) || {};
    } catch (err) {
      if (throwOnError) throw err;
      logger.error(`Event post failed: ${(err as Error).message}`);
      return {};
    }
  }

  async postSessionStart(sessionId: string, cwd: string): Promise<void> {
    await this.post(await this.buildEnvelope('SessionStart', { session_id: sessionId, cwd }, cwd));
  }

  async postToolUse(event: ToolUseEvent): Promise<void> {
    await this.post(await this.buildEnvelope('PostToolUse', {
      session_id: event.sessionId,
      cwd: event.cwd,
      tool_name: event.toolName,
      tool_input: event.toolInput,
      tool_response: event.toolResponse,
    }, event.cwd));
  }

  async postUserPrompt(sessionId: string, prompt: string, cwd: string): Promise<EventResponse> {
    return this.post(
      await this.buildEnvelope('UserPromptSubmit', { session_id: sessionId, cwd, prompt }, cwd),
      true,
    );
  }
}
