import { Body, Controller, Post, Get, Delete, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const { ADMIN, MANAGER } = UserRole;

// "Gérer catégories" : ADMIN et MANAGER uniquement (CASHIER exclu partout ici).
@Controller('categories')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(ADMIN, MANAGER)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Get('store/:id')
  async findByStore(@Param('id', ParseIntPipe) storeId: number) {
    return this.categoriesService.findAllByStore(storeId);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}
