
export interface Response<T> {
  ok: boolean;
  json?: T;
  fail?: any;
}

export interface JsonAuthenticationResult {
  identity: string;
  authentication: 'success' | 'authenticationFailure'
}

export interface JsonPayloadResult {
  attributes: {
      payload: string;
  }
  error?: string[];
}

export interface JsonPayloadArrayResult {
  attributes: {
      payload: string[];
  }
  error?: string[];
}

export enum GetServiceEndpoints {
  authentication = '/rest/authentication'
}

export enum PostServiceEndpoints {
  workflowUrl = '/rest/workflows/VSCodeExtensionWF/launch'
}
