import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateCycleCommission,
  calculateTeamLeaderCommission,
  allocateFIFOInventory,
  createOrder,
  approveLoading,
  getPaymentDetails,
} from '../src/lib/test-utils/business-logic';

describe('Date Farm Management System - Business Logic Tests', () => {

  describe('Tiered Commission Logic (Cycle-based)', () => {
    it('should apply 15% for totals under 50kg', () => {
      const orders = [{ weight: 20 }, { weight: 20 }]; // 40kg total
      const result = calculateCycleCommission(orders);
      expect(result.tier).toBe(0.15);
      expect(result.amount).toBe(6); // נניח מחיר לקילו הוא 1, אז 15% מ-40
    });

    it('should apply 17% for totals between 50kg and 75kg', () => {
      const orders = [{ weight: 30 }, { weight: 30 }]; // 60kg total
      const result = calculateCycleCommission(orders);
      expect(result.tier).toBe(0.17);
    });

    it('should apply 20% for totals over 75kg', () => {
      const orders = [{ weight: 40 }, { weight: 40 }]; // 80kg total
      const result = calculateCycleCommission(orders);
      expect(result.tier).toBe(0.20);
    });

    it('should calculate Team Leader 5% commission correctly', () => {
      const regionalSales = 1000; // סך מכירות האזור
      const tlCommission = calculateTeamLeaderCommission(regionalSales);
      expect(tlCommission).toBe(50);
    });
  });

  describe('Inventory FIFO & Virtual Lock', () => {
    const mockPallets = [
      { id: 'old-1', entry_date: '2026-01-01', weight: 100 },
      { id: 'new-2', entry_date: '2026-01-10', weight: 100 }
    ];

    it('should select the oldest pallet first (FIFO)', () => {
      const allocation = allocateFIFOInventory(mockPallets, 50);
      expect(allocation[0].pallet_id).toBe('old-1');
    });

    it('should reserve stock without decreasing physical inventory initially', () => {
      const stock = { physical: 100, reserved: 0 };
      const updatedStock = createOrder(stock, 20);
      expect(updatedStock.reserved).toBe(20);
      expect(updatedStock.physical).toBe(100); // נשאר ללא שינוי עד האישור
    });

    it('should decrease physical stock only upon Admin Approval', () => {
      const stock = { physical: 100, reserved: 20 };
      const finalStock = approveLoading(stock);
      expect(finalStock.physical).toBe(80);
      expect(finalStock.reserved).toBe(0);
    });
  });

  describe('Hybrid Payment Security', () => {
    it('should return Paybox link only for Cash_Paybox distributors', () => {
      const distributor = { model: 'Cash_Paybox' as const, paybox_link: 'http://paybox.me/nadav' };
      const paymentInfo = getPaymentDetails(distributor);
      expect(paymentInfo.showPaybox).toBe(true);
      expect(paymentInfo.link).toBe('http://paybox.me/nadav');
    });
  });
});