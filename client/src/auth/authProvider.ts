import * as vscode from 'vscode';
import { randomUUID } from 'crypto';

import { Logger } from '../common';

export interface SailPointIIQCredential {
  environment: string;
  username: string;
  password: string;
}

class SailPointIIQAuthenticationSession implements vscode.AuthenticationSession {
  readonly accessToken: string;
  readonly account: vscode.AuthenticationProviderInformation;
  readonly id: string = randomUUID();
  readonly scopes: string[] = [];
  get environment(): string {
    return this.scopes[0];
  };
  constructor(username: string, password: string, scopes: readonly string[]) {
    this.scopes.push(...scopes);
    this.accessToken = password;
    this.account = {
      id: username,
      label: `${username}@${this.environment}`
    };
  }
}

export class SailPointIIQAuthenticationProvider implements vscode.AuthenticationProvider {
  public static id: string = "sailPointIIQAuthProvider";
  private _sessions: SailPointIIQAuthenticationSession[] = [];

  private readonly _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  onDidChangeSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> = this._onDidChangeSessions.event;

  constructor(private readonly secrets: vscode.SecretStorage, private readonly logger: Logger) {
    this.init();
  }

  async getSessions(scopes?: readonly string[] | undefined): Promise<readonly vscode.AuthenticationSession[]> {
    const sessions = this._sessions.filter(session => scopes !== undefined ? session.scopes[0] === scopes[0] : true);
    this.logger.debug(`Found ${sessions.length} sessions`, sessions);
    return sessions;
  }

  async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    const username = await vscode.window.showInputBox({
      title: `SailPoint IdentityIQ Login for ${scopes[0]}`,
      prompt: 'Please provide the username.',
      ignoreFocusOut: true,
    });
    const accessToken = await vscode.window.showInputBox({
      title: `SailPoint IdentityIQ Login for ${username}@${scopes[0]}`,
      prompt: 'Please provide the password.',
      ignoreFocusOut: true,
      password: true,
    });
    if (!username || !accessToken) {
      this.logger.warn(`Authentication cancelled by end user.`);
      this.logger.debug(`username provided: ${username}`);
      this.logger.debug(`password provided: ${accessToken ? '***' : accessToken}`);
      return Promise.reject('Authentication cancelled by end user');
    }
    const s = new SailPointIIQAuthenticationSession(username, accessToken, scopes);
    this._sessions.push(s);
    this._onDidChangeSessions.fire({ added: [s], removed: [], changed: [] });
    await this.saveSecrets();
    return s;
  }

  async removeSession(sessionId: string): Promise<void> {
    const idx = this._sessions.findIndex(s => s.id === sessionId);
    const s = this._sessions[idx];
    this._sessions.splice(idx, 1);
    this._onDidChangeSessions.fire({ added: [], removed: [s], changed: [] });
    await this.saveSecrets();
  }

  private async init() {
    const credentialJSON = await this.secrets.get(SailPointIIQAuthenticationProvider.id);
    if (credentialJSON) {
      const credentials: SailPointIIQCredential[] = JSON.parse(credentialJSON) as SailPointIIQCredential[];
      const added: SailPointIIQAuthenticationSession[] = [];
      credentials.map(credential => {
        const session = new SailPointIIQAuthenticationSession(credential.username, credential.password, [credential.environment]);
        added.push(session);
      },);
      this._sessions.push(...added);
      this._onDidChangeSessions.fire({ added, removed: [], changed: [] });
    }
  }

  private async saveSecrets() {
    const credentials: SailPointIIQCredential[] = [];
    this._sessions.forEach(session => {
      credentials.push({
        username: session.account.id,
        password: session.accessToken,
        environment: session.environment
      });
    });
    if (credentials.length > 0) {
      const credentialJSON = JSON.stringify(credentials);
      await this.secrets.store(SailPointIIQAuthenticationProvider.id, credentialJSON);
    } else {
      await this.secrets.delete(SailPointIIQAuthenticationProvider.id);
    }
  }

}
