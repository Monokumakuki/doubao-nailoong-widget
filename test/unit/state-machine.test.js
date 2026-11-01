const { describe, it } = require('node:test');
const assert = require('node:assert');
const { WidgetStateMachine } = require('../../src/domain/state-machine');

describe('WidgetStateMachine', () => {
  it('should initialize with idle state', () => {
    const sm = new WidgetStateMachine();
    assert.strictEqual(sm.getPersistentState(), 'idle');
    assert.strictEqual(sm.getCurrentState(), 'idle');
  });

  it('should set persistent state', () => {
    const sm = new WidgetStateMachine();
    const result = sm.setPersistentState('thinking');
    
    assert.strictEqual(result, true);
    assert.strictEqual(sm.getPersistentState(), 'thinking');
  });

  it('should reject invalid persistent state', () => {
    const sm = new WidgetStateMachine();
    const result = sm.setPersistentState('invalid');
    
    assert.strictEqual(result, false);
    assert.strictEqual(sm.getPersistentState(), 'idle');
  });

  it('should trigger transient state', () => {
    const sm = new WidgetStateMachine();
    sm.triggerTransient('pressed', 100);
    
    assert.strictEqual(sm.getCurrentState(), 'pressed');
    assert.strictEqual(sm.getPersistentState(), 'idle');
  });

  it('should auto-clear transient state', (t, done) => {
    const sm = new WidgetStateMachine();
    sm.triggerTransient('pressed', 50);
    
    setTimeout(() => {
      assert.strictEqual(sm.getCurrentState(), 'idle');
      done();
    }, 100);
  });

  it('should handle petting with cooldown', () => {
    const sm = new WidgetStateMachine();
    
    const result1 = sm.handlePetting();
    assert.strictEqual(result1, true);
    
    const result2 = sm.handlePetting();
    assert.strictEqual(result2, false); // 冷却中
  });

  it('should update state by quota', () => {
    const sm = new WidgetStateMachine();
    
    // 额度低
    sm.updateByQuota({ fiveHour: 15, weekly: 10, online: true });
    assert.strictEqual(sm.getPersistentState(), 'warning');
    
    // 额度恢复
    sm.updateByQuota({ fiveHour: 80, weekly: 70, online: true });
    assert.strictEqual(sm.getPersistentState(), 'idle');
  });

  it('should detect offline', () => {
    const sm = new WidgetStateMachine();
    sm.updateByQuota({ online: false });
    
    assert.strictEqual(sm.getPersistentState(), 'offline');
  });

  it('should emit state-change event', (t, done) => {
    const sm = new WidgetStateMachine();
    
    sm.on('state-change', (state) => {
      assert.strictEqual(state.persistent, 'thinking');
      assert.strictEqual(state.current, 'thinking');
      done();
    });
    
    sm.setPersistentState('thinking');
  });
});
