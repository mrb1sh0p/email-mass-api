/**
 * Interface que define a configuração do servidor SMTP para envio de e-mails.
 */
export interface SMTPConfig {
  // Endereço do servidor SMTP (por exemplo, smtp.exemplo.com)
  serverAddress: string;
  // Porta utilizada para conexão com o servidor SMTP
  port: number;
  // Método de autenticação: "SMTP-AUTH" indica que a autenticação é necessária; "None" indica que não é
  authMethod: "SMTP-AUTH" | "None";
  // Conta de autenticação, utilizada se authMethod for "SMTP-AUTH" (opcional)
  authAccount?: string;
  // Senha de autenticação correspondente à conta (opcional)
  authPassword?: string;
  // Método de segurança SSL/TLS: "None", "SSL" ou "TLS"
  sslMethod: "None" | "SSL" | "TLS";
  // Endereço de e-mail associado a essa configuração
  emailAddress: string;
}

/**
 * Interface que define o template de e-mail.
 */
export interface EmailTemplate {
  // Assunto do e-mail
  subject: string;
  // Corpo do e-mail (pode ser texto ou HTML)
  body: string;
  // Data de criação do template
  createdAt: Date;
  // Data da última atualização do template
  updatedAt: Date;
}

/**
 * Interface que representa o log de envio de e-mails.
 */
export interface EmailLog {
  // ID do usuário que realizou o envio do e-mail
  userId: string;
  // Data e hora em que o log foi registrado
  timestamp: Date;
  // Array contendo os resultados detalhados de cada tentativa de envio
  results: {
    // Endereço de e-mail para o qual o envio foi tentado
    email: string;
    // Indica se o envio foi realizado com sucesso
    success: boolean;
    // Número de anexos enviados (opcional)
    attachmentsSent?: number;
    // Mensagem de erro, se o envio falhou (opcional)
    error?: string;
  }[];
  // Identificador do template de e-mail utilizado para o envio
  templateUsed: string;
}
