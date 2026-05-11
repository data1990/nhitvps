export type NginxSiteMode = "static" | "reverse_proxy";

export type NginxSslMode = "none" | "lets_encrypt" | "custom";

export type NginxSiteConfig = {
  id: string;
  domain: string;
  aliases: string[];
  mode: NginxSiteMode;
  documentRoot?: string;
  upstreamUrl?: string;
  sslMode: NginxSslMode;
  accessLogPath: string;
  errorLogPath: string;
  enabled: boolean;
};

export type RenderedNginxVhost = {
  fileName: string;
  content: string;
};

