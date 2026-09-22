import { randomBytes } from "node:crypto";
import { createRoute, z } from "@hono/zod-openapi";
import {
  type AcceptOrgInviteResponse,
  type AuthUserResponse,
  type ChangePasswordRequest,
  type CreateOrganizationRequest,
  type CreateOrganizationResponse,
  type ListUserOrgsResponse,
  LocalAuthTokenManagedExternallyError,
  type RequestPasswordResetRequest,
  type RequestPasswordResetResponse,
  type ResetPasswordRequest,
  type RotateLocalAuthTokenResponse,
  resolveWebPublicUrl,
  rotateLocalAuthToken,
  type SetActiveOrgRequest,
  type SetupAuthRequest,
  type UpdateAuthProfileRequest,
} from "@nakama/core";
import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  persistWebPublicUrl,
  resolveRequestClientOrigin,
} from "../../services/composio-callback-url";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  ensureMfaEncryptionKey,
  generateTotpSecret,
  hashBackupCode,
  verifyTotpCode,
} from "../../services/mfa-crypto";
import type { ServerOptions } from "../context";
import {
  requirePlatformAdmin,
  requirePlatformAdminFromContext,
} from "../org-guards";
import {
  assertBrowserCsrf,
  assertJsonRequest,
  authenticateRequest,
  clearBrowserSessionCookies,
  createBrowserSessionResponse,
  errorResponse,
  getRequestAuth,
  json,
  readJson,
} from "../shared";
import type { HonoApp } from "../types";

/**
 * A real bcrypt hash at the cost the app uses, kept only so a login for an
 * unknown email costs the same as one for a known email.
 */
const ABSENT_ACCOUNT_PASSWORD_HASH =
  "$2b$10$IJnCe7uf5MN2/Vo89wb4ReF6yVI5SNnLdjIbiZ4Uwj4/r7zcqrWLm";

const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function passkeyConfig(request: Request): {
  expectedOrigin: string;
  rpId: string;
} {
  const configured = resolveWebPublicUrl();
  const expectedOrigin = configured
    ? new URL(configured).origin
    : new URL(request.url).origin;
  return { expectedOrigin, rpId: new URL(expectedOrigin).hostname };
}
export function registerAuthRoutes(app: HonoApp, options: ServerOptions): void {
  const { authService, databaseAdapter, orgService } = options;
  const authCredentialsSchema = z
    .object({
      email: z.string(),
      mfaCode: z.string().optional(),
      password: z.string(),
      backupCode: z.string().optional(),
    })
    .openapi("AuthCredentialsRequest");
  const authUserSchema = z
    .object({
      activeOrgId: z.string().nullable().optional(),
      email: z.string(),
      id: z.string(),
      isPlatformAdmin: z.boolean().optional(),
      mfaEnabled: z.boolean().optional(),
      mfaEnrolled: z.boolean().optional(),
      mfaOrgEnabled: z.boolean().optional(),
      mfaRequired: z.boolean().optional(),
      name: z.string().nullable().optional(),
      orgId: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .openapi("AuthUserResponse");
  const passkeyOptionsSchema = z.object({ email: z.string().min(1) });
  const passkeyVerifySchema = z.object({
    challengeId: z.string().min(1),
    response: z.object({}).passthrough(),
  });
  const updateAuthProfileSchema = z
    .object({
      currentPassword: z.string().optional(),
      email: z.string().optional(),
      name: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .openapi("UpdateAuthProfileRequest");
  const loggedOutSchema = z.object({
    ok: z.boolean(),
  });
  const errorSchema = z
    .object({ error: z.string() })
    .openapi("ApiErrorResponse");

  const setupAuthSchema = z
    .object({
      admin: z.object({
        email: z.string(),
        name: z.string(),
        password: z.string(),
        phone: z.string().optional(),
      }),
      organization: z.object({
        name: z.string(),
        slug: z.string(),
      }),
      webPublicUrl: z.string().optional(),
    })
    .openapi("SetupAuthRequest");
  const createOrganizationSchema = z.object({
    admin: z
      .object({
        email: z.string(),
        name: z.string(),
        phone: z.string(),
      })
      .optional(),
    name: z.string(),
    slug: z.string(),
  });
  const setActiveOrgSchema = z.object({ orgId: z.string() });
  const setupRoute = createRoute({
    method: "post",
    operationId: "setupAuth",
    path: "/v1/auth/setup",
    request: {
      body: {
        content: {
          "application/json": { schema: setupAuthSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: authUserSchema } },
        description: "Created admin user",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      409: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary:
      "Create the first organization, admin account, and browser session",
    tags: ["Auth"],
  });

  const loginRoute = createRoute({
    method: "post",
    operationId: "loginAuth",
    path: "/v1/auth/login",
    request: {
      body: {
        content: { "application/json": { schema: authCredentialsSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: authUserSchema } },
        description: "Logged in user",
      },
      401: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Log in with email and password",
    tags: ["Auth"],
  });

  const meRoute = createRoute({
    method: "get",
    operationId: "getAuthMe",
    path: "/v1/auth/me",
    responses: {
      200: {
        content: { "application/json": { schema: authUserSchema } },
        description: "Authenticated user",
      },
      401: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Get the current authenticated user",
    tags: ["Auth"],
  });

  const updateMeRoute = createRoute({
    method: "patch",
    operationId: "updateAuthMe",
    path: "/v1/auth/me",
    request: {
      body: {
        content: { "application/json": { schema: updateAuthProfileSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: authUserSchema } },
        description: "Updated user",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      401: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      403: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      409: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Update the current user's profile",
    tags: ["Auth"],
  });

  const logoutRoute = createRoute({
    method: "post",
    operationId: "logoutAuth",
    path: "/v1/auth/logout",
    responses: {
      200: {
        content: { "application/json": { schema: loggedOutSchema } },
        description: "Logged out",
      },
      401: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      403: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Log out and revoke the browser session",
    tags: ["Auth"],
  });

  const acceptInviteSchema = z
    .object({
      password: z.string().optional(),
      token: z.string(),
    })
    .openapi("AcceptOrgInviteRequest");
  const acceptInviteResponseSchema = z
    .object({
      email: z.string(),
      orgId: z.string(),
      role: z.enum(["admin", "member", "viewer"]),
    })
    .openapi("AcceptOrgInviteResponse");
  const changePasswordSchema = z
    .object({
      currentPassword: z.string(),
      newPassword: z.string(),
    })
    .openapi("ChangePasswordRequest");
  const requestPasswordResetSchema = z
    .object({ email: z.string() })
    .openapi("RequestPasswordResetRequest");
  const requestPasswordResetResponseSchema = z
    .object({
      delivered: z.boolean(),
      token: z.string().nullable(),
    })
    .openapi("RequestPasswordResetResponse");
  const resetPasswordSchema = z
    .object({
      newPassword: z.string(),
      token: z.string(),
    })
    .openapi("ResetPasswordRequest");
  const changePasswordRoute = createRoute({
    method: "post",
    operationId: "changePassword",
    path: "/v1/auth/change-password",
    request: {
      body: {
        content: { "application/json": { schema: changePasswordSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.boolean() }) },
        },
        description: "Password changed",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      401: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      403: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Change the current user's password",
    tags: ["Auth"],
  });
  const requestPasswordResetRoute = createRoute({
    method: "post",
    operationId: "requestPasswordReset",
    path: "/v1/auth/password-reset/request",
    request: {
      body: {
        content: {
          "application/json": { schema: requestPasswordResetSchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: requestPasswordResetResponseSchema },
        },
        description: "Password reset requested",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Request a password reset token",
    tags: ["Auth"],
  });
  const resetPasswordRoute = createRoute({
    method: "post",
    operationId: "resetPassword",
    path: "/v1/auth/password-reset/complete",
    request: {
      body: {
        content: { "application/json": { schema: resetPasswordSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.boolean() }) },
        },
        description: "Password reset",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Reset a password with a single-use token",
    tags: ["Auth"],
  });

  const acceptInviteRoute = createRoute({
    method: "post",
    operationId: "acceptOrgInvite",
    path: "/v1/auth/accept-invite",
    request: {
      body: {
        content: { "application/json": { schema: acceptInviteSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: acceptInviteResponseSchema } },
        description: "Invite accepted",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      401: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      404: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      409: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Accept an organization invite and create a browser session",
    tags: ["Auth"],
  });

  const rotateLocalAuthTokenSchema = z
    .object({ token: z.string() })
    .openapi("RotateLocalAuthTokenResponse");

  const rotateLocalAuthTokenRoute = createRoute({
    method: "post",
    operationId: "rotateLocalAuthToken",
    path: "/v1/auth/local-token/rotate",
    responses: {
      200: {
        content: { "application/json": { schema: rotateLocalAuthTokenSchema } },
        description: "Rotated local auth token",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      401: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      403: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
      500: {
        content: { "application/json": { schema: errorSchema } },
        description: "Error",
      },
    },
    summary: "Rotate the local API token used by CLI and channel workers",
    tags: ["Auth"],
  });

  app.openAPIRegistry.registerPath(setupRoute);
  app.post("/v1/auth/setup", async (c) => {
    if (!(authService && databaseAdapter && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }

    const humanUserCount = await databaseAdapter.countHumanUsers();
    if (humanUserCount > 0) {
      return errorResponse("Admin user already exists", 409);
    }

    const body = await readJson<SetupAuthRequest>(c.req.raw, setupAuthSchema);
    const password = body.admin?.password?.trim() ?? "";
    if (
      !(
        body.organization?.name?.trim() &&
        body.organization?.slug?.trim() &&
        body.admin?.name?.trim() &&
        body.admin?.email?.trim() &&
        password
      )
    ) {
      return errorResponse("Organization and admin details are required.", 400);
    }

    if (password.length < 8) {
      return errorResponse("Password must be at least 8 characters.", 400);
    }

    const webPublicUrl = resolveRequestClientOrigin(
      c.req.raw,
      body.webPublicUrl
    );
    if (webPublicUrl) {
      try {
        await persistWebPublicUrl(webPublicUrl);
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : String(error),
          400
        );
      }
    }

    const { user, organization } = await orgService.bootstrapInitialSetup({
      admin: {
        email: body.admin.email,
        name: body.admin.name,
        passwordHash: await authService.hashPassword(password),
        phone: body.admin.phone ?? "",
      },
      organization: {
        name: body.organization.name,
        slug: body.organization.slug,
      },
    });

    const response = await createBrowserSessionResponse(
      authService,
      databaseAdapter,
      user,
      {
        activeOrgId: organization.id,
        request: c.req.raw,
      }
    );
    const authBody = await orgService.buildAuthUserResponse(
      user,
      response.session.id,
      organization.id
    );

    return json<AuthUserResponse>(authBody, 201, response.headers);
  });

  app.openAPIRegistry.registerPath(loginRoute);
  app.post("/v1/auth/login", async (c) => {
    if (!(authService && databaseAdapter && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }
    assertJsonRequest(c.req.raw);
    const body = await readJson<{
      backupCode?: string;
      email: string;
      mfaCode?: string;
      password: string;
    }>(c.req.raw, authCredentialsSchema);
    const user = await databaseAdapter.getUserByEmail(body.email);
    if (!user) {
      // Spend the same bcrypt work an existing account would, so the response
      // time stops answering "does this email have an account here".
      await authService.verifyPassword(
        body.password?.trim() ?? "",
        ABSENT_ACCOUNT_PASSWORD_HASH
      );
      return errorResponse("Invalid credentials", 401);
    }

    // Every path that sets a password trims it first, so login has to as well
    // or a padded password can never be typed back in.
    const valid = await authService.verifyPassword(
      body.password?.trim() ?? "",
      user.passwordHash
    );
    if (!valid) {
      return errorResponse("Invalid credentials", 401);
    }

    if (user.disabledAt) {
      return errorResponse("Account disabled", 403);
    }
    if (user.mfaEnabled) {
      const totpValid =
        Boolean(user.mfaTotpSecretEnc) &&
        verifyTotpCode(
          decryptTotpSecret(user.mfaTotpSecretEnc as string),
          body.mfaCode ?? ""
        );
      const backupValid = body.backupCode
        ? await databaseAdapter.consumeMfaBackupCode(
            user.id,
            hashBackupCode(body.backupCode),
            new Date().toISOString()
          )
        : false;
      if (!(totpValid || backupValid)) {
        return errorResponse("MFA verification required.", 401);
      }
    }

    const response = await createBrowserSessionResponse(
      authService,
      databaseAdapter,
      user,
      {
        request: c.req.raw,
      }
    );
    const authBody = await orgService.buildAuthUserResponse(
      user,
      response.session.id,
      response.session.activeOrgId
    );
    return json<AuthUserResponse>(authBody, 200, response.headers);
  });

  app.post("/v1/auth/passkey/registration/options", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }
    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);
    const user = await databaseAdapter.getUserById(auth.user.id);
    if (!user) {
      return errorResponse("Authentication required", 401);
    }
    const { rpId } = passkeyConfig(c.req.raw);
    const passkeys = await databaseAdapter.listPasskeysForUser(user.id);
    const options = await generateRegistrationOptions({
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      attestationType: "none",
      excludeCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransport[],
      })),
      rpID: rpId,
      rpName: "Nakama",
      userDisplayName: user.name ?? user.email,
      userID: Buffer.from(user.id),
      userName: user.email,
    });
    const now = new Date();
    const challengeId = crypto.randomUUID();
    await databaseAdapter.createMfaChallenge({
      challenge: options.challenge,
      createdAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + PASSKEY_CHALLENGE_TTL_MS
      ).toISOString(),
      id: challengeId,
      type: "registration",
      userId: user.id,
    });
    return json({ challengeId, options });
  });

  app.post("/v1/auth/passkey/registration/verify", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }
    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);
    const body = await readJson<{
      challengeId: string;
      response: Record<string, unknown>;
    }>(c.req.raw, passkeyVerifySchema);
    const response = body.response as unknown as RegistrationResponseJSON;
    const challenge = await databaseAdapter.consumeMfaChallenge(
      body.challengeId,
      auth.user.id,
      "registration",
      new Date().toISOString()
    );
    if (!challenge) {
      return errorResponse("Passkey challenge expired or already used.", 400);
    }
    const { expectedOrigin, rpId } = passkeyConfig(c.req.raw);
    try {
      const verification = await verifyRegistrationResponse({
        expectedChallenge: challenge.challenge,
        expectedOrigin,
        expectedRPID: rpId,
        response,
      });
      if (!verification.verified) {
        return errorResponse("Passkey registration failed.", 400);
      }
      const credential = verification.registrationInfo.credential;
      if (await databaseAdapter.getPasskeyByCredentialId(credential.id)) {
        return errorResponse("Passkey is already registered.", 409);
      }
      await databaseAdapter.createPasskey({
        backedUp: verification.registrationInfo.credentialBackedUp,
        counter: credential.counter,
        createdAt: new Date().toISOString(),
        credentialId: credential.id,
        deviceType: verification.registrationInfo.credentialDeviceType,
        id: crypto.randomUUID(),
        lastUsedAt: null,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        transports: credential.transports ?? [],
        userId: auth.user.id,
      });
      return json({ verified: true });
    } catch {
      return errorResponse("Passkey registration failed.", 400);
    }
  });

  app.post("/v1/auth/passkey/login/options", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }
    const body = await readJson<{ email: string }>(
      c.req.raw,
      passkeyOptionsSchema
    );
    const user = await databaseAdapter.getUserByEmail(body.email);
    if (!user || user.disabledAt) {
      return errorResponse("Invalid passkey login.", 401);
    }
    const passkeys = await databaseAdapter.listPasskeysForUser(user.id);
    if (passkeys.length === 0) {
      return errorResponse("No passkey is registered.", 401);
    }
    const { rpId } = passkeyConfig(c.req.raw);
    const options = await generateAuthenticationOptions({
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransport[],
      })),
      rpID: rpId,
      userVerification: "preferred",
    });
    const now = new Date();
    const challengeId = crypto.randomUUID();
    await databaseAdapter.createMfaChallenge({
      challenge: options.challenge,
      createdAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + PASSKEY_CHALLENGE_TTL_MS
      ).toISOString(),
      id: challengeId,
      type: "authentication",
      userId: user.id,
    });
    return json({ challengeId, options });
  });

  app.post("/v1/auth/passkey/login/verify", async (c) => {
    if (!(authService && databaseAdapter && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }
    const body = await readJson<{
      challengeId: string;
      response: Record<string, unknown>;
    }>(c.req.raw, passkeyVerifySchema);
    const response = body.response as unknown as AuthenticationResponseJSON;
    const pending = await databaseAdapter.getMfaChallenge(body.challengeId);
    if (!pending || pending.type !== "authentication") {
      return errorResponse("Passkey challenge expired or already used.", 400);
    }
    const challenge = await databaseAdapter.consumeMfaChallenge(
      body.challengeId,
      pending.userId,
      "authentication",
      new Date().toISOString()
    );
    if (!challenge) {
      return errorResponse("Passkey challenge expired or already used.", 400);
    }
    const user = await databaseAdapter.getUserById(challenge.userId);
    if (!user || user.disabledAt) {
      return errorResponse("Invalid passkey login.", 401);
    }
    if (typeof response.id !== "string") {
      return errorResponse("Invalid passkey login.", 401);
    }
    const credentialId = response.id;
    const passkey =
      await databaseAdapter.getPasskeyByCredentialId(credentialId);
    if (!passkey || passkey.userId !== user.id) {
      return errorResponse("Invalid passkey login.", 401);
    }
    const { expectedOrigin, rpId } = passkeyConfig(c.req.raw);
    try {
      const verification = await verifyAuthenticationResponse({
        credential: {
          counter: passkey.counter,
          id: passkey.credentialId,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          transports: passkey.transports,
        },
        expectedChallenge: challenge.challenge,
        expectedOrigin,
        expectedRPID: rpId,
        requireUserVerification: false,
        response,
      });
      if (!verification.verified) {
        return errorResponse("Invalid passkey login.", 401);
      }
      if (
        !(await databaseAdapter.updatePasskeyCounter(
          passkey.id,
          verification.authenticationInfo.newCounter,
          new Date().toISOString()
        ))
      ) {
        return errorResponse("Invalid passkey login.", 401);
      }
      const session = await createBrowserSessionResponse(
        authService,
        databaseAdapter,
        user,
        { request: c.req.raw }
      );
      const authBody = await orgService.buildAuthUserResponse(
        user,
        session.session.id,
        session.session.activeOrgId
      );
      return json<AuthUserResponse>(authBody, 200, session.headers);
    } catch {
      return errorResponse("Invalid passkey login.", 401);
    }
  });

  app.post("/v1/auth/mfa/totp/start", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }
    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);
    const secret = generateTotpSecret();
    await databaseAdapter.updateUserMfa(
      auth.user.id,
      { enabled: false, totpSecretEnc: encryptTotpSecret(secret) },
      new Date().toISOString()
    );
    const issuer = encodeURIComponent("Nakama");
    const account = encodeURIComponent(auth.user.email);
    return json({
      secret,
      uri: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    });
  });

  app.post("/v1/auth/mfa/totp/verify", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }
    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);
    const body = await readJson<{ code: string }>(
      c.req.raw,
      z.object({ code: z.string().min(6).max(8) })
    );
    const user = await databaseAdapter.getUserById(auth.user.id);
    if (
      !(
        user?.mfaTotpSecretEnc &&
        verifyTotpCode(decryptTotpSecret(user.mfaTotpSecretEnc), body.code)
      )
    ) {
      return errorResponse("Invalid MFA code", 400);
    }
    await databaseAdapter.updateUserMfa(
      auth.user.id,
      { enabled: true, totpSecretEnc: user.mfaTotpSecretEnc },
      new Date().toISOString()
    );
    const backupCodes: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const code = randomBytes(5).toString("hex").toUpperCase();
      backupCodes.push(code);
      await databaseAdapter.createMfaBackupCode({
        codeHash: hashBackupCode(code),
        createdAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        usedAt: null,
        userId: auth.user.id,
      });
    }
    return json({ backupCodes, enabled: true });
  });

  app.post("/v1/auth/mfa/backup-codes/regenerate", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }
    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);
    const { code } = await readJson<{ code: string }>(
      c.req.raw,
      z.object({ code: z.string().min(1) })
    );
    const user = await databaseAdapter.getUserById(auth.user.id);
    if (!(user?.mfaEnabled && user.mfaTotpSecretEnc)) {
      return errorResponse("MFA is not enabled.", 400);
    }

    const validTotp = verifyTotpCode(
      decryptTotpSecret(user.mfaTotpSecretEnc),
      code
    );
    const validBackup = validTotp
      ? false
      : await databaseAdapter.consumeMfaBackupCode(
          user.id,
          hashBackupCode(code),
          new Date().toISOString()
        );
    if (!(validTotp || validBackup)) {
      return errorResponse("Invalid MFA code.", 400);
    }

    const now = new Date().toISOString();
    for (const backupCode of await databaseAdapter.listMfaBackupCodes(
      user.id
    )) {
      if (!backupCode.usedAt) {
        await databaseAdapter.consumeMfaBackupCode(
          user.id,
          backupCode.codeHash,
          now
        );
      }
    }

    const backupCodes: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const backupCode = randomBytes(5).toString("hex").toUpperCase();
      backupCodes.push(backupCode);
      await databaseAdapter.createMfaBackupCode({
        codeHash: hashBackupCode(backupCode),
        createdAt: now,
        id: crypto.randomUUID(),
        usedAt: null,
        userId: user.id,
      });
    }
    return json({ backupCodes });
  });

  app.post("/v1/auth/mfa/disable", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }
    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);
    await databaseAdapter.updateUserMfa(
      auth.user.id,
      { enabled: false, totpSecretEnc: null },
      new Date().toISOString()
    );
    return json({ enabled: false });
  });
  app.post("/v1/settings/mfa/encryption-key", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }
    const auth = requirePlatformAdminFromContext(c);
    assertBrowserCsrf(c.req.raw, auth, authService);
    await ensureMfaEncryptionKey();
    return json({ configured: true });
  });
  app.openapi(meRoute, async (c) => {
    if (!(authService && databaseAdapter && orgService)) {
      return c.json({ error: "Authentication not configured" }, 500);
    }

    const auth = await authenticateRequest(
      c.req.raw,
      authService,
      databaseAdapter
    );
    if (!auth) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const user = await databaseAdapter.getUserById(auth.user.id);
    if (!user) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authBody = await orgService.buildAuthUserResponse(
      user,
      auth.session?.id,
      auth.session?.activeOrgId
    );
    return c.json(authBody, 200);
  });

  app.openAPIRegistry.registerPath(updateMeRoute);
  app.patch("/v1/auth/me", async (c) => {
    if (!(authService && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }

    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);

    const body = await readJson<UpdateAuthProfileRequest>(
      c.req.raw,
      updateAuthProfileSchema
    );
    const updated = await orgService.updateOwnProfile(auth.user.id, body);
    return json<AuthUserResponse>(updated);
  });

  app.openapi(logoutRoute, async (c) => {
    if (!(authService && databaseAdapter)) {
      return c.json({ error: "Authentication not configured" }, 500);
    }

    const auth = await authenticateRequest(
      c.req.raw,
      authService,
      databaseAdapter
    );
    if (!auth) {
      return c.json({ error: "Authentication required" }, 401);
    }

    assertBrowserCsrf(c.req.raw, auth, authService);

    if (auth.mode === "browser-session" && auth.session) {
      const revokedAt = new Date().toISOString();
      await databaseAdapter.revokeBrowserSessionBySessionTokenHash(
        auth.session.sessionTokenHash,
        revokedAt
      );
    }

    const response = c.json({ ok: true }, 200);
    clearBrowserSessionCookies(response.headers);
    return response;
  });

  app.openAPIRegistry.registerPath(changePasswordRoute);
  app.post("/v1/auth/change-password", async (c) => {
    if (!(authService && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }

    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);

    const body = await readJson<ChangePasswordRequest>(
      c.req.raw,
      changePasswordSchema
    );
    await orgService.changePassword({
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      userId: auth.user.id,
    });

    const response = c.json({ ok: true }, 200);
    clearBrowserSessionCookies(response.headers);
    return response;
  });

  app.openAPIRegistry.registerPath(requestPasswordResetRoute);
  app.post("/v1/auth/password-reset/request", async (c) => {
    if (!(authService && databaseAdapter && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }

    const body = await readJson<RequestPasswordResetRequest>(
      c.req.raw,
      requestPasswordResetSchema
    );
    const auth = await authenticateRequest(
      c.req.raw,
      authService,
      databaseAdapter
    );
    const allowManualToken = auth?.isPlatformAdmin === true;
    if (allowManualToken && auth) {
      assertBrowserCsrf(c.req.raw, auth, authService);
    }
    return json<RequestPasswordResetResponse>(
      await orgService.requestPasswordReset(body.email, allowManualToken)
    );
  });

  app.openAPIRegistry.registerPath(resetPasswordRoute);
  app.post("/v1/auth/password-reset/complete", async (c) => {
    if (!orgService) {
      return errorResponse("Authentication not configured", 500);
    }

    const body = await readJson<ResetPasswordRequest>(
      c.req.raw,
      resetPasswordSchema
    );
    await orgService.resetPassword(body);
    return c.json({ ok: true }, 200);
  });

  app.openAPIRegistry.registerPath(acceptInviteRoute);
  app.post("/v1/auth/accept-invite", async (c) => {
    if (!(authService && databaseAdapter && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }

    const body = await readJson<{ token: string; password?: string }>(
      c.req.raw,
      acceptInviteSchema
    );
    const accepted = await orgService.acceptInvite(body);
    const response = await createBrowserSessionResponse(
      authService,
      databaseAdapter,
      accepted.user,
      { activeOrgId: accepted.orgId, request: c.req.raw }
    );

    return json<AcceptOrgInviteResponse>(
      {
        email: accepted.user.email,
        orgId: accepted.orgId,
        role: accepted.role,
      },
      200,
      response.headers
    );
  });

  app.openAPIRegistry.registerPath(rotateLocalAuthTokenRoute);
  app.post("/v1/auth/local-token/rotate", async (c) => {
    if (!(authService && databaseAdapter)) {
      return errorResponse("Authentication not configured", 500);
    }

    const auth = await authenticateRequest(
      c.req.raw,
      authService,
      databaseAdapter
    );
    if (!auth) {
      return errorResponse("Authentication required", 401);
    }

    if (auth.mode !== "browser-session") {
      return errorResponse(
        "Sign in through the dashboard to rotate the local auth token.",
        403
      );
    }

    requirePlatformAdmin(auth);
    assertBrowserCsrf(c.req.raw, auth, authService);

    try {
      const token = await rotateLocalAuthToken();
      return json<RotateLocalAuthTokenResponse>({ token }, 200);
    } catch (error) {
      if (error instanceof LocalAuthTokenManagedExternallyError) {
        return errorResponse(error.message, 400);
      }

      throw error;
    }
  });

  app.get("/v1/auth/orgs", async (c) => {
    if (!orgService) {
      return errorResponse("Authentication not configured", 500);
    }

    const auth = getRequestAuth(c);
    const orgs = await orgService.listUserOrgs(auth.user.id);
    return json<ListUserOrgsResponse>(orgs);
  });

  app.post("/v1/auth/orgs", async (c) => {
    if (!(authService && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }

    const auth = requirePlatformAdminFromContext(c);
    assertBrowserCsrf(c.req.raw, auth, authService);

    const body = await readJson<CreateOrganizationRequest>(
      c.req.raw,
      createOrganizationSchema
    );
    const result = await orgService.createOrganization(body, auth.user.id);
    return json<CreateOrganizationResponse>(result, 201);
  });

  app.post("/v1/auth/active-org", async (c) => {
    if (!(authService && databaseAdapter && orgService)) {
      return errorResponse("Authentication not configured", 500);
    }

    const auth = getRequestAuth(c);
    assertBrowserCsrf(c.req.raw, auth, authService);

    const body = await readJson<SetActiveOrgRequest>(
      c.req.raw,
      setActiveOrgSchema
    );
    await orgService.setActiveOrg({
      orgId: body.orgId,
      sessionId: auth.session?.id,
      userId: auth.user.id,
    });

    const user = await databaseAdapter.getUserById(auth.user.id);
    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    const authBody = await orgService.buildAuthUserResponse(
      user,
      auth.session?.id,
      body.orgId
    );
    return json<AuthUserResponse>(authBody);
  });
}
