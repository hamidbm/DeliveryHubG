import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_PORTFOLIOS, POST as POST_PORTFOLIOS } from '../src/app/api/application-portfolios/route';
import { GET as GET_PORTFOLIO, PUT as PUT_PORTFOLIO } from '../src/app/api/application-portfolios/[id]/route';
import { GET as GET_RELEASE_TRAINS, POST as POST_RELEASE_TRAINS } from '../src/app/api/release-trains/route';

export const run = async () => {
  await runTest('application-portfolios', async ({ createUser, setAuthToken, db }) => {
    const { token } = await createUser({ name: 'APM Owner', email: 'apm.owner@demo.local', role: 'Director' });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const createRes = await callRoute(POST_PORTFOLIOS, 'http://localhost/api/application-portfolios', {
      method: 'POST',
      body: { name: 'Digital Banking', description: 'Customer channels', executiveOwner: 'SVP Retail' }
    });
    const createBody = await (createRes as Response).json();
    assert.strictEqual((createRes as Response).status, 201, `Unexpected create response: ${JSON.stringify(createBody)}`);
    const created = createBody;
    assert.ok(created?.item?._id, 'Expected portfolio id');

    const listRes = await callRoute(GET_PORTFOLIOS, 'http://localhost/api/application-portfolios', { method: 'GET' });
    assert.strictEqual((listRes as Response).status, 200);
    const listBody = await (listRes as Response).json();
    assert.ok(Array.isArray(listBody?.items) && listBody.items.length >= 1, 'Expected at least one portfolio');

    const portfolioId = String(created.item._id);
    const getRes = await callRoute(GET_PORTFOLIO, 'http://localhost/api/application-portfolios/id', {
      method: 'GET',
      params: { id: portfolioId }
    });
    assert.strictEqual((getRes as Response).status, 200);

    const updateRes = await callRoute(PUT_PORTFOLIO, 'http://localhost/api/application-portfolios/id', {
      method: 'PUT',
      params: { id: portfolioId },
      body: { name: 'Digital Banking Core', executiveOwner: 'VP Channels' }
    });
    assert.strictEqual((updateRes as Response).status, 200);
    const updated = await (updateRes as Response).json();
    assert.strictEqual(updated?.item?.name, 'Digital Banking Core');

    const trainRes = await callRoute(POST_RELEASE_TRAINS, 'http://localhost/api/release-trains', {
      method: 'POST',
      body: { name: 'DigitalBanking-Quarterly', cadence: 'QUARTERLY', portfolioId }
    });
    assert.strictEqual((trainRes as Response).status, 201);

    const trainListRes = await callRoute(GET_RELEASE_TRAINS, `http://localhost/api/release-trains?portfolioId=${encodeURIComponent(portfolioId)}`, {
      method: 'GET'
    });
    assert.strictEqual((trainListRes as Response).status, 200);
    const trainList = await (trainListRes as Response).json();
    assert.ok(Array.isArray(trainList?.items) && trainList.items.length === 1, 'Expected one release train');

    const appId = new ObjectId();
    await db.collection('applications').insertOne({
      _id: appId,
      aid: 'APP-PORT-1',
      name: 'Portal',
      bundleId: 'B-1',
      status: { health: 'Healthy' },
      isActive: true,
      portfolioId,
      releaseTrain: 'DigitalBanking-Quarterly'
    });
  });
  (globalThis as any).__testToken = null;

  console.log('application portfolio tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
