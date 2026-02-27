/**
 * Irrigation Threshold Logic - Unit Tests
 * Tests the business logic for calculating irrigation status based on moisture deficit
 */

import { describe, it, expect } from '@jest/globals';

// Irrigation status thresholds
const calculateIrrigationStatus = (
  moistureDeficit: number,
  warningThreshold: number,
  criticalThreshold: number
): 'NORMAL' | 'WARNING' | 'CRITICAL' => {
  if (moistureDeficit >= criticalThreshold) {
    return 'CRITICAL';
  }
  if (moistureDeficit >= warningThreshold) {
    return 'WARNING';
  }
  return 'NORMAL';
};

describe('Irrigation Threshold Logic', () => {
  // Default thresholds from schema
  const WARNING_THRESHOLD = 10;
  const CRITICAL_THRESHOLD = 15;

  describe('calculateIrrigationStatus', () => {
    it('should return NORMAL when moisture deficit is below warning threshold', () => {
      expect(calculateIrrigationStatus(5, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('NORMAL');
      expect(calculateIrrigationStatus(0, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('NORMAL');
      expect(calculateIrrigationStatus(9.9, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('NORMAL');
    });

    it('should return WARNING when moisture deficit is at or above warning but below critical', () => {
      expect(calculateIrrigationStatus(10, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('WARNING');
      expect(calculateIrrigationStatus(12, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('WARNING');
      expect(calculateIrrigationStatus(14.9, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('WARNING');
    });

    it('should return CRITICAL when moisture deficit is at or above critical threshold', () => {
      expect(calculateIrrigationStatus(15, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('CRITICAL');
      expect(calculateIrrigationStatus(20, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('CRITICAL');
      expect(calculateIrrigationStatus(100, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('CRITICAL');
    });

    it('should handle edge cases at exact thresholds', () => {
      // Exactly at warning threshold
      expect(calculateIrrigationStatus(10, 10, 15)).toBe('WARNING');
      // Exactly at critical threshold
      expect(calculateIrrigationStatus(15, 10, 15)).toBe('CRITICAL');
      // Just below warning
      expect(calculateIrrigationStatus(9.99, 10, 15)).toBe('NORMAL');
      // Just below critical
      expect(calculateIrrigationStatus(14.99, 10, 15)).toBe('WARNING');
    });

    it('should work with custom thresholds', () => {
      // Custom thresholds for different field types
      expect(calculateIrrigationStatus(8, 12, 18)).toBe('NORMAL');
      expect(calculateIrrigationStatus(12, 12, 18)).toBe('WARNING');
      expect(calculateIrrigationStatus(15, 12, 18)).toBe('WARNING');
      expect(calculateIrrigationStatus(18, 12, 18)).toBe('CRITICAL');
    });

    it('should handle decimal values correctly', () => {
      expect(calculateIrrigationStatus(9.5, 10, 15)).toBe('NORMAL');
      expect(calculateIrrigationStatus(10.1, 10, 15)).toBe('WARNING');
      expect(calculateIrrigationStatus(14.99, 10, 15)).toBe('WARNING');
      expect(calculateIrrigationStatus(15.01, 10, 15)).toBe('CRITICAL');
    });
  });

  describe('Escalation Rule', () => {
    /**
     * Escalation Rule: If last 3 irrigation logs are WARNING → escalate to CRITICAL
     * This tests the business logic for the escalation check
     */
    const checkEscalation = (last3MoistureValues: number[], warningThreshold: number, criticalThreshold: number): boolean => {
      if (last3MoistureValues.length < 3) return false;

      const allWarning = last3MoistureValues.every(
        (value) => value >= warningThreshold && value < criticalThreshold
      );

      return allWarning;
    };

    it('should return false if less than 3 logs', () => {
      expect(checkEscalation([12], 10, 15)).toBe(false);
      expect(checkEscalation([12, 13], 10, 15)).toBe(false);
    });

    it('should return true if last 3 logs are all WARNING', () => {
      expect(checkEscalation([12, 13, 14], 10, 15)).toBe(true);
      expect(checkEscalation([10, 10, 10], 10, 15)).toBe(true);
      expect(checkEscalation([14.9, 14.5, 14.99], 10, 15)).toBe(true);
    });

    it('should return false if any of last 3 logs is NORMAL', () => {
      expect(checkEscalation([9, 12, 13], 10, 15)).toBe(false);
      expect(checkEscalation([12, 9, 13], 10, 15)).toBe(false);
      expect(checkEscalation([12, 13, 9], 10, 15)).toBe(false);
    });

    it('should return false if any of last 3 logs is CRITICAL', () => {
      expect(checkEscalation([15, 12, 13], 10, 15)).toBe(false);
      expect(checkEscalation([12, 15, 13], 10, 15)).toBe(false);
      expect(checkEscalation([12, 13, 15], 10, 15)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(checkEscalation([], 10, 15)).toBe(false);
    });
  });
});
