export type OtpEmail = {
  to: string;
  code: string;
  expiresInSeconds: number;
};

export interface EmailProvider {
  sendOtp(input: OtpEmail): Promise<{ providerMessageId: string }>;
}
