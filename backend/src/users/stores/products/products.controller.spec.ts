import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { SalesController } from '../../sales/sales.controller';
import { SalesService } from '../../sales/sales.service';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

describe('SalesController permissions', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('restricts the global sales view to admins and managers, and exposes a cashier self-sales route', () => {
    const controller = new SalesController({} as unknown as SalesService);

    const globalSalesRoles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      SalesController.prototype.getStoreSales,
      SalesController,
    ]);

    const mySalesRoles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      SalesController.prototype.getMyStoreSales,
      SalesController,
    ]);

    expect(globalSalesRoles).toEqual([UserRole.ADMIN, UserRole.MANAGER]);
    expect(mySalesRoles).toEqual([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]);
  });
});