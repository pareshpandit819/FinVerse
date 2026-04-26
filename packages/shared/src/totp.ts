import * as OTPAuth from "otpauth";
import { randomBytes } from "crypto";

export interface TotpSetup {
  secret: string;
  uri: string;
}

export function generateTotpSecret(userEmail: string, issuer = "FinancialDashboard"): TotpSetup {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: userEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromHex(randomBytes(20).toString("hex")),
  });
  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
