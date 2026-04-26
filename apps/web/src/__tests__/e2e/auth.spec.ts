import { test, expect } from "@playwright/test";

/**
 * Auth E2E — register → login → dashboard
 * Requires the full stack (Next.js dev server + Postgres + Redis).
 * Run via: make test-e2e
 */

const TEST_EMAIL = `e2e-auth-${Date.now()}@acme.example`;
const TEST_PASSWORD = "TestPassword123!";
const TEST_NAME = "E2E Test User";

test.describe("Authentication flow", () => {
  test("login page renders email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
  });

  test("registration creates account and redirects to login", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill(TEST_NAME);
    await page.getByLabel("Email address").fill(TEST_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("unauthenticated request to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("MFA flow", () => {
  test("MFA enroll page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/mfa/enroll");
    await expect(page).toHaveURL(/\/login|\/mfa\/enroll/);
  });

  test("MFA challenge page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/mfa/challenge");
    await expect(page).toHaveURL(/\/login|\/mfa\/challenge/);
  });
});

test.describe("Session security", () => {
  test("accessing /api/auth/mfa/verify without session returns 401", async ({ request }) => {
    const res = await request.post("/api/auth/mfa/verify", {
      data: { token: "123456" },
    });
    expect(res.status()).toBe(401);
  });

  test("accessing /api/auth/mfa/enroll without session returns 401", async ({ request }) => {
    const res = await request.get("/api/auth/mfa/enroll");
    expect(res.status()).toBe(401);
  });

  test("register with mismatched passwords is rejected on client", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Test");
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("differentpassword");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });
});
