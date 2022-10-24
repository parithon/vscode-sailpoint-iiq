import * as vscode from 'vscode';
import fetch, { Headers } from 'node-fetch';
import { Agent as HttpsAgent } from 'https';
import { Agent as HttpAgent } from 'http';
import * as base64 from 'base-64';
import { isStringObject } from 'util/types';

import { Logger } from '../common';
import { Credential } from './Credential';
import { SystemInfo } from './SystemInfo';
import { 
  GetServiceEndpoints,
  PostServiceEndpoints,
  Response,
  JsonAuthenticationResult,
  JsonPayloadResult,
  JsonPayloadArrayResult
} from "./Response";

export class APIClient {
  private readonly headers: Headers;
  private readonly agent: HttpAgent | HttpsAgent;

  constructor(private readonly baseUrl: URL, credential: Credential, private readonly logger: Logger) {
    this.logger.debug(`A new IdentityIQ client has been initialized.`);

      this.headers = new Headers();
      this.headers.append('Content-Type', 'application/json');
      this.headers.append('Authorization', `Basic ${base64.encode(`${credential.username}:${credential.password}`)}`);

      this.agent = baseUrl.protocol === 'https'
          ? new HttpsAgent({ rejectUnauthorized: false })
          : new HttpAgent();
  }

  public async authenticated(): Promise<[boolean, string | undefined]> {
    const requestUrl = this.getSanitizedUrl(`${this.baseUrl}${GetServiceEndpoints.authentication}`);

    var resp = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        cancellable: true
    }, progress => {
        return this.get<JsonAuthenticationResult>(requestUrl);
    });

    return [resp.ok && resp.json?.authentication !== 'authenticationFailure', resp.json?.identity];
  }

  public async getServerInfo(): Promise<SystemInfo | undefined> {
    const requestUrl = this.getSanitizedUrl(`${this.baseUrl}${PostServiceEndpoints.workflowUrl}`);
    const body = {
        workflowArgs: {
            operation: 'getSysInfo'
        }
    };

    var result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Retrieving system information...',
        cancellable: true
    }, progress => {
        return this.post<JsonPayloadResult>(requestUrl, body);
    });

    if (result.fail) {
        switch (result.fail) {
            case 405: // Method Not Allowed
                this.logger.error(`An error occurred while retrieving the server information.`, result.fail);
                vscode.window.showErrorMessage(`The workflow method could not be found. Method could not be found, please ensure the 'workflow.xml' has been imported to your environment.`);
                break;
            default:
                this.logger.error(`An error occurred while retriving your server information`, result.fail);
                vscode.window.showErrorMessage(`An error occurred while retriving your server information. Please ensure the 'workflow.xml' file is uploaded appropriately to your server and your server is reachable.`);
                break;
        }
        return;
    }

    if (result.json) {
        try {
            const payload = result.json.attributes.payload;
            const sysinfo: SystemInfo = JSON.parse(payload.replace(/\'/g, "¨").replace(/\"/g, "'").replace(/¨/g, "\"").replace(/\n/g, "\\n"));
            return sysinfo;
        }
        catch (error: any) {
            this.logger.error(`An error occurred while parsing your server information`, error);
            vscode.window.showErrorMessage(`An error occurred while parsing your server information. Please ensure the 'workflow.xml' file is uploaded appropriately to your server.`);
        }
    }
  }

  public async getLog(): Promise<string | undefined> {
    const requestUrl = this.getSanitizedUrl(`${this.baseUrl}${PostServiceEndpoints.workflowUrl}`);
    const body = {
        workflowArgs: {
            operation: 'getLog'
        }
    };

    var result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Retrieve logs...',
        cancellable: true
    }, progress => {
        return this.post<JsonPayloadResult>(requestUrl, body);
    });

    if (result.fail) {
        switch (result.fail)
        {
            default:
                this.logger.error(`An error occurred while retriving the server log`, result.fail);
        }
        return;
    }

    if (result.json) {
        return result.json.attributes.payload;
    }
  }

  public async getClasses(showProgress: boolean = true): Promise<string[] | undefined> {
    const requestUrl = this.getSanitizedUrl(`${this.baseUrl}${PostServiceEndpoints.workflowUrl}`);
    const body = {
        workflowArgs: {
            operation: 'getClasses'
        }
    };

    let result: Response<JsonPayloadArrayResult>;
    if (showProgress) {
        result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Retrieving classes...',
            cancellable: true
        }, progress => {
            return this.post<JsonPayloadArrayResult>(requestUrl, body);
        });
    }
    else {
        result = await this.post<JsonPayloadArrayResult>(requestUrl, body);
    }

    if (result.fail) {
        switch (result.fail)
        {
            default:
                this.logger.error(`An error occurred while retriving the server classes`, result.fail);
        }
        return;
    }

    if (result.json) {
        try {
            return result.json.attributes.payload;
        }
        catch (error) {
            this.logger.error(`An error occurred while retrieving your server log`, error);
            vscode.window.showErrorMessage(`An error occurred while retrieving your server log.`);
        }
    }
  }

  public async getClassObjects(theClass: string, showProgress: boolean = true): Promise<string[] | undefined> {
    const requestUrl = this.getSanitizedUrl(`${this.baseUrl}${PostServiceEndpoints.workflowUrl}`);
    const body = {
        workflowArgs: {
            operation: 'getClassObjects',
            theClass
        }
    };

    let result: Response<JsonPayloadArrayResult>;
    if (showProgress) {
        result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Retrieving classes...',
            cancellable: true
        }, progress => {
            return this.post<JsonPayloadArrayResult>(requestUrl, body);
        });
    }
    else {
        result = await this.post<JsonPayloadArrayResult>(requestUrl, body);
    }

    if (result.fail) {
        switch (result.fail)
        {
            default:
                this.logger.error(`An error occurred while retriving the server's ${theClass} objects`, result.fail);
        }
        return;
    }

    if (result.json) {
        return result.json.attributes.payload;
    }
  }

  public async getClassObject(theClass: string, objName: string, showProgress: boolean = true): Promise<string | undefined> {
    const requestUrl = this.getSanitizedUrl(`${this.baseUrl}${PostServiceEndpoints.workflowUrl}`);
    const body = {
        workflowArgs: {
            operation: 'getObject',
            theClass,
            objName
        }
    };

    let result: Response<JsonPayloadResult>;
    if (showProgress) {
        result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Retrieving object...',
            cancellable: true
        }, progress => {
            return this.post<JsonPayloadResult>(requestUrl, body);
        });
    } else {
        result = await this.post<JsonPayloadResult>(requestUrl, body);
    }

    if (result.fail) {
        vscode.window.showErrorMessage(`An error occurred while gathering '${theClass}:${objName}'\n${result.fail}`);
        return;
    }

    if (result.json) {
        return result.json.attributes.payload;
    }
  }

  private getSanitizedUrl(url: string): URL {
    url = url.replace(/\/\//g, "/");
    return new URL(url);
  }

  private get<T>(url: URL, body?: string | object): Promise<Response<T>> {
    return this.req<T>('GET', url, body);
  }

  private post<T>(url: URL, body?: string | object): Promise<Response<T>> {
    return this.req<T>('POST', url, body);
  }

  private async req<T>(type: "GET" | "POST", url: URL, body?: string | object): Promise<Response<T>> {
    let response: Response<T> = { ok: false };

    const options = {
        method: type,
        body: type === 'POST' ? isStringObject(body) ? body : JSON.stringify(body) : undefined,
        headers: this.headers,
        agent: this.agent,
        timeout: 10000000
    };

    try {
        const resp = await fetch(url.toString(), options);
        response.ok = resp.ok;
        if (resp.ok) {
            const json: any = await resp.json();
            if (json.errors) {
                response.fail = json.errors[0];
            } else {
                response.json = json as T;
            }
        } else {
            response.fail = resp.status;
        }
    }
    catch (error: any) {
        this.logger.debug('An error occurred while fetching results', error);
        response.fail = error;
    }

    return response;
  }
}