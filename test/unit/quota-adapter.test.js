const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { QuotaAdapter } = require('../../src/adapters/quota-adapter');

describe('QuotaAdapter', () => {
  it('should initialize with default snapshot', () => {
    const adapter = new QuotaAdapter();
    const snapshot = adapter.getSnapshot();
    
    assert.strictEqual(snapshot.fiveHour, null);
    assert.strictEqual(snapshot.weekly, null);
    assert.strictEqual(snapshot.online, false);
  });

  it('should validate quota values correctly', () => {
    const adapter = new QuotaAdapter();
    
    // 有效值
    assert.strictEqual(adapter._validateQuota(50), 50);
    assert.strictEqual(adapter._validateQuota(0), 0);
    assert.strictEqual(adapter._validateQuota(100), 100);
    
    // 无效值
    assert.strictEqual(adapter._validateQuota(-1), null);
    assert.strictEqual(adapter._validateQuota(101), null);
    assert.strictEqual(adapter._validateQuota(NaN), null);
    assert.strictEqual(adapter._validateQuota(Infinity), null);
    assert.strictEqual(adapter._validateQuota('50'), null);
    assert.strictEqual(adapter._validateQuota(null), null);
  });

  it('should emit change event on tick', async () => {
    const mockDiscover = {
      discover: async () => null
    };

    const adapter = new QuotaAdapter({ discoverService: mockDiscover });
    
    let changeEmitted = false;
    adapter.on('change', (snapshot) => {
      changeEmitted = true;
      assert.strictEqual(snapshot.online, false);
    });

    await adapter.tick();
    assert.strictEqual(changeEmitted, true);
  });
});
