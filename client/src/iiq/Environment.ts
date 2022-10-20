import { Credential } from '../api';

export interface Environment {
  name: string;
  url: URL | null;
  readonly credentials?: Credential;
  readonly identity?: string;
  props?: {[key: string]: string};
}