import * as vscode from 'vscode';
import * as base64 from 'base-64';
import { SystemInfo } from '../api';

export class IIQTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string | undefined {
    let value: string | SystemInfo = base64.decode(uri.fragment);
    switch (uri.authority.toLowerCase()) {
      case 'serverinfo':
        const systemInfos = JSON.parse(value) as SystemInfo;          
        let md = '## Product Information\n';
        md += `* HostName: **${systemInfos.productInformation.hostName}**\n`;
        md += `* Version: **${systemInfos.productInformation.version}**\n`;
        md += `* Builder: **${systemInfos.productInformation.builder}**\n`;
        md += `* Build Date: **${new Date(systemInfos.productInformation.buildDate)}**\n`;
        md += `\n`;
        md += '## Java System Properties\n';
        for (let key in systemInfos.javaSystemProperties) {
          md += `* ${key}: **${systemInfos.javaSystemProperties[key]}**\n`;
        }
        return new vscode.MarkdownString(md, true).value;
      case 'log':
        return value.replace(/^#/g,"");
      case 'object':
        const classquery = uri.query.match(/className=(\w+)/);
        const objectquery = uri.query.match(/objectName=(\w+)/);
        return value;
    }
  }
}
