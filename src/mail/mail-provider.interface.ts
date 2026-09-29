export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface MailProvider {
  send(params: SendEmailParams): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
