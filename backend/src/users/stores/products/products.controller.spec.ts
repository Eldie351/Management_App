import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { SalesController } from '../../../sales/sales.controller';
import { SalesService } from '../../../sales/sales.service';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

describe('SalesController permissions', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('restricts global sales view to managers/admins, and allows cashiers for single sales/invoices', () => {
    // 1. Vérification de la méthode de vue globale (findAllByStore)
    const globalSalesRoles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      SalesController.prototype.findAllByStore,
      SalesController,
    ]);

    // 2. Vérification de la méthode de consultation de facture (findOne)
    const singleSaleRoles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      SalesController.prototype.findOne,
      SalesController,
    ]);

    expect(globalSalesRoles).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
    expect(singleSaleRoles).toEqual([
      UserRole.CASHIER,
      UserRole.MANAGER,
      UserRole.ADMIN,
    ]);
  });
});