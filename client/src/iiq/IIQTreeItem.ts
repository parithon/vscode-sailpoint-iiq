import * as vscode from 'vscode';

export class IIQTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState?: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
  }

  contextValue = this.collapsibleState === vscode.TreeItemCollapsibleState.None ? "iiqClassObject" : "iiqClass";
}
