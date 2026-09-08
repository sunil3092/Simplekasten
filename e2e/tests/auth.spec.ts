import { expect, test } from "@playwright/test";
import { registerAndEnterVault, uniqueEmail } from "./helpers";

test("registering a new account lands in an empty vault", async ({ page }) => {
  await registerAndEnterVault(page, "Ada");
  await expect(page.getByText(/your vault is empty/i)).toBeVisible();
});

test("logging out returns to the login screen, and logging back in works", async ({ page }) => {
  const { email } = await registerAndEnterVault(page, "Grace");

  await page.getByText(/log out/i).click();
  await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("correcthorse-battery-staple");
  await page.getByRole("button", { name: /^log in$/i }).click();

  await expect(page.getByRole("button", { name: /\+ new note/i }).first()).toBeVisible();
});

test("registering twice with the same email shows an error instead of crashing", async ({ page }) => {
  const email = uniqueEmail("dup");
  await page.goto("/");
  await page.getByText(/need an account\? register/i).click();
  await page.getByPlaceholder("Display name").fill("First");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("correcthorse-battery-staple");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.getByRole("button", { name: /\+ new note/i }).first().waitFor();

  await page.getByText(/log out/i).click();
  await page.getByText(/need an account\? register/i).click();
  await page.getByPlaceholder("Display name").fill("Second");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("correcthorse-battery-staple");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page.getByText(/already exists/i)).toBeVisible();
});

test("a wrong password shows an error rather than logging in", async ({ page }) => {
  const { email } = await registerAndEnterVault(page, "Marie");
  await page.getByText(/log out/i).click();

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("the-wrong-password");
  await page.getByRole("button", { name: /^log in$/i }).click();

  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
});
