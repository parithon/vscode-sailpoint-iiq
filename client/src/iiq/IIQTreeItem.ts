import * as vscode from 'vscode';

export class IIQTreeItem extends vscode.TreeItem {
  public readonly command?: vscode.Command;
  public readonly className?: string;
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

export class IIQClassTreeItem extends IIQTreeItem {
  constructor(
    public readonly label: string,
    collapsibleState?: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState ?? vscode.TreeItemCollapsibleState.Collapsed);
  }
  contextValue = "iiqClass";
}

export class IIQObjectTreeItem extends IIQTreeItem {
  constructor(
    public readonly label: string,
    public readonly className: string,
    public readonly command: vscode.Command
  ) {
    super (label, vscode.TreeItemCollapsibleState.None);
  }
  contextValue = "iiqClassObject";
}
