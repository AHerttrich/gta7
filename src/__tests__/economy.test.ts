import { describe, it, expect } from 'vitest';
import { EconomySystem } from '../economy/EconomySystem';

describe('EconomySystem', () => {
  it('should initialize with starting cash', () => {
    const economy = new EconomySystem();
    expect(economy.cash).toBe(500);
  });

  it('should add cash when earning rewards', () => {
    const economy = new EconomySystem();
    economy.addCash(250);
    expect(economy.cash).toBe(750);
  });

  it('should allow spending cash if sufficient funds exist', () => {
    const economy = new EconomySystem();
    const success = economy.spendCash(200);
    expect(success).toBe(true);
    expect(economy.cash).toBe(300);
  });

  it('should prevent spending cash if insufficient funds', () => {
    const economy = new EconomySystem();
    const success = economy.spendCash(1000);
    expect(success).toBe(false);
    expect(economy.cash).toBe(500);
  });

  it('should start a random job with a reward and countdown', () => {
    const economy = new EconomySystem();
    const job = economy.startRandomJob();
    expect(job).toBeDefined();
    expect(job.reward).toBeGreaterThan(0);
    expect(job.timeRemaining).toBeGreaterThan(0);
  });

  it('should unlock weapon when player has enough cash', () => {
    const economy = new EconomySystem();
    // baseball bat costs 150, player starts with 500
    const bought = economy.buyWeapon('baseball_bat');
    expect(bought).toBe(true);
    expect(economy.cash).toBe(350);

    const weapon = economy.weapons.find((w) => w.id === 'baseball_bat');
    expect(weapon?.unlocked).toBe(true);
  });
});
