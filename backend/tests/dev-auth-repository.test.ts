import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createDefaultAuthRepository, devAdminCredentials } from "../src/modules/auth/index.js";

describe("development auth seed", () => {
  it("allows the default development admin to log in when no auth repository is injected", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: devAdminCredentials.username,
        password: devAdminCredentials.password,
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        username: devAdminCredentials.username,
        email: devAdminCredentials.email,
      },
    });
  });

  it("grants the development admin system manage permission", async () => {
    const repository = await createDefaultAuthRepository();
    const user = await repository.findUserByIdentifier(devAdminCredentials.username);

    expect(user).not.toBeNull();
    await expect(repository.listPermissionKeysByUserId(user!.id)).resolves.toContain("system:manage");
  });
});
