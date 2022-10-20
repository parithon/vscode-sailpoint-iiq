export interface SystemInfo {
  productInformation: {
      version: string;
      sourceRepositoryLocation: string;
      builder: string;
      buildDate: Date;
      applicationHome: string;
      hostName: string;
      memoryStats: string;
  };
  javaSystemProperties: { [key: string]: string; };
}