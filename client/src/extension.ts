import * as vscode from 'vscode';

import { Logger } from './common';
import { SailPointIIQAuthenticationProvider } from './auth/authProvider';
import { 
	IIQClassTreeItem,
	IIQClient, 
	IIQObjectTreeItem, 
	IIQTextDocumentContentProvider,
	IIQTreeDataProvider,
	IIQTreeItem
} from './iiq';

let client: IIQClient;

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "vscode-sailpoint-iiq" is now active!');

	const statusBar = vscode.window.createStatusBarItem('vscode-sailpoint-iiq.statusBar', vscode.StatusBarAlignment.Right, 99);
	statusBar.command = 'vscode-sailpoint-iiq.toggleEnvironment';

	const contentSchema = 'sailpoint-iiq';
	const contentProvider = new IIQTextDocumentContentProvider();
	const output = vscode.window.createOutputChannel('SailPoint IdentityIQ', 'log');
	const logger = new Logger(output, vscode.workspace.getConfiguration('vscode-sailpoint-iiq'));
	const authProvider = new SailPointIIQAuthenticationProvider(context.secrets, logger);
	
	client = new IIQClient(authProvider, context.workspaceState, statusBar, logger);
	
	const treeDataProvider = new IIQTreeDataProvider(client);

	context.subscriptions.push(
		vscode.authentication.registerAuthenticationProvider(SailPointIIQAuthenticationProvider.id, 'SailPoint IdentityIQ', authProvider),
		vscode.window.registerTreeDataProvider('vscode-sailpoint-iiq.explorer', treeDataProvider),
		vscode.workspace.registerTextDocumentContentProvider(contentSchema, contentProvider),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.openEnvironment', () => client.openEnvironment()),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.closeEnvironment', () => client.closeEnvironment()),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.toggleEnvironment', () => client.toggleEnvironment()),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.updateEnvironments', () => client.cacheEnvironments()),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.viewServerInfo', () => client.showServerInfo()),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.getServerInfo', () => client.getServerLog()),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.getObject', () => client.getObject()),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.explorer.refresh', () => treeDataProvider.refresh()),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.explorer.object.refresh', (node: IIQTreeItem) => treeDataProvider.refresh(node)),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.explorer.object.open', (className: string, objectName: string) => client.previewClassObject(className, objectName)),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.explorer.object.downloadAll', (node: IIQClassTreeItem) => client.downloadAllObjects(node)),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.explorer.object.download', (node: IIQObjectTreeItem) => client.downloadObject(node)),
		vscode.commands.registerCommand('vscode-sailpoint-iiq.explorer.object.upload', (_, files) => client.uploadObject(files)),
		client,
		output
	);
}

export function deactivate() {}
