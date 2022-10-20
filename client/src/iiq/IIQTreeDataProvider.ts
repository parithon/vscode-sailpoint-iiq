import * as vscode from 'vscode';

import { IIQClient } from './IIQClient';
import { IIQTreeItem } from './IIQTreeItem';

export class IIQTreeDataProvider implements vscode.TreeDataProvider<IIQTreeItem> {
  private readonly _onDidChangeTreeData: vscode.EventEmitter<IIQTreeItem | undefined| void> = new vscode.EventEmitter();
  public onDidChangeTreeData: vscode.Event<IIQTreeItem | undefined| void> = this._onDidChangeTreeData.event;

  constructor(private readonly iiqClient: IIQClient) {
    this.iiqClient.onDidChangeEnvironment(() => {
      this.refresh();
    });
  }
  
  async refresh(element?: IIQTreeItem): Promise<void> {
    this._onDidChangeTreeData.fire(element);
  }
  
  getTreeItem(element: IIQTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: IIQTreeItem): Promise<IIQTreeItem[]> {
    if (element) {
      const objs = await this.iiqClient.getObjects(element.label, false);
      if (objs) {
        const nodes = objs.map(obj => new IIQTreeItem(obj, vscode.TreeItemCollapsibleState.None, {
          "command": "vscode-sailpoint-iiq.explorer.object.open",
          "title": "Open IdentityIQ Class Object",
          "arguments": [element.label, obj]
        }));
        return nodes;
      }
    } else {
      const classes = await this.iiqClient.getClasses(false);
      if (classes) {
        const nodes = classes.map(c => new IIQTreeItem(c, vscode.TreeItemCollapsibleState.Collapsed));
        return nodes;
      }
    }
    return [];
  }
}
