export interface SMTPConfig {
  serverAddress: string;
  port: number;
  authMethod: "SMTP-AUTH" | "None";
  authAccount?: string;
  authPassword?: string;
  sslMethod: "None" | "SSL" | "TLS";
  emailAddress: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailLog {
  userId: string;
  timestamp: Date;
  results: {
    email: string;
    success: boolean;
    attachmentsSent?: number;
    error?: string;
  }[];
  templateUsed: string;
}
