const { test, trait, beforeEach, afterEach } = use("Test/Suite")(
  "Forgot Password"
);

/** @type {import('@adonisjs/lucid/src/Factory')} */
const Factory = use("Factory");

/** @type {typeof import('@adonisjs/lucid/src/Lucid/Model')} */
const Hash = use("Hash");
const Database = use("Database");

const Mail = use("Mail");
const { subHours, format } = require("date-fns");

trait("Test/ApiClient");
trait("DatabaseTransactions");

beforeEach(() => {
  Mail.fake();
});

afterEach(() => {
  Mail.restore();
});

async function generateForgotPasswordToken(client, email) {
  const user = await Factory.model("App/Models/User").create({ email });

  await client
    .post("/forgot")
    .send({ email })
    .end();

  const token = await user.tokens().first();

  return token;
}

test("it should send an email with reset password instructions", async ({
  assert,
  client
}) => {
  const email = "thauan@ferozdigital.com.br";

  const token = await generateForgotPasswordToken(client, email);

  const recentEmail = Mail.pullRecent();

  assert.equal(recentEmail.message.to[0].address, email);

  assert.include(token.toJSON(), {
    type: "forgotpassword"
  });
});

test("it should be able to reset password", async ({ assert, client }) => {
  const email = "thauan@ferozdigital.com.br";

  const user = await Factory.model("App/Models/User").create({ email });
  const userToken = await Factory.model("App/Models/Token").make();

  await user.tokens().save(userToken);

  const response = await client
    .post("/reset")
    .send({
      token: userToken.token,
      password: "123456",
      password_confirmation: "123456"
    })
    .end();

  response.assertStatus(204);

  await user.reload();

  const checkPassword = await Hash.verify("123456", user.password);

  assert.isTrue(checkPassword);
});

test("it cannot reset password after 2h of forgot password request", async ({
  client
}) => {
  const email = "thauan@ferozdigital.com.br";

  const user = await Factory.model("App/Models/User").create({ email });
  const userToken = await Factory.model("App/Models/Token").make();

  await user.tokens().save(userToken);

  const dateWithSub = format(subHours(new Date(), 3), "yyyy-MM-dd HH:ii:ss");

  await Database.table("tokens")
    .where("token", userToken.token)
    .update("created_at", dateWithSub);

  await userToken.reload();

  const response = await client
    .post("/reset")
    .send({
      token: userToken.token,
      password: "123456",
      password_confirmation: "123456"
    })
    .end();

  response.assertStatus(400);
});
