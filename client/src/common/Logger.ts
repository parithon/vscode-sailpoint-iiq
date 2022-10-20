import * as vscode from 'vscode';

enum LogLevel {
  info,
  warn,
  error,
  debug
}

class EnumUtil {
  static logLevel: typeof LogLevel = LogLevel;
  static toNumber: { [s: number]: string | number } = LogLevel;
}

export class Logger {
  constructor(private readonly output: vscode.OutputChannel, private readonly configuration: vscode.WorkspaceConfiguration) {}
  debug(message: string, ...optionalParams: any[]): void {
    this.log(message, LogLevel.debug, ...optionalParams);
  }
  error(message: string, ...optionalParams: any[]): void {
    this.log(message, LogLevel.error, ...optionalParams);
  }
  warn(message: string, ...optionalParams: any[]): void {
    this.log(message, LogLevel.warn, ...optionalParams);
  }
  info(message: string, ...optionalParams: any[]): void {
    this.log(message, LogLevel.info, ...optionalParams);
  }
  private log(message: string, level: LogLevel, ...optionalParams: any[]): void {
    const acceptableLevelSetting: LogLevel = this.configuration.get<LogLevel>('logLevel') ?? LogLevel.info;
    const acceptableLevel = EnumUtil.toNumber[acceptableLevelSetting];
    
    if (level <= acceptableLevel) {
      this.output.appendLine(message);
      if (optionalParams.length > 0) {
        this.output.appendLine(JSON.stringify(optionalParams));
      }
    }
    
    switch(level)
    {
      case LogLevel.warn: 
        console.warn(message, ...optionalParams);
        break;
      case LogLevel.error:
        console.error(message, ...optionalParams);
        break;
      case LogLevel.debug:
        console.debug(message, ...optionalParams);
        break;
      default: 
        console.info(message, ...optionalParams);
        break;
    }
  }
}