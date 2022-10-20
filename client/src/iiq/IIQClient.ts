import * as vscode from 'vscode';
import * as path from 'path';
import * as base64 from 'base-64';
import * as propertiesReader from 'properties-reader';

import { SailPointIIQAuthenticationProvider } from '../auth/authProvider';
import { Logger } from '../common';
import { Environment } from './Environment';
import { APIClient, Credential } from '../api';

export class IIQClient implements vscode.Disposable {
  private readonly _onDidChangeEnvironment: vscode.EventEmitter<void> = new vscode.EventEmitter();
  private disposables: vscode.Disposable;
  private cachedEnvironments: Environment[] = [];
  private currentEnvironment?: Environment;
  private client?: APIClient;
  
  constructor(private readonly authProvider: SailPointIIQAuthenticationProvider, private readonly workplaceState: vscode.Memento, private readonly statusBarItem: vscode.StatusBarItem, private readonly logger: Logger) {
    this.init();
    this.disposables = vscode.Disposable.from(
      vscode.authentication.onDidChangeSessions(async (event) => {
        if (event.provider.id === SailPointIIQAuthenticationProvider.id && this.currentEnvironment !== undefined) {
          this.logger.debug('Sessions Changed');
          const authSession = await vscode.authentication.getSession(SailPointIIQAuthenticationProvider.id, [this.currentEnvironment.name], { silent: true });
          if (!authSession) {
            this.currentEnvironment = undefined;
          }
          else {
            this.logger.debug('Got', Object.assign({}, authSession, { accessToken: '***' }));
            const environment = Object.assign({}, this.currentEnvironment, {
              credentials: {
                username: authSession.account.id,
                password: authSession.accessToken
              }
            });
            // const [authenticated, env] = await this.validateCredentials(environment);
            const authenticated = await this.validateCredentials(environment);
            if (authenticated){
              this.currentEnvironment = environment;
            }
            else {
              this.closeEnvironment();
            }
          }
          this.update();
        }
      }),
      vscode.workspace.onDidCreateFiles(async (e: vscode.FileCreateEvent) => {
        if (e.files.some(file => file.path.includes(`.target.properties`) || file.path.includes(`.target.secret.properties`))) {
          this.logger.info('New environment file added; refreshing cached environments.');
          this.cacheEnvironments();
        }
      }),
      vscode.workspace.onDidDeleteFiles(async (e: vscode.FileDeleteEvent) => {
        if (e.files.some(file => path.basename(file.fsPath).split('.')[0] === this.currentEnvironment?.name)) {
          this.logger.warn(`Removed environment file. Closing environment`);
          this.closeEnvironment();
        }
        if (e.files.some(file => file.fsPath.endsWith('.target.properties') || file.fsPath.endsWith('.target.secret.properties'))) {
          this.logger.info('An environment file was removed; refreshing cached environments.');
          this.cacheEnvironments();
        }
      }),
      vscode.workspace.onDidRenameFiles(async (e: vscode.FileRenameEvent) => {
        if (e.files.some(file => file.newUri.fsPath.endsWith('.target.properties') || file.newUri.fsPath.endsWith('.target.secret.properties'))) {
          this.logger.info('New environment file detected; refreshing cached environments.');
          this.cacheEnvironments();
        }
        if (e.files.some(file => (file.oldUri.fsPath.endsWith('.target.properties') || file.oldUri.fsPath.endsWith('.target.secret.properties')) && (!file.newUri.fsPath.endsWith('.target.properties') && !file.newUri.fsPath.endsWith('.target.secret.properties')))) {
          this.logger.warn('Removed an environment file. refreshing cached environments');
          await this.cacheEnvironments();
          if (this.currentEnvironment) {
            if (!this.cachedEnvironments.some(env => env.name === this.currentEnvironment!.name)) {
              this.logger.warn(`Could not find current opened (${this.currentEnvironment.name}) environment's environment file; closing environment`);
              this.closeEnvironment();
            }
          }
        }
      })
    );
  }
  
  dispose = () => this.disposables.dispose();
  readonly onDidChangeEnvironment: vscode.Event<void> = this._onDidChangeEnvironment.event;

  public async openEnvironment(): Promise<void> {
    const selectedEnvironment = await vscode.window.showQuickPick(this.cachedEnvironments.filter(env => env.name !== this.currentEnvironment?.name).map(env => env.name), {
      title: 'Switch Environment',
      canPickMany: false,
    });
    
    if (!selectedEnvironment) {
      this.logger.warn(`Switch environment cancelled by end user; no environment selected.`);
      return;
    }

    await this.logIntoEnvironment(selectedEnvironment);

    this.update();
  }

  public async closeEnvironment(): Promise<void> {
    this.currentEnvironment = undefined;
    this.client = undefined;
    this.update();
  }

  public async toggleEnvironment(): Promise<void> {
    if (this.currentEnvironment) {
      const result = await vscode.window.showWarningMessage(`You're about to disconnect from the server. Continue?`, "Yes", "No");
      if (result !== "Yes") {
        return;
      }
      this.closeEnvironment();
    } else {
      this.openEnvironment();
    }
  }

  public async showServerInfo(): Promise<void> {
    if (this.client && await this.client.authenticated()) {
      const serverInfos = await this.client.getServerInfo();
      if (serverInfos) {
        const uri = vscode.Uri.parse(`sailpoint-iiq://serverInfo/#${base64.encode(JSON.stringify(serverInfos))}`);
        this.logger.debug(`Opening virtual document to view server info`, uri);
        const doc = await vscode.workspace.openTextDocument(uri);
        if (doc) {
          await vscode.window.showTextDocument(doc, {preserveFocus: true});
        }
      }
    }
  }

  public async getServerLog(): Promise<void> {
    if (this.client && await this.client.authenticated()) {
      const log = await this.client.getLog();
      if (log) {
        const uri = vscode.Uri.parse(`sailpoint-iiq://log/#${base64.encode(log.replace(/\\n/g, "\n"))}`);
        this.logger.debug(`Opening virtual document to view the server log.`, uri);
        const doc = await vscode.workspace.openTextDocument(uri);
        if (doc) {
          await vscode.window.showTextDocument(doc, {preserveFocus: true});
        }
      }
      else {
        vscode.window.showWarningMessage(`Did not retrieve any log information.`);
      }
    }
  }

  public async getObject(): Promise<unknown> {
    if (this.client && await this.client.authenticated()) {
      const classes = await this.client.getClasses();
      if (!classes) {
        vscode.window.showWarningMessage(`No classes were found, cancelled.`);
        return;
      }
      let theClass = await vscode.window.showQuickPick(classes,
        {
          placeHolder: `Pick a class...`,
          ignoreFocusOut: true,
        });
      if (!theClass) {
        vscode.window.showInformationMessage(`No classes selected, cancelled.`);
        return;
      }
    }
  }

  public async cacheEnvironments(): Promise<void> {
    this.cachedEnvironments = [];
    const files = await vscode.workspace.findFiles('**/*.target.properties');
    const secretFiles = await vscode.workspace.findFiles('**/*.target.secrets.properties');
    files.forEach(async (file) => {
      const [envname, _] = path.basename(file.fsPath).split(".");
      const secretFile = secretFiles.find(f => path.basename(f.fsPath).split('.')[0] === envname);

      let props = propertiesReader(file.fsPath).getAllProperties();
      if (secretFile) {
        const secretprops = propertiesReader(secretFile.fsPath).getAllProperties();
        props = Object.assign({}, props, secretprops);
      }
      const propstrings: {[key: string]: string} = {};
      let environment: Environment = {
        name: envname,
        url: null
      };
      for (let key in props) {
        switch (key) {
          case '%%ECLIPSE_URL%%':
          environment.url = new URL(props[key].toString().replace(/\\/,''));
          break;
        case '%%ECLIPSE_USER%%':
        case '%%ECLIPSE_PASS%%':
        default:
          propstrings[key] = props[key].toString().replace(/\\\\/g,'\\');
        }
      }
      if (props['%%ECLIPSE_USER%%'] && props['%%ECLIPSE_PASS%%']) {
        environment = Object.assign({}, environment, {
          credentials: {
            username: props['%%ECLIPSE_USER%%'].toString().replace(/\\\\/g,'\\'),
            password: props['%%ECLIPSE_PASS%%'].toString().replace(/\\\\/g,'\\')
          }
        });
      }
      environment.props = propstrings;
      this.cachedEnvironments.push(environment);
    });
    if (this.cachedEnvironments.some(environment => environment.credentials !== undefined)) {
      // vscode.window.showWarningMessage(`Found a username and/or password in an environment target properties file. Please consider using the more secure 'Accounts' option instead.`);
      vscode.window.showWarningMessage(`Found a username and/or password in an environment target properties file. Please consider using the more secure 'Accounts' option instead.`, 'Learn More')
        .then(result => {
          if (result === 'Learn More') {
            // TODO: Create a virtual document and display HTML which talks more about the 'Accounts' option.
          }
        });
    }
  }

  public async getClasses(showProgress: boolean = true): Promise<string[] | undefined> {
    if (this.currentEnvironment && this.client) {
      return this.client.getClasses(showProgress);
    }
  }

  public async getObjects(className: string, showProgress: boolean = true): Promise<string[] | undefined> {
    if (this.currentEnvironment && this.client) {
      return this.client.getClassObjects(className, showProgress);
    }
  }

  public async previewClassObject(className: string, objectName: string, showProgress: boolean = true): Promise<void> {
    if (this.currentEnvironment && this.client) {
      const obj = await this.client.getClassObject(className, objectName, showProgress);
      if (obj) {
        const uri = vscode.Uri.parse(`sailpoint-iiq://object/?className=${className}&objectName=${objectName}#${base64.encode(obj.replace(/\\n/g, "\n"))}`);
        this.logger.debug(`Opening virtual document to view the document.`, uri);
        const doc = await vscode.workspace.openTextDocument(uri);
        if (doc) {
          await vscode.window.showTextDocument(doc, {preserveFocus: true, preview: true});
        }
      }
    }
  }

  private async validateCredentials(environment: Environment, unsecure: boolean = false, iteration: number = 0): Promise<[boolean, Environment]> {
    if (iteration >= 3) {
      this.logger.error('Could not validate credentials; cancelled validating environment.');
      return [false, environment];
    }

    let credentials: Credential | undefined = environment.credentials;
    let authSession: vscode.AuthenticationSession | undefined;

    if (!unsecure) {
      authSession = await vscode.authentication.getSession(SailPointIIQAuthenticationProvider.id, [environment.name], { createIfNone: true });
      this.logger.debug(`Got`, Object.assign({}, authSession, { accessToken: '***' }));
      credentials = {
        username: authSession.account.id,
        password: authSession.accessToken
      };
      environment = Object.assign({}, environment, {
        credentials: {
          username: authSession.account.id
        }
      });
    }

    if (!credentials) {
      this.logger.error(`can not validate empty credentials; cancelled`);
      return [false, environment];
    }

    this.logger.info(`attempting to validate credentials; try ${iteration + 1} of 3`);

    let authenticated = false;
    let identity: string | undefined;
    if (environment.url) {
      this.client = new APIClient(environment.url, credentials, this.logger);
      [authenticated, identity] = await this.client.authenticated();
    }
    else if (!environment.url) {
      this.logger.warn(`IdentityIQ server URL is unknown; cancelled validating environment.`);
      return [false, environment];
    }

    if (!authenticated) {
      vscode.window.showWarningMessage('Credentials were not validated on the server.');
      this.logger.warn('credentials were not validated.');
      if (unsecure) {
        iteration = 4;
        return [false, environment];
      }
      else if (authSession) {
        this.authProvider.removeSession(authSession.id);
      }
      return this.validateCredentials(environment, false, ++iteration);
    }

    this.logger.info('validated credentials.');

    const env = Object.assign({}, environment, { identity });

    return [true, env];
  }

  private async logIntoEnvironment(selectedEnvironment: string): Promise<void> {
    this.logger.info(`Switching to environment ${selectedEnvironment}`);
    const environment = this.cachedEnvironments.find(env => env.name === selectedEnvironment)!;
        
    // const [authenticated, env] = await this.validateCredentials(environment, environment.credentials !== undefined);
    const [authenticated, env] = await this.validateCredentials(environment, environment.credentials !== undefined);

    if (authenticated) {
      this.logger.info(`Logged into ${env.name}`)
      this.currentEnvironment = env;
    }
    else {
      this.closeEnvironment();
    }
  }

  private async init(): Promise<void> {
    await this.cacheEnvironments();
    const environment = this.workplaceState.get<string>('vscode-sailpoint-iiq.environment');
    if (environment && this.cachedEnvironments.some(env => env.name)) {
      await this.logIntoEnvironment(environment);
    }
    else if (environment) {
      this.logger.warn(`Last used environment (${environment}) could not be found; cancelled opening environment.`);
      this.workplaceState.update('vscode-sailpoint-iiq.environment', undefined);
    }
    await this.update();
  }

  private async update(): Promise<void> {
    await this.workplaceState.update('vscode-sailpoint-iiq.environment', this.currentEnvironment?.name);
    await vscode.commands.executeCommand('setContext', 'vscode-sailpoint-iiq.environmentSelected', this.currentEnvironment !== undefined);
    
    this.logger.debug('Updating vscode elements...');
    this.statusBarItem.text = `IdentityIQ: ${this.currentEnvironment ? `$(verified) ${this.currentEnvironment.name}` : '$(unverified) offline'}`;
    if (this.currentEnvironment && this.client) {
      const serverInfos = await this.client.getServerInfo();

      let md = `Server Url: [${this.currentEnvironment.url}](${this.currentEnvironment.url}) \ \nUsername: **${this.currentEnvironment.credentials!.username} (${this.currentEnvironment.identity || this.currentEnvironment.credentials!.username})**`;
      if (serverInfos) {
        md += `\n\n`;
        md += `* HostName: **${serverInfos.productInformation.hostName}**\n`;
        md += `* Version: **${serverInfos.productInformation.version}**\n`;
        md += `* Builder: **${serverInfos.productInformation.builder}**\n`;
        md += `* Build Date: **${new Date(serverInfos.productInformation.buildDate)}**\n`;
        md += `* Java Vendor: **${serverInfos.javaSystemProperties['java.vendor']}**\n`;
        md += `* OS Name: **${serverInfos.javaSystemProperties['os.name']}**\n`;
        md += `* Java VM Name: **${serverInfos.javaSystemProperties['java.vm.name']}**\n`;
        md += `* Java VM Vendor: **${serverInfos.javaSystemProperties['java.vm.vendor']}**\n`;
        md += `* Java VM Version **${serverInfos.javaSystemProperties['java.vm.version']}**\n`;
      }
      this.statusBarItem.tooltip = new vscode.MarkdownString(md, true);
    }
    else {
      this.statusBarItem.tooltip = undefined;
    }
    this.statusBarItem.show();
    this.logger.debug('vscode elements updated.');
    this._onDidChangeEnvironment.fire();
  }

}