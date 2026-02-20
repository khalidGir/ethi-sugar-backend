import { IrrigationStatus, Role } from '../types/enums';

const calculateIrrigationStatus = (
  moistureDeficit: number,
  warningThreshold: number,
  criticalThreshold: number
): IrrigationStatus => {
  if (moistureDeficit >= criticalThreshold) {
    return IrrigationStatus.CRITICAL;
  }
  if (moistureDeficit >= warningThreshold) {
    return IrrigationStatus.WARNING;
  }
  return IrrigationStatus.NORMAL;
};

describe('Irrigation Threshold Logic', () => {
  const defaultWarningThreshold = 10;
  const defaultCriticalThreshold = 15;

  it('should return NORMAL when moisture deficit is below warning threshold', () => {
    const result = calculateIrrigationStatus(5, defaultWarningThreshold, defaultCriticalThreshold);
    expect(result).toBe(IrrigationStatus.NORMAL);
  });

  it('should return NORMAL when moisture deficit is exactly at warning threshold minus 1', () => {
    const result = calculateIrrigationStatus(9, defaultWarningThreshold, defaultCriticalThreshold);
    expect(result).toBe(IrrigationStatus.NORMAL);
  });

  it('should return WARNING when moisture deficit is at warning threshold', () => {
    const result = calculateIrrigationStatus(10, defaultWarningThreshold, defaultCriticalThreshold);
    expect(result).toBe(IrrigationStatus.WARNING);
  });

  it('should return WARNING when moisture deficit is between warning and critical', () => {
    const result = calculateIrrigationStatus(12, defaultWarningThreshold, defaultCriticalThreshold);
    expect(result).toBe(IrrigationStatus.WARNING);
  });

  it('should return CRITICAL when moisture deficit is at critical threshold', () => {
    const result = calculateIrrigationStatus(15, defaultWarningThreshold, defaultCriticalThreshold);
    expect(result).toBe(IrrigationStatus.CRITICAL);
  });

  it('should return CRITICAL when moisture deficit exceeds critical threshold', () => {
    const result = calculateIrrigationStatus(20, defaultWarningThreshold, defaultCriticalThreshold);
    expect(result).toBe(IrrigationStatus.CRITICAL);
  });

  it('should handle custom thresholds correctly', () => {
    const warningThreshold = 8;
    const criticalThreshold = 12;
    
    expect(calculateIrrigationStatus(5, warningThreshold, criticalThreshold)).toBe(IrrigationStatus.NORMAL);
    expect(calculateIrrigationStatus(9, warningThreshold, criticalThreshold)).toBe(IrrigationStatus.WARNING);
    expect(calculateIrrigationStatus(13, warningThreshold, criticalThreshold)).toBe(IrrigationStatus.CRITICAL);
  });

  it('should handle edge case of zero moisture deficit', () => {
    const result = calculateIrrigationStatus(0, defaultWarningThreshold, defaultCriticalThreshold);
    expect(result).toBe(IrrigationStatus.NORMAL);
  });
});

describe('Role Guard Logic', () => {
  const hasPermission = (userRole: Role, requiredRoles: Role[]): boolean => {
    return requiredRoles.includes(userRole);
  };

  it('should allow admin access to admin routes', () => {
    expect(hasPermission(Role.ADMIN, [Role.ADMIN])).toBe(true);
  });

  it('should allow supervisor access to supervisor and worker routes', () => {
    expect(hasPermission(Role.SUPERVISOR, [Role.ADMIN, Role.SUPERVISOR])).toBe(true);
    expect(hasPermission(Role.SUPERVISOR, [Role.SUPERVISOR, Role.WORKER])).toBe(true);
    expect(hasPermission(Role.SUPERVISOR, [Role.ADMIN])).toBe(false);
  });

  it('should only allow worker access to worker routes', () => {
    expect(hasPermission(Role.WORKER, [Role.WORKER])).toBe(true);
    expect(hasPermission(Role.WORKER, [Role.SUPERVISOR])).toBe(false);
    expect(hasPermission(Role.WORKER, [Role.ADMIN])).toBe(false);
  });
});

describe('Escalation Rule Logic', () => {
  const checkEscalation = (recentStatuses: IrrigationStatus[]): boolean => {
    if (recentStatuses.length < 3) return false;
    const lastThree = recentStatuses.slice(-3);
    return lastThree.every(status => status === IrrigationStatus.WARNING);
  };

  it('should not escalate if less than 3 logs', () => {
    expect(checkEscalation([IrrigationStatus.WARNING, IrrigationStatus.WARNING])).toBe(false);
    expect(checkEscalation([])).toBe(false);
  });

  it('should escalate when last 3 are WARNING', () => {
    const logs = [
      IrrigationStatus.NORMAL,
      IrrigationStatus.WARNING,
      IrrigationStatus.WARNING,
      IrrigationStatus.WARNING,
    ];
    expect(checkEscalation(logs)).toBe(true);
  });

  it('should not escalate when last 3 are not all WARNING', () => {
    const logs = [
      IrrigationStatus.NORMAL,
      IrrigationStatus.WARNING,
      IrrigationStatus.WARNING,
      IrrigationStatus.CRITICAL,
    ];
    expect(checkEscalation(logs)).toBe(false);
  });

  it('should not escalate when last 3 are NORMAL', () => {
    const logs = [
      IrrigationStatus.NORMAL,
      IrrigationStatus.NORMAL,
      IrrigationStatus.NORMAL,
    ];
    expect(checkEscalation(logs)).toBe(false);
  });
});
